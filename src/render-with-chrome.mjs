import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function renderWithChrome(options) {
  const chromePath = options.chromePath || process.env.CHROME_PATH || DEFAULT_CHROME_PATH;
  const captureFps = positiveInteger(process.env.DAILIES_CHROME_FPS, 12);
  const workspace = await mkdtemp(path.join(tmpdir(), "dailies-chrome-"));
  const frameDir = path.join(workspace, "frames");
  const profileDir = path.join(workspace, "profile");
  const port = await availablePort();
  const frameCount = Math.max(1, Math.ceil(options.durationSeconds * captureFps));
  const mediaCaptures = await prepareMediaCaptures(options.timeline, workspace, captureFps);
  let browser;
  let cdp;

  await mkdir(frameDir, { recursive: true });
  await mkdir(profileDir, { recursive: true });

  try {
    browser = launchChrome(chromePath, port, profileDir, options.url);
    const target = await waitForPageTarget(port, options.url);
    cdp = await connectCdp(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: options.width,
      height: options.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await waitForPreviewReady(cdp);

    for (let index = 0; index < frameCount; index += 1) {
      const timeMs = Math.min(options.durationSeconds * 1000, (index / captureFps) * 1000);
      const mediaFrame = await mediaFrameDataAt(mediaCaptures, timeMs, captureFps);
      await drawAt(cdp, timeMs, mediaFrame);
      const screenshot = await cdp.send("Page.captureScreenshot", {
        format: "jpeg",
        quality: 92,
        fromSurface: true,
        captureBeyondViewport: false,
      });
      const framePath = path.join(frameDir, `frame-${String(index).padStart(6, "0")}.jpg`);
      await writeFile(framePath, Buffer.from(screenshot.data, "base64"));

      if (index > 0 && index % (captureFps * 10) === 0) {
        console.log(`chrome capture ${Math.round(index / captureFps)}s / ${Math.ceil(options.durationSeconds)}s`);
      }
    }

    await encodeFrames(frameDir, options.outputPath, captureFps, options.durationSeconds);
  } finally {
    cdp?.close();
    if (browser && browser.exitCode === null) {
      browser.kill("SIGTERM");
      await waitForExit(browser);
    }
    await rm(workspace, { recursive: true, force: true });
  }
}

export function mediaFrameRequestAt(timeline, timeMs, captureFps) {
  const mediaEvents = (timeline?.events || []).filter((event) => event.surface === "media");
  const eventIndex = mediaEvents.findIndex((event) => timeMs >= event.startMs && timeMs < event.startMs + event.durationMs);
  if (eventIndex === -1) return null;
  const event = mediaEvents[eventIndex];
  const elapsedMs = timeMs - event.startMs;
  return {
    eventIndex,
    frameNumber: Math.floor((elapsedMs / 1000) * captureFps) + 1,
    sourceTimeMs: event.media.sourceOffsetMs + elapsedMs,
  };
}

export function clampMediaFrameNumber(frameNumber, extractedFrameCount) {
  if (!Number.isInteger(extractedFrameCount) || extractedFrameCount < 1) {
    throw new Error("media extraction produced no frames");
  }
  return Math.max(1, Math.min(frameNumber, extractedFrameCount));
}

async function prepareMediaCaptures(timeline, workspace, captureFps) {
  const mediaEvents = (timeline?.events || []).filter((event) => event.surface === "media");
  const captures = [];
  for (let eventIndex = 0; eventIndex < mediaEvents.length; eventIndex += 1) {
    const event = mediaEvents[eventIndex];
    const frameDir = path.join(workspace, `media-${eventIndex}`);
    await mkdir(frameDir, { recursive: true });
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      path.join(PROJECT_ROOT, event.media.source),
      "-ss",
      String(event.media.sourceOffsetMs / 1000),
      "-t",
      String(event.durationMs / 1000),
      "-vf",
      `fps=${captureFps}`,
      "-q:v",
      "2",
      path.join(frameDir, "frame-%06d.jpg"),
    ]);
    const frameFiles = (await readdir(frameDir))
      .filter((file) => /^frame-\d{6}\.jpg$/.test(file))
      .sort();
    if (frameFiles.length === 0) {
      throw new Error(`media extraction produced no frames for ${event.media.source}`);
    }
    captures.push({ event, frameDir, frameFiles });
  }
  return captures;
}

async function mediaFrameDataAt(captures, timeMs, captureFps) {
  const timeline = { events: captures.map((capture) => capture.event) };
  const request = mediaFrameRequestAt(timeline, timeMs, captureFps);
  if (!request) return null;
  const capture = captures[request.eventIndex];
  const frameNumber = clampMediaFrameNumber(request.frameNumber, capture.frameFiles.length);
  const framePath = path.join(capture.frameDir, capture.frameFiles[frameNumber - 1]);
  return {
    dataUrl: `data:image/jpeg;base64,${(await readFile(framePath)).toString("base64")}`,
    sourceTimeMs: request.sourceTimeMs,
  };
}

function launchChrome(chromePath, port, profileDir, url) {
  const child = spawn(chromePath, [
    "--headless=new",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-dev-shm-usage",
    "--disable-features=Translate,MediaRouter",
    "--disable-gpu",
    "--disable-renderer-backgrounding",
    "--hide-scrollbars",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-default-browser-check",
    "--no-first-run",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "--window-size=1280,720",
    url,
  ], {
    stdio: ["ignore", "ignore", "pipe"],
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-12000);
  });
  child.completion = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0 || signal === "SIGTERM") {
        resolve();
      } else {
        reject(new Error(`Chrome exited with ${code}: ${stderr.trim()}`));
      }
    });
  });
  return child;
}

async function waitForPageTarget(port, expectedUrl) {
  let lastError;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === "page"
          && target.webSocketDebuggerUrl
          && target.url === expectedUrl)
          || targets.find((target) => target.type === "page"
            && target.webSocketDebuggerUrl
            && target.url.startsWith(expectedUrl.split("?")[0]))
          || targets.find((target) => target.type === "page"
            && target.webSocketDebuggerUrl
            && !target.url.startsWith("chrome://"));
        if (page) return page;
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`Chrome DevTools target did not become ready${lastError ? `: ${lastError.message}` : ""}`);
}

async function connectCdp(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject, timeout } = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(timeout);
    if (message.error) {
      reject(new Error(`${message.error.message}${message.error.data ? `: ${message.error.data}` : ""}`));
    } else {
      resolve(message.result || {});
    }
  });

  let failure = null;
  const rejectPending = (error) => {
    if (failure) return;
    failure = error;
    for (const { reject, timeout } of pending.values()) {
      clearTimeout(timeout);
      reject(error);
    }
    pending.clear();
  };
  socket.addEventListener("close", () => rejectPending(new Error("Chrome DevTools connection closed")));
  socket.addEventListener("error", () => rejectPending(new Error("Chrome DevTools connection failed")));

  return {
    send(method, params = {}) {
      if (failure) return Promise.reject(failure);
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Chrome DevTools command timed out: ${method}`));
        }, 30000);
        pending.set(id, { resolve, reject, timeout });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    },
  };
}

async function waitForPreviewReady(cdp) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await cdp.send("Runtime.evaluate", {
      expression: `document.readyState === "complete" && typeof draw === "function"`,
      returnByValue: true,
    });
    if (result.result?.value === true) {
      await cdp.send("Runtime.evaluate", {
        expression: `(() => {
          const style = document.createElement("style");
          style.dataset.dailiesCapture = "true";
          style.textContent = "* { transition: none !important; }";
          document.head.appendChild(style);
          window.__dailiesCaptureAnimations = new WeakSet();
          return true;
        })()`,
        returnByValue: true,
      });
      return;
    }
    await sleep(100);
  }
  throw new Error("Dailies preview did not expose its draw function");
}

async function drawAt(cdp, timeMs, mediaFrame) {
  const injectedFrame = mediaFrame
    ? `await window.__dailiesSetMediaFrame(${JSON.stringify(mediaFrame.dataUrl)}, ${Math.round(mediaFrame.sourceTimeMs)});`
    : "window.__dailiesInjectedMediaFrame = null;";
  const result = await cdp.send("Runtime.evaluate", {
    expression: `(async () => {
      currentMs = ${Math.round(timeMs)};
      startedAtMs = currentMs;
      startTimestamp = 0;
      playing = false;
      ${injectedFrame}
      if (typeof window.__dailiesPrepareFrame === "function") {
        await window.__dailiesPrepareFrame(currentMs);
      } else {
        draw(currentMs);
      }
      for (const animation of document.getAnimations()) {
        if (animation.playState !== "paused" || window.__dailiesCaptureAnimations.has(animation)) {
          window.__dailiesCaptureAnimations.add(animation);
          animation.pause();
          animation.currentTime = currentMs;
        }
      }
      await new Promise((resolve) => requestAnimationFrame(() => resolve(true)));
      return true;
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "failed to draw Dailies frame");
  }
}

function encodeFrames(frameDir, outputPath, captureFps, durationSeconds) {
  return run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-framerate",
    String(captureFps),
    "-start_number",
    "0",
    "-i",
    path.join(frameDir, "frame-%06d.jpg"),
    "-vf",
    "fps=30,format=yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-movflags",
    "+faststart",
    "-t",
    String(durationSeconds),
    outputPath,
  ]);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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

function availablePort() {
  const server = createNetServer();
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForExit(child) {
  try {
    await Promise.race([
      child.completion,
      sleep(3000),
    ]);
  } catch {
    return;
  }
}
