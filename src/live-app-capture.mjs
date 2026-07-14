import { access, lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOP_LEVEL_FIELDS = new Set([
  "version",
  "id",
  "platform",
  "app",
  "director",
  "output",
  "durationMs",
  "capture",
  "setup",
  "actions",
  "teardown",
]);

export async function loadLiveAppCapture(sourcePath, options = {}) {
  const source = await readFile(sourcePath, "utf8");
  let data;
  try {
    data = JSON.parse(source);
  } catch {
    throw new Error("live app capture must contain valid JSON");
  }
  return validateLiveAppCapture(data, options);
}

export async function validateLiveAppCapture(data, options = {}) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("live app capture must be an object");
  }
  rejectUnsupportedFields(data, TOP_LEVEL_FIELDS, "live app capture");

  if (data.version !== 1) throw new Error("live app capture version must be 1");
  if (data.platform !== "macos") throw new Error("live app capture platform must be macos");
  const id = identifier(data.id, "live app capture id");
  const durationMs = positiveInteger(data.durationMs, "live app capture durationMs");
  const app = validateApp(data.app);
  const projectRoot = path.resolve(options.projectRoot || PROJECT_ROOT);
  const allowedBundleIds = await loadAllowedBundleIds(projectRoot, options.allowlistPath);
  if (!allowedBundleIds.has(app.bundleId)) {
    throw new Error(`app bundle ID is not allowlisted: ${app.bundleId}`);
  }

  const director = validateRepositoryFile(data.director, {
    projectRoot,
    label: "director",
    extension: ".applescript",
    extensionMessage: "director must be an AppleScript file",
  });
  const output = await validateCaptureOutput(data.output, projectRoot);
  const capture = data.capture === undefined ? null : validateCapture(data.capture);

  const setup = validateInvocations(data.setup, "setup");
  const actions = validateTimedActions(data.actions, durationMs);
  const teardown = validateInvocations(data.teardown, "teardown");
  const directorPath = path.resolve(projectRoot, director);
  if (!await fileExists(directorPath)) throw new Error("director does not exist");
  const [realProjectRoot, realDirectorPath] = await Promise.all([
    realpath(projectRoot),
    realpath(directorPath),
  ]);
  const realDirectorRelative = path.relative(realProjectRoot, realDirectorPath);
  if (realDirectorRelative.startsWith("..") || path.isAbsolute(realDirectorRelative)) {
    throw new Error("director must resolve inside the repository");
  }
  const directorSource = await readFile(realDirectorPath, "utf8");
  if (/\bdo\s+shell\s+script\b/i.test(directorSource)) {
    throw new Error("director must not contain do shell script");
  }
  if (usesSystemEvents(directorSource)) {
    throw new Error("director must not use System Events in v1");
  }

  return {
    version: 1,
    id,
    platform: "macos",
    app,
    director,
    output,
    durationMs,
    ...(capture ? { capture } : {}),
    setup,
    actions,
    teardown,
  };
}

function validateCapture(capture) {
  if (!capture || typeof capture !== "object" || Array.isArray(capture)) {
    throw new Error("capture must be an object");
  }
  rejectUnsupportedFields(capture, new Set(["region", "framesPerSecond"]), "capture");
  const region = capture.region;
  if (!region || typeof region !== "object" || Array.isArray(region)) {
    throw new Error("capture region must be an object");
  }
  rejectUnsupportedFields(region, new Set(["x", "y", "width", "height"]), "capture region");
  return {
    region: {
      x: nonnegativeInteger(region.x, "capture region x"),
      y: nonnegativeInteger(region.y, "capture region y"),
      width: positiveInteger(region.width, "capture region width"),
      height: positiveInteger(region.height, "capture region height"),
    },
    framesPerSecond: positiveInteger(capture.framesPerSecond, "capture framesPerSecond"),
  };
}

function usesSystemEvents(source) {
  return /\btell\s+(?:application|app)\s+"System Events"/i.test(source)
    || /\btell\s+(?:application|app)\s+id\s+"com\.apple\.systemevents"/i.test(source);
}

function validateApp(app) {
  if (!app || typeof app !== "object" || Array.isArray(app)) {
    throw new Error("app must be an object");
  }
  rejectUnsupportedFields(app, new Set(["bundleId"]), "app");
  if (typeof app.bundleId !== "string" || !/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(app.bundleId)) {
    throw new Error("app bundleId must be a reverse-DNS identifier");
  }
  return { bundleId: app.bundleId };
}

function validateInvocations(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((invocation, index) => {
    if (!invocation || typeof invocation !== "object" || Array.isArray(invocation)) {
      throw new Error(`${label} ${index + 1} must be an object`);
    }
    rejectUnsupportedFields(invocation, new Set(["action", "timeoutMs"]), `${label} ${index + 1}`);
    return {
      action: identifier(invocation.action, `${label} ${index + 1} action`),
      timeoutMs: positiveInteger(invocation.timeoutMs, `${label} ${index + 1} timeoutMs`),
    };
  });
}

function validateTimedActions(value, durationMs) {
  if (!Array.isArray(value)) throw new Error("actions must be an array");
  let previousAtMs = -1;
  return value.map((action, index) => {
    if (!action || typeof action !== "object" || Array.isArray(action)) {
      throw new Error(`action ${index + 1} must be an object`);
    }
    rejectUnsupportedFields(action, new Set(["atMs", "action", "timeoutMs"]), `action ${index + 1}`);
    const atMs = nonnegativeInteger(action.atMs, `action ${index + 1} atMs`);
    if (atMs <= previousAtMs) throw new Error("actions must be ordered by atMs without ties");
    if (atMs >= durationMs) throw new Error(`action ${index + 1} atMs must be before durationMs`);
    previousAtMs = atMs;
    return {
      atMs,
      action: identifier(action.action, `action ${index + 1} action`),
      timeoutMs: positiveInteger(action.timeoutMs, `action ${index + 1} timeoutMs`),
    };
  });
}

function validateRepositoryFile(source, options) {
  const { projectRoot, label, extension, extensionMessage } = options;
  if (typeof source !== "string" || !source.trim()) throw new Error(`${label} is required`);
  if (path.isAbsolute(source)) throw new Error(`${label} must be relative`);

  const normalized = source.replaceAll("\\", "/");
  const resolved = path.resolve(projectRoot, normalized);
  const relative = path.relative(projectRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative) || relative === "") {
    throw new Error(`${label} must stay inside the repository`);
  }
  if (path.extname(normalized).toLowerCase() !== extension) throw new Error(extensionMessage);
  return relative.split(path.sep).join("/");
}

async function validateCaptureOutput(source, projectRoot) {
  if (typeof source !== "string" || !source.trim()) {
    throw new Error("live app capture output is required");
  }
  if (path.isAbsolute(source)) {
    throw new Error("live app capture output must be relative");
  }

  const normalized = source.replaceAll("\\", "/");
  const resolved = path.resolve(projectRoot, normalized);
  const capturesRoot = path.join(projectRoot, "assets", "captures");
  const relative = path.relative(capturesRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative) || relative === "") {
    throw new Error("live app capture output must stay under assets/captures/");
  }
  if (path.extname(normalized).toLowerCase() !== ".mp4") {
    throw new Error("live app capture output must be an MP4 file");
  }
  await rejectSymlinkComponents(resolved, projectRoot, "live app capture output");
  return path.relative(projectRoot, resolved).split(path.sep).join("/");
}

async function rejectSymlinkComponents(targetPath, projectRoot, label) {
  const relative = path.relative(projectRoot, targetPath);
  let current = projectRoot;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new Error(`${label} path must not contain symbolic links`);
      }
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
  }
}

async function loadAllowedBundleIds(projectRoot, configuredPath) {
  const allowlistPath = configuredPath
    ? path.resolve(projectRoot, configuredPath)
    : path.join(projectRoot, "spec", "live-app-capture-allowlist.json");
  let data;
  try {
    data = JSON.parse(await readFile(allowlistPath, "utf8"));
  } catch {
    throw new Error("live app capture allowlist must contain valid JSON");
  }
  if (data.version !== 1 || !Array.isArray(data.allowedBundleIds) || data.allowedBundleIds.length === 0) {
    throw new Error("live app capture allowlist must define version 1 allowedBundleIds");
  }
  return new Set(data.allowedBundleIds);
}

function rejectUnsupportedFields(value, allowed, label) {
  const unsupported = Object.keys(value).find((key) => !allowed.has(key));
  if (unsupported) throw new Error(`${label} has unsupported field ${unsupported}`);
}

function identifier(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9-]*$/.test(value)) {
    throw new Error(`${label} must be an identifier`);
  }
  return value;
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
