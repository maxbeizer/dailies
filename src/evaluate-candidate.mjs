import { access } from "node:fs/promises";
import { readFile, mkdir, rm, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readScenarioWithAudioCues } from "./audio-cues.mjs";
import { resolveArtifactOutputPath } from "./compile-timeline.mjs";
import { defaultRenderManifestPath, defaultVideoPath } from "./render-video.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function evaluateCandidate(source) {
  const { parsed, timeline, cues } = await readScenarioWithAudioCues(source);
  const videoPath = resolveArtifactOutputPath(parsed.frontmatter.video || defaultVideoPath(source));
  const manifestPath = resolveArtifactOutputPath(parsed.frontmatter.renderManifest || defaultRenderManifestPath(source));
  const checks = [];
  const videoExists = await exists(videoPath);
  await check(checks, "video_artifact_exists", videoExists, `video exists at ${path.relative(PROJECT_ROOT, videoPath)}`);
  const manifestExists = await exists(manifestPath);
  await check(checks, "render_manifest_exists", manifestExists, `render manifest exists at ${path.relative(PROJECT_ROOT, manifestPath)}`);
  const manifest = await readJsonIfExists(manifestPath);
  await check(checks, "manifest_matches_current_timeline", manifestMatchesTimeline(manifest, timeline), "render manifest matches the current compiled timeline");
  await check(checks, "manifest_matches_video", manifestMatchesVideo(manifest, videoPath), "render manifest video hash matches the MP4 artifact");
  await check(checks, "audio_fixtures_exist", Promise.all(cues.map((cue) => exists(cue.outputPath))).then((results) => results.every(Boolean)), "all declared audio cue files exist");
  await check(checks, "audio_fixtures_match_cue_text", audioFixturesMatchCueText(cues), "audio sidecar text matches current cue text");
  await check(checks, "manifest_matches_audio_cues", manifestMatchesAudioCues(manifest, cues), "render manifest audio cue hashes match current cues");

  const metadata = videoExists ? await ffprobeIfPossible(videoPath) : null;
  const videoStream = metadata?.streams?.find((stream) => stream.codec_type === "video");
  const audioStream = metadata?.streams?.find((stream) => stream.codec_type === "audio");
  const duration = Number(metadata?.format?.duration || 0);
  await check(checks, "video_is_1280x720", Boolean(videoStream && videoStream.width === 1280 && videoStream.height === 720), "video dimensions are 1280x720");
  await check(checks, "video_has_h264", videoStream?.codec_name === "h264", "video codec is H.264");
  await check(checks, "video_has_audio_stream", Boolean(audioStream), "video includes an audio stream");
  await check(checks, "video_covers_timeline", duration * 1000 >= timeline.durationMs, "video duration covers the compiled timeline");
  const sampledFrames = videoExists && metadata ? await sampleFramesIfPossible(videoPath, timeline) : [];
  await check(checks, "sampled_frames_exist", sampledFrames.length > 0 && Promise.all(sampledFrames.map((frame) => nonEmptyFile(frame.path))).then((results) => results.every(Boolean)), "candidate evaluation sampled non-empty video frames");

  const status = checks.every((item) => item.status === "pass") ? "pass" : "fail";
  return { status, checks, metadata, sampledFrames };
}

async function check(checks, name, promise, detail) {
  let passed = false;
  try {
    passed = Boolean(await promise);
  } catch {
    passed = false;
  }
  checks.push({ name, status: passed ? "pass" : "fail", detail });
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function nonEmptyFile(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile() && info.size > 1024;
  } catch {
    return false;
  }
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function manifestMatchesTimeline(manifest, timeline) {
  return Boolean(manifest?.timelineSha256 && manifest.timelineSha256 === sha256Text(JSON.stringify(timeline)));
}

async function manifestMatchesVideo(manifest, videoPath) {
  return Boolean(manifest?.videoSha256 && manifest.videoSha256 === await sha256File(videoPath));
}

async function audioFixturesMatchCueText(cues) {
  const results = await Promise.all(cues.map(async (cue) => {
    try {
      const text = await readFile(`${cue.outputPath}.txt`, "utf8");
      return text === (cue.text || "");
    } catch {
      return false;
    }
  }));
  return results.every(Boolean);
}

async function manifestMatchesAudioCues(manifest, cues) {
  if (!manifest?.audioCues || manifest.audioCues.length !== cues.length) return false;
  const byOutput = new Map(manifest.audioCues.map((cue) => [cue.output, cue]));
  for (const cue of cues) {
    const relativeOutput = path.relative(PROJECT_ROOT, cue.outputPath);
    const manifestCue = byOutput.get(relativeOutput);
    if (!manifestCue) return false;
    if (manifestCue.textSha256 !== sha256Text(cue.text || "")) return false;
    if (manifestCue.sha256 !== await sha256File(cue.outputPath)) return false;
  }
  return true;
}

async function sampleFrames(videoPath, timeline) {
  const base = path.basename(videoPath, ".mp4");
  const frameDir = path.resolve(PROJECT_ROOT, "artifacts", "tsrs", "frames");
  await mkdir(frameDir, { recursive: true });
  const sampleSeconds = [0.25, 0.45, 0.82].map((ratio) => Math.max(1, Math.round(((timeline.durationMs || 1) / 1000) * ratio)));
  const frames = [];
  for (const seconds of sampleSeconds) {
    const framePath = path.join(frameDir, `${base}-${String(seconds).padStart(2, "0")}s.webp`);
    const tempPngPath = path.join(frameDir, `.${base}-${String(seconds).padStart(2, "0")}s.png`);
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      String(seconds),
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-vf",
      "scale=640:-2",
      tempPngPath,
    ]);
    await run("cwebp", [
      "-quiet",
      "-q",
      "82",
      tempPngPath,
      "-o",
      framePath,
    ]);
    await rm(tempPngPath, { force: true });
    frames.push({ seconds, path: framePath });
  }
  return frames;
}

async function sampleFramesIfPossible(videoPath, timeline) {
  try {
    return await sampleFrames(videoPath, timeline);
  } catch {
    return [];
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      stdio: "ignore",
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

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

function ffprobe(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=index,codec_type,codec_name,width,height,r_frame_rate",
      "-of",
      "json",
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
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function ffprobeIfPossible(filePath) {
  try {
    return await ffprobe(filePath);
  } catch {
    return null;
  }
}

async function main(argv) {
  const source = argv[2];
  if (!source) {
    console.error("Usage: node src/evaluate-candidate.mjs <demo.md>");
    return 2;
  }

  const report = await evaluateCandidate(source);
  console.log(JSON.stringify({
    status: report.status,
    checks: report.checks,
    sampledFrames: report.sampledFrames.map((frame) => ({
      seconds: frame.seconds,
      path: path.relative(PROJECT_ROOT, frame.path),
    })),
  }, null, 2));
  return report.status === "pass" ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv).then((code) => {
    process.exitCode = code;
  });
}
