import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { access, lstat, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { loadLiveAppCapture } from "./live-app-capture.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function parseCaptureLiveArgs(argv) {
  let source = "";
  let approved = false;
  for (const argument of argv) {
    if (argument === "--approve") {
      approved = true;
    } else if (!argument.startsWith("-") && !source) {
      source = argument;
    } else {
      throw new Error(`unexpected argument: ${argument}`);
    }
  }
  if (!source) throw new Error("capture declaration is required");
  if (!approved) throw new Error("live capture requires --approve");
  return { source, approved };
}

export function captureFrameCount(durationMs, framesPerSecond) {
  return Math.ceil(durationMs * framesPerSecond / 1000);
}

export function captureFramePath(framesDirectory, index) {
  return path.join(framesDirectory, `frame-${String(index + 1).padStart(5, "0")}.png`);
}

export function screencaptureArguments(region, outputPath) {
  return [
    "-x",
    `-R${region.x},${region.y},${region.width},${region.height}`,
    outputPath,
  ];
}

export async function runLiveCapture(sourcePath, options = {}) {
  if (process.platform !== "darwin") {
    throw new Error("live app capture requires macOS");
  }

  const projectRoot = path.resolve(options.projectRoot || PROJECT_ROOT);
  const source = path.resolve(projectRoot, sourcePath);
  const declaration = await loadLiveAppCapture(source, { projectRoot });
  if (!declaration.capture) {
    throw new Error("live capture execution requires a capture region and framesPerSecond");
  }

  const artifactDirectory = path.join(projectRoot, "artifacts", "live-capture", declaration.id);
  const framesDirectory = path.join(artifactDirectory, "frames");
  const candidatePath = path.join(artifactDirectory, `${declaration.id}.mp4`);
  const reportPath = path.join(artifactDirectory, `${declaration.id}.capture.json`);
  const originalDirectorPath = await realpath(path.resolve(projectRoot, declaration.director));
  const runToken = randomUUID();
  await prepareArtifactDirectory(artifactDirectory, projectRoot);
  await mkdir(framesDirectory);

  const directorSnapshotPath = path.join(artifactDirectory, "director.applescript");
  await writeFile(directorSnapshotPath, await readFile(originalDirectorPath), { mode: 0o400 });
  const directorSnapshotRelative = path.relative(projectRoot, directorSnapshotPath).split(path.sep).join("/");
  await loadLiveAppCaptureFromData({
    ...declaration,
    director: directorSnapshotRelative,
  }, projectRoot, path.join(artifactDirectory, "director-snapshot.capture.json"));

  const report = {
    version: 1,
    id: declaration.id,
    status: "running",
    startedAt: new Date().toISOString(),
    app: declaration.app,
    declaration: path.relative(projectRoot, source).split(path.sep).join("/"),
    declarationSha256: await sha256File(source),
    director: declaration.director,
    directorSha256: await sha256File(directorSnapshotPath),
    executedDirector: directorSnapshotRelative,
    output: path.relative(projectRoot, candidatePath).split(path.sep).join("/"),
    promotionTarget: declaration.output,
    capture: declaration.capture,
    runToken,
    actions: [],
  };

  let captureError;
  try {
    for (const invocation of declaration.setup) {
      report.actions.push(await invokeDirector(directorSnapshotPath, invocation, runToken, "setup"));
    }

    const frameDimensions = await captureFrames({
      declaration,
      framesDirectory,
      directorPath: directorSnapshotPath,
      runToken,
      report,
      projectRoot,
    });

    await encodeFrames({
      candidatePath,
      framesDirectory,
      framesPerSecond: declaration.capture.framesPerSecond,
      frameCount: captureFrameCount(
        declaration.durationMs,
        declaration.capture.framesPerSecond,
      ),
      projectRoot,
    });
    report.video = await inspectVideo(candidatePath, projectRoot);
    validateCapturedVideo(report.video, {
      frameCount: captureFrameCount(
        declaration.durationMs,
        declaration.capture.framesPerSecond,
      ),
      durationMs: declaration.durationMs,
      width: frameDimensions.width,
      height: frameDimensions.height,
    });
    report.status = "pass";
    report.completedAt = new Date().toISOString();
    report.outputSha256 = await sha256File(candidatePath);
  } catch (error) {
    captureError = error;
    report.status = "fail";
    report.completedAt = new Date().toISOString();
    report.error = error.message;
    await rm(candidatePath, { force: true });
  } finally {
    for (const invocation of declaration.teardown) {
      try {
        report.actions.push(await invokeDirector(directorSnapshotPath, invocation, runToken, "teardown"));
      } catch (error) {
        report.status = "fail";
        report.error ||= error.message;
        captureError ||= error;
      }
    }
    await rm(framesDirectory, { recursive: true, force: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (captureError) throw captureError;
  return { declaration, candidatePath, reportPath, report };
}

export function validateCapturedVideo(video, expected) {
  if (video.width !== expected.width || video.height !== expected.height) {
    throw new Error(`captured video dimensions must be ${expected.width}x${expected.height}`);
  }
  if (video.frameCount !== expected.frameCount) {
    throw new Error(`captured video frame count must be ${expected.frameCount}`);
  }
  if (!Number.isFinite(video.durationMs) || Math.abs(video.durationMs - expected.durationMs) > 50) {
    throw new Error(`captured video duration must be ${expected.durationMs}ms`);
  }
}

async function captureFrames(options) {
  const {
    declaration,
    framesDirectory,
    directorPath,
    runToken,
    report,
    projectRoot,
  } = options;
  const { framesPerSecond, region } = declaration.capture;
  const frameCount = captureFrameCount(declaration.durationMs, framesPerSecond);
  const frameIntervalMs = 1000 / framesPerSecond;
  let actionIndex = 0;

  for (let index = 0; index < frameCount; index += 1) {
    const outputTimeMs = index * frameIntervalMs;
    let actionApplied = false;
    while (
      actionIndex < declaration.actions.length
      && (
        declaration.actions[actionIndex].atMs <= outputTimeMs
        || index === frameCount - 1
      )
    ) {
      report.actions.push(await invokeDirector(
        directorPath,
        declaration.actions[actionIndex],
        runToken,
        "action",
      ));
      actionIndex += 1;
      actionApplied = true;
    }
    if (actionApplied) await sleep(100);
    const framePath = captureFramePath(framesDirectory, index);
    await runCommand("screencapture", screencaptureArguments(region, framePath), {
      cwd: projectRoot,
      timeoutMs: 5000,
    });
  }

  return inspectDimensions(captureFramePath(framesDirectory, 0), projectRoot);
}

export async function prepareArtifactDirectory(artifactDirectory, projectRoot) {
  const relative = path.relative(projectRoot, artifactDirectory);
  if (relative.startsWith("..") || path.isAbsolute(relative) || relative === "") {
    throw new Error("live capture artifact directory must stay inside the repository");
  }

  let current = projectRoot;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new Error("live capture artifact path must not contain symbolic links");
      }
    } catch (error) {
      if (error.code === "ENOENT") break;
      throw error;
    }
  }

  await rm(artifactDirectory, { recursive: true, force: true });
  await mkdir(artifactDirectory, { recursive: true });
  const [resolvedArtifactDirectory, resolvedProjectRoot] = await Promise.all([
    realpath(artifactDirectory),
    realpath(projectRoot),
  ]);
  const resolvedRelative = path.relative(resolvedProjectRoot, resolvedArtifactDirectory);
  if (resolvedRelative.startsWith("..") || path.isAbsolute(resolvedRelative) || resolvedRelative === "") {
    throw new Error("live capture artifact directory must resolve inside the repository");
  }
}

async function inspectDimensions(sourcePath, projectRoot) {
  const { stdout } = await runCommand("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "json",
    sourcePath,
  ], { cwd: projectRoot, timeoutMs: 30000 });
  const stream = JSON.parse(stdout).streams?.[0];
  return {
    width: Number(stream?.width),
    height: Number(stream?.height),
  };
}

async function invokeDirector(directorPath, invocation, runToken, phase) {
  const startedAt = new Date().toISOString();
  const started = performance.now();
  await runCommand("osascript", [directorPath, invocation.action, runToken], {
    timeoutMs: invocation.timeoutMs,
  });
  return {
    phase,
    action: invocation.action,
    ...(invocation.atMs === undefined ? {} : { atMs: invocation.atMs }),
    startedAt,
    durationMs: Math.round(performance.now() - started),
    status: "pass",
  };
}

async function encodeFrames(options) {
  const {
    candidatePath,
    framesDirectory,
    framesPerSecond,
    frameCount,
    projectRoot,
  } = options;
  await Promise.all(
    Array.from({ length: frameCount }, (_, index) => access(captureFramePath(framesDirectory, index))),
  );
  await runCommand("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-framerate",
    String(framesPerSecond),
    "-i",
    path.join(framesDirectory, "frame-%05d.png"),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    candidatePath,
  ], {
    cwd: projectRoot,
    timeoutMs: 120000,
  });
}

async function inspectVideo(candidatePath, projectRoot) {
  const { stdout } = await runCommand("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=width,height,nb_frames",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    candidatePath,
  ], {
    cwd: projectRoot,
    timeoutMs: 30000,
  });
  const data = JSON.parse(stdout);
  const video = data.streams?.[0] || {};
  return {
    width: video.width,
    height: video.height,
    frameCount: Number(video.nb_frames),
    durationMs: Math.round(Number(data.format?.duration) * 1000),
  };
}

async function loadLiveAppCaptureFromData(data, projectRoot, validationPath) {
  await writeFile(validationPath, `${JSON.stringify(data)}\n`, { mode: 0o600 });
  try {
    return await loadLiveAppCapture(validationPath, { projectRoot });
  } finally {
    await rm(validationPath, { force: true });
  }
}

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!settled) child.kill("SIGKILL");
      }, 500).unref();
    }, options.timeoutMs || 30000);

    child.stdout.on("data", (chunk) => {
      if (stdout.length < 100000) stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 4000) stderr += chunk;
    });
    child.on("error", finish);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        finish();
      } else {
        const reason = signal ? `signal ${signal}` : `exit ${code}`;
        finish(new Error(`${command} failed with ${reason}${stderr.trim() ? `: ${stderr.trim()}` : ""}`));
      }
    });

    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve({ stdout, stderr });
    }
  });
}

async function sleep(delayMs) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function main() {
  const { source } = parseCaptureLiveArgs(process.argv.slice(2));
  const result = await runLiveCapture(source);
  console.log(`pass ${path.relative(PROJECT_ROOT, result.candidatePath)}`);
  console.log(`report ${path.relative(PROJECT_ROOT, result.reportPath)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
