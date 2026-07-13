import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA_FITS = new Set(["contain", "cover"]);
const MEDIA_PANELS = new Set(["monitor", "stage"]);
const MEDIA_TRANSITIONS = new Set(["cut", "fade"]);
const THEMES = new Set(["dark", "cinema", "light"]);

export function validateMediaData(data, index = 0) {
  if (!data || data.parseError) {
    throw new Error(`media ${index + 1} must contain valid key/value data`);
  }
  if (data.type !== "video") {
    throw new Error(`media ${index + 1} type must be video`);
  }

  const source = validateAssetSource(data.source, {
    label: `media ${index + 1} source`,
    extensions: [".mp4"],
    extensionMessage: "media sources must be MP4 files",
  });
  const offsetMs = nonnegativeInteger(data.offsetMs ?? 0, `media ${index + 1} offsetMs`);
  const sourceOffsetMs = nonnegativeInteger(data.sourceOffsetMs ?? 0, `media ${index + 1} sourceOffsetMs`);
  const durationMs = positiveInteger(data.durationMs, `media ${index + 1} durationMs`);
  const fit = data.fit || "contain";
  const panel = data.panel || "monitor";
  const audio = data.audio || "muted";
  const transition = data.transition || "cut";
  const fadeMs = nonnegativeInteger(data.fadeMs ?? (transition === "fade" ? 350 : 0), `media ${index + 1} fadeMs`);

  if (!MEDIA_FITS.has(fit)) throw new Error(`media ${index + 1} fit must be contain or cover`);
  if (!MEDIA_PANELS.has(panel)) throw new Error(`media ${index + 1} panel must be monitor or stage`);
  if (audio !== "muted") throw new Error(`media ${index + 1} audio must be muted`);
  if (!MEDIA_TRANSITIONS.has(transition)) throw new Error(`media ${index + 1} transition must be cut or fade`);
  if (transition === "cut" && fadeMs !== 0) throw new Error(`media ${index + 1} fadeMs requires transition: fade`);
  if (fadeMs * 2 > durationMs) throw new Error(`media ${index + 1} fadeMs must fit inside durationMs`);
  if (data.caption !== undefined && (typeof data.caption !== "string" || !data.caption.trim())) {
    throw new Error(`media ${index + 1} caption must be a non-empty string`);
  }

  return {
    type: "video",
    source,
    panel,
    offsetMs,
    sourceOffsetMs,
    durationMs,
    fit,
    audio,
    transition,
    fadeMs,
    ...(data.caption ? { caption: data.caption.trim() } : {}),
  };
}

export function validateProductionConfig(frontmatter) {
  const theme = frontmatter.theme || "dark";
  if (!THEMES.has(theme)) {
    throw new Error("theme must be dark, cinema, or light");
  }

  const production = { theme };
  if (frontmatter.background) {
    production.background = validateAssetSource(frontmatter.background, {
      label: "background",
      extensions: [".png", ".jpg", ".jpeg", ".webp"],
      extensionMessage: "background must be a PNG, JPEG, or WebP asset",
    });
  }
  return production;
}

export function validateAssetSource(source, options = {}) {
  const label = options.label || "asset source";
  if (typeof source !== "string" || !source.trim()) {
    throw new Error(`${label} is required`);
  }
  if (path.isAbsolute(source)) {
    throw new Error(`${label} must be relative`);
  }

  const normalized = source.replaceAll("\\", "/");
  const resolved = path.resolve(PROJECT_ROOT, normalized);
  const assetsRoot = path.join(PROJECT_ROOT, "assets");
  const relative = path.relative(assetsRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative) || relative === "") {
    throw new Error(`${label} must stay under assets/`);
  }

  const extension = path.extname(normalized).toLowerCase();
  if (options.extensions && !options.extensions.includes(extension)) {
    throw new Error(options.extensionMessage || `${label} has an unsupported file type`);
  }
  return path.relative(PROJECT_ROOT, resolved).split(path.sep).join("/");
}

export function mediaEvents(timeline) {
  return (timeline.events || []).filter((event) => event.surface === "media" && event.action === "show-video");
}

export function mediaConfigFingerprint(media) {
  return sha256Text(JSON.stringify({
    type: media.type,
    source: media.source,
    panel: media.panel,
    sourceOffsetMs: media.sourceOffsetMs,
    durationMs: media.durationMs,
    fit: media.fit,
    audio: media.audio,
    transition: media.transition,
    fadeMs: media.fadeMs,
    caption: media.caption || null,
  }));
}

export async function mediaManifestEntries(timeline) {
  return Promise.all(mediaEvents(timeline).map(async (event) => {
    const sourcePath = resolveMediaSourcePath(event.media.source);
    return {
      source: event.media.source,
      startMs: event.startMs,
      sourceOffsetMs: event.media.sourceOffsetMs,
      durationMs: event.durationMs,
      configSha256: mediaConfigFingerprint(event.media),
      sha256: await sha256File(sourcePath),
    };
  }));
}

export async function productionManifest(timeline) {
  if (!timeline.production) return null;
  const background = timeline.production.background
    ? {
        source: timeline.production.background,
        sha256: await sha256File(resolveAssetSourcePath(timeline.production.background)),
      }
    : null;
  return {
    theme: timeline.production.theme,
    background,
  };
}

export async function manifestMatchesProduction(manifest, timeline) {
  if (!timeline.production) return manifest?.production === null || manifest?.production === undefined;
  const expected = await productionManifest(timeline);
  return JSON.stringify(manifest?.production) === JSON.stringify(expected);
}

export async function inspectProductionAssets(timeline) {
  const background = timeline.production?.background;
  if (!background) return [];
  const sourcePath = resolveAssetSourcePath(background);
  return [{
    source: background,
    exists: await fileExists(sourcePath),
  }];
}

export async function manifestMatchesMedia(manifest, timeline) {
  const expected = mediaEvents(timeline);
  if (!Array.isArray(manifest?.media) || manifest.media.length !== expected.length) return false;

  for (let index = 0; index < expected.length; index += 1) {
    const event = expected[index];
    const entry = manifest.media[index];
    const sourcePath = resolveMediaSourcePath(event.media.source);
    if (entry.source !== event.media.source) return false;
    if (entry.startMs !== event.startMs || entry.sourceOffsetMs !== event.media.sourceOffsetMs || entry.durationMs !== event.durationMs) return false;
    if (entry.configSha256 !== mediaConfigFingerprint(event.media)) return false;
    if (entry.sha256 !== await sha256File(sourcePath)) return false;
  }
  return true;
}

export async function inspectMediaSources(timeline, options = {}) {
  const results = [];
  for (const event of mediaEvents(timeline)) {
    const sourcePath = resolveMediaSourcePath(event.media.source);
    const exists = await fileExists(sourcePath);
    if (!exists) {
      results.push({ source: event.media.source, exists: false, probe: "not-run", windowValid: false });
      continue;
    }

    try {
      const durationMs = await probeDurationMs(sourcePath, options.ffprobeCommand);
      results.push({
        source: event.media.source,
        exists: true,
        probe: "available",
        durationMs,
        windowValid: event.media.sourceOffsetMs + event.durationMs <= durationMs + 1,
      });
    } catch (error) {
      if (error.code === "ENOENT") {
        results.push({ source: event.media.source, exists: true, probe: "unavailable", windowValid: null });
        continue;
      }
      results.push({ source: event.media.source, exists: true, probe: "failed", windowValid: false, error: error.message });
    }
  }
  return results;
}

export function resolveMediaSourcePath(source) {
  return path.resolve(PROJECT_ROOT, validateAssetSource(source, {
    label: "media source",
    extensions: [".mp4"],
    extensionMessage: "media sources must be MP4 files",
  }));
}

export function resolveAssetSourcePath(source) {
  return path.resolve(PROJECT_ROOT, validateAssetSource(source, {
    label: "asset source",
    extensions: [".png", ".jpg", ".jpeg", ".webp"],
    extensionMessage: "asset source must be a PNG, JPEG, or WebP file",
  }));
}

function probeDurationMs(filePath, command = "ffprobe") {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ], {
      cwd: PROJECT_ROOT,
      stdio: ["ignore", "pipe", "ignore"],
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
      const durationMs = Number(stdout.trim()) * 1000;
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        reject(new Error("ffprobe returned an invalid media duration"));
        return;
      }
      resolve(durationMs);
    });
  });
}

function nonnegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative integer`);
  return value;
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
  return value;
}

async function fileExists(filePath) {
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
