import { createReadStream } from "node:fs";
import { access, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cueEffectiveProvider, cueFixtureFingerprint, cueFixtureMatches, readScenarioWithAudioCues } from "./audio-cues.mjs";
import { resolveArtifactOutputPath } from "./compile-timeline.mjs";
import { renderPreview } from "./render-preview.mjs";
import { renderWithChrome } from "./render-with-chrome.mjs";
import { mediaManifestEntries, productionManifest } from "./media-fixtures.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_ZSHOT_PATH = path.join(process.env.HOME || "", "Library/Application Support/ZShot/zshot");

export function defaultVideoPath(sourcePath) {
  const relative = path.relative(PROJECT_ROOT, path.resolve(sourcePath));
  const withoutDemoSuffix = relative.replace(/\.demo\.md$/, "");
  if (withoutDemoSuffix.startsWith(`demos${path.sep}`)) {
    return path.join("artifacts", withoutDemoSuffix.slice(`demos${path.sep}`.length) + ".mp4");
  }
  return path.join("artifacts", path.basename(withoutDemoSuffix) + ".mp4");
}

export function defaultRenderManifestPath(sourcePath) {
  const relative = path.relative(PROJECT_ROOT, path.resolve(sourcePath));
  const withoutDemoSuffix = relative.replace(/\.demo\.md$/, "");
  if (withoutDemoSuffix.startsWith(`demos${path.sep}`)) {
    return path.join("artifacts", withoutDemoSuffix.slice(`demos${path.sep}`.length) + ".render.json");
  }
  return path.join("artifacts", path.basename(withoutDemoSuffix) + ".render.json");
}

async function renderVideo(source) {
  const sourcePath = path.resolve(source);
  const { parsed, cues } = await readScenarioWithAudioCues(sourcePath);
  const { outputPath: previewPath, timeline } = await renderPreview(sourcePath);
  const outputPath = resolveArtifactOutputPath(parsed.frontmatter.video || defaultVideoPath(sourcePath));
  const manifestPath = resolveArtifactOutputPath(parsed.frontmatter.renderManifest || defaultRenderManifestPath(sourcePath));
  const videoOnlyPath = outputPath.replace(/\.mp4$/, ".video-only.mp4");
  const zshotPath = process.env.ZSHOT_PATH || DEFAULT_ZSHOT_PATH;
  const availableAudioCues = await audioCuesWithExistingFiles(cues);
  const durationSeconds = String(await renderDurationSeconds(timeline, availableAudioCues));
  const capturePath = availableAudioCues.length > 0 ? videoOnlyPath : outputPath;

  await mkdir(path.dirname(outputPath), { recursive: true });
  const server = await startStaticServer();
  try {
    const relativePreviewPath = path.relative(PROJECT_ROOT, previewPath).split(path.sep).map(encodeURIComponent).join("/");
    const previewUrl = `${server.url}/${relativePreviewPath}?autoplay=1&chrome=0`;
    await renderVisuals({
      zshotPath,
      previewUrl,
      capturePath,
      durationSeconds: Number(durationSeconds),
      timeline,
    });
  } finally {
    await server.close();
  }

  if (availableAudioCues.length > 0) {
    await muxAudio(capturePath, outputPath, availableAudioCues);
    await rm(capturePath, { force: true });
  }

  await writeRenderManifest(manifestPath, {
    sourcePath,
    timeline,
    previewPath,
    videoPath: outputPath,
    durationSeconds: Number(durationSeconds),
    audioCues: availableAudioCues,
  });

  return outputPath;
}

async function renderVisuals(options) {
  const renderer = process.env.DAILIES_RENDERER || "auto";
  if (!["auto", "zshot", "chrome"].includes(renderer)) {
    throw new Error("DAILIES_RENDERER must be auto, zshot, or chrome");
  }

  const hasMedia = (options.timeline?.events || []).some((event) => event.surface === "media");
  if (hasMedia && renderer === "zshot") {
    throw new Error("media fixtures require the deterministic Chrome renderer");
  }

  if (renderer === "chrome" || hasMedia) {
    await renderWithChrome({
      url: options.previewUrl.replace("autoplay=1", "autoplay=0"),
      outputPath: options.capturePath,
      durationSeconds: options.durationSeconds,
      width: 1280,
      height: 720,
    });
    return;
  }

  try {
    await run(options.zshotPath, [
      "-t",
      "mp4",
      "-f",
      options.capturePath,
      "--video-width",
      "1280",
      "--video-height",
      "720",
      "--video-selector",
      "#stage",
      "--video-framerate",
      "30",
      "--video-duration",
      String(options.durationSeconds),
      "--process-timeout",
      String(options.durationSeconds + 30),
      options.previewUrl,
    ]);
  } catch (error) {
    if (renderer === "zshot") throw error;
    console.warn(`ZShot render failed; using local Chrome capture: ${error.message}`);
    await renderWithChrome({
      url: options.previewUrl.replace("autoplay=1", "autoplay=0"),
      outputPath: options.capturePath,
      durationSeconds: options.durationSeconds,
      width: 1280,
      height: 720,
    });
  }
}

async function writeRenderManifest(manifestPath, data) {
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourcePath: path.relative(PROJECT_ROOT, data.sourcePath),
    previewPath: path.relative(PROJECT_ROOT, data.previewPath),
    videoPath: path.relative(PROJECT_ROOT, data.videoPath),
    durationSeconds: data.durationSeconds,
    timelineSha256: sha256Text(JSON.stringify(data.timeline)),
    previewSha256: await sha256File(data.previewPath),
    videoSha256: await sha256File(data.videoPath),
    audioCues: await Promise.all(data.audioCues.map(async (cue) => {
      const provider = await cueEffectiveProvider(cue);
      return {
        line: cue.line,
        output: path.relative(PROJECT_ROOT, cue.outputPath),
        startMs: cue.event?.startMs || 0,
        provider,
        voice: cue.voice || null,
        speed: cue.speed ?? null,
        textSha256: sha256Text(cue.text || ""),
        synthesisSha256: await cueFixtureFingerprint(cue),
        sha256: await sha256File(cue.outputPath),
      };
    })),
    media: await mediaManifestEntries(data.timeline),
    production: await productionManifest(data.timeline),
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function audioCuesWithExistingFiles(cues) {
  const available = [];
  for (const cue of cues) {
    if (await exists(cue.outputPath) && await cueFixtureMatches(cue)) {
      available.push(cue);
    }
  }
  return available;
}

async function renderDurationSeconds(timeline, cues) {
  let durationMs = timeline.durationMs || 1;
  for (const cue of cues) {
    const audioDurationMs = Math.ceil((await mediaDurationSeconds(cue.outputPath)) * 1000);
    const cueStartMs = cue.event?.startMs ?? timeline.durationMs ?? 0;
    durationMs = Math.max(durationMs, cueStartMs + audioDurationMs + 900);
  }
  return Math.ceil(durationMs / 1000);
}

async function muxAudio(videoOnlyPath, outputPath, cues) {
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    videoOnlyPath,
  ];

  for (const cue of cues) {
    args.push("-i", cue.outputPath);
  }

  const delayedLabels = cues.map((cue, index) => {
    const delayMs = Math.max(0, Math.round(cue.event?.startMs || 0));
    return `[${index + 1}:a]adelay=${delayMs}|${delayMs},apad[a${index}]`;
  });
  const mixedLabel = cues.length === 1
    ? "[a0]"
    : `${cues.map((_, index) => `[a${index}]`).join("")}amix=inputs=${cues.length}:duration=longest:normalize=0[a]`;
  const audioOutputLabel = cues.length === 1 ? "[a0]" : "[a]";

  args.push(
    "-filter_complex",
    `${delayedLabels.join(";")}${cues.length === 1 ? "" : `;${mixedLabel}`}`,
    "-map",
    "0:v:0",
    "-map",
    audioOutputLabel,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-shortest",
    outputPath,
  );

  await run("ffmpeg", args);
}

function mediaDurationSeconds(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ], {
      cwd: PROJECT_ROOT,
      stdio: ["ignore", "pipe", "inherit"],
    });

    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with ${code}`));
        return;
      }
      resolve(Number(stdout.trim() || 0));
    });
  });
}

function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const requestedPath = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
      const filePath = path.resolve(PROJECT_ROOT, requestedPath || "index.html");
      const relative = path.relative(PROJECT_ROOT, filePath);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        response.writeHead(403);
        response.end("forbidden");
        return;
      }

      const info = await stat(filePath);
      if (!info.isFile()) {
        response.writeHead(404);
        response.end("not found");
        return;
      }

      response.writeHead(200, {
        "Content-Type": contentType(filePath),
        "Cache-Control": "no-store",
      });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404);
      response.end("not found");
    }
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with ${code}`));
      }
    });
  });
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function main(argv) {
  const source = argv[2];
  if (!source) {
    console.error("Usage: node src/render-video.mjs <demo.md>");
    return 2;
  }

  try {
    const outputPath = await renderVideo(source);
    console.log(outputPath);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv).then((code) => {
    process.exitCode = code;
  });
}
