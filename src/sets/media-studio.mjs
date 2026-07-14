import { RENDER_STATE_BROWSER_SCRIPT } from "../render-state.mjs";

export function renderStudioMonitorHtml(timeline) {
  return renderMediaStudioHtml(timeline, "studio-monitor");
}

export function renderFullScreenMediaHtml(timeline) {
  return renderMediaStudioHtml(timeline, "full-screen-media");
}

function renderMediaStudioHtml(timeline, setName) {
  const timelineJson = safeScriptJson(timeline);
  const title = escapeHtml(timeline.title || "Dailies studio");
  const fullScreen = setName === "full-screen-media";
  const background = timeline.production?.background ? `url("/${escapeCssUrl(timeline.production.background)}")` : "none";
  const theme = timeline.production?.theme || "dark";

  return `<!doctype html>
<html lang="en" data-dailies-preview="true">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: dark;
      --ink: ${theme === "light" ? "#172033" : "#eef7ff"};
      --muted: ${theme === "light" ? "#536079" : "#9fb0c3"};
      --panel: ${theme === "light" ? "rgba(245, 247, 251, 0.94)" : "rgba(8, 16, 29, 0.91)"};
      --line: ${theme === "light" ? "rgba(31, 41, 55, 0.16)" : "rgba(148, 163, 184, 0.2)"};
      --accent: ${theme === "cinema" ? "#f7c873" : "#48c6ef"};
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      overflow: hidden;
      color: var(--ink);
      background: #02050a;
    }
    #stage {
      width: 1280px;
      height: 720px;
      position: relative;
      overflow: hidden;
      padding: 28px;
      display: grid;
      grid-template-rows: minmax(0, 1fr) 7px;
      gap: 16px;
      background:
        linear-gradient(135deg, rgba(3, 8, 17, 0.82), rgba(11, 22, 38, 0.9)),
        ${background},
        radial-gradient(circle at 68% 18%, rgba(72, 198, 239, 0.16), transparent 34%),
        #050a12;
      background-position: center;
      background-size: cover;
    }
    .studio {
      min-height: 0;
      display: ${fullScreen ? "block" : "grid"};
      grid-template-columns: 0.72fr 1.28fr;
      gap: 22px;
    }
    .workbench {
      display: ${fullScreen ? "none" : "grid"};
      grid-template-rows: 0.8fr 1.2fr;
      gap: 16px;
      min-height: 0;
    }
    .surface,
    .monitor-shell {
      min-height: 0;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: var(--panel);
      box-shadow: 0 24px 68px rgba(0, 0, 0, 0.34);
    }
    .surface-header,
    .monitor-header {
      height: 31px;
      padding: 0 13px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--line);
      color: var(--muted);
      font-size: 10px;
      font-weight: 850;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .surface-body {
      height: calc(100% - 31px);
      padding: 16px;
      overflow: hidden;
      white-space: pre-wrap;
      font: 14px/1.45 "SF Mono", ui-monospace, Menlo, Consolas, monospace;
    }
    .terminal .surface-body { color: #b8f7d4; background: rgba(2, 6, 13, 0.58); }
    .monitor-shell {
      height: 100%;
      display: grid;
      grid-template-rows: 31px minmax(0, 1fr);
      border-radius: ${fullScreen ? "24px" : "22px"};
    }
    .monitor {
      position: relative;
      min-height: 0;
      width: 100%;
      height: auto;
      aspect-ratio: 16 / 9;
      align-self: center;
      display: grid;
      place-items: center;
      overflow: hidden;
      background:
        linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px),
        #02050a;
      background-size: 32px 32px;
    }
    #mediaMonitor {
      width: 100%;
      height: 100%;
      display: block;
      opacity: 0;
      background: black;
    }
    #mediaSource {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0.001;
      pointer-events: none;
    }
    .standby {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--muted);
      font-size: 13px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .caption {
      position: absolute;
      left: 28px;
      right: 28px;
      bottom: 24px;
      padding: 13px 17px;
      border-left: 3px solid var(--accent);
      background: rgba(2, 6, 13, 0.82);
      color: #f8fbff;
      font-size: 18px;
      font-weight: 760;
      opacity: 0;
    }
    .cue {
      position: absolute;
      top: 54px;
      right: 54px;
      max-width: 490px;
      padding: 12px 16px;
      border: 1px solid rgba(247, 200, 115, 0.3);
      border-radius: 13px;
      background: rgba(2, 6, 13, 0.86);
      color: #fff4dc;
      opacity: 0;
    }
    .cue.visible { opacity: 1; }
    .timeline {
      height: 7px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.17);
    }
    #timelineFill {
      width: 0;
      height: 100%;
      background: linear-gradient(90deg, #8b5cf6, var(--accent), #34d399);
    }
    .controls {
      position: fixed;
      left: 50%;
      bottom: 14px;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(2, 6, 13, 0.82);
    }
    .controls.hidden { display: none; }
    button {
      border: 0;
      border-radius: 999px;
      padding: 8px 13px;
      color: #03111c;
      background: var(--accent);
      font-weight: 850;
    }
    input[type="range"] { width: 420px; }

    .menu-bar,
    .desktop-strip,
    .monitor-transport {
      display: none;
    }

    body.theme-macintosh {
      color: #000;
      background:
        linear-gradient(45deg, #8c8c8c 25%, transparent 25%, transparent 75%, #8c8c8c 75%),
        linear-gradient(45deg, #8c8c8c 25%, #b8b8b8 25%, #b8b8b8 75%, #8c8c8c 75%);
      background-position: 0 0, 2px 2px;
      background-size: 4px 4px;
      font-family: Geneva, "Helvetica Neue", Helvetica, Arial, sans-serif;
    }

    #stage.theme-macintosh {
      padding: 0;
      grid-template-rows: 24px minmax(0, 1fr) 28px 10px;
      gap: 0;
      color: #000;
      background: #bdbdbd;
      border: 2px solid #000;
      box-shadow: 8px 8px 0 #000;
    }

    .theme-macintosh .menu-bar {
      display: flex;
      align-items: center;
      gap: 18px;
      padding: 0 10px;
      border-bottom: 2px solid #000;
      background: #fff;
      font-size: 13px;
      font-weight: 700;
      line-height: 22px;
    }

    .theme-macintosh .system-mark {
      font-weight: 900;
      font-size: 11px;
    }

    .theme-macintosh .studio {
      min-height: 0;
      grid-template-columns: 392px minmax(0, 1fr);
      gap: 18px;
      padding: 16px 18px 12px;
      background:
        linear-gradient(45deg, rgba(0, 0, 0, 0.07) 25%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.07) 75%),
        #bdbdbd;
      background-position: 0 0, 2px 2px;
      background-size: 4px 4px;
    }

    .theme-macintosh .workbench {
      grid-template-rows: 1fr 1fr;
      gap: 14px;
    }

    .theme-macintosh .surface,
    .theme-macintosh .monitor-shell {
      border: 2px solid #000;
      border-radius: 0;
      background: #fff;
      box-shadow: 5px 5px 0 #000;
      transition: transform 120ms steps(2), box-shadow 120ms steps(2);
    }

    .theme-macintosh .surface.active-window,
    .theme-macintosh .monitor-shell.active-window {
      transform: translate(-2px, -2px);
      box-shadow: 7px 7px 0 #000;
    }

    .theme-macintosh .surface-header,
    .theme-macintosh .monitor-header {
      position: relative;
      height: 27px;
      padding: 0 28px;
      justify-content: center;
      color: #000;
      border-bottom: 2px solid #000;
      background: repeating-linear-gradient(to bottom, #000 0 1px, #fff 1px 3px);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0;
      text-transform: none;
    }

    .theme-macintosh .window-title {
      padding: 1px 7px 2px;
      background: #fff;
    }

    .theme-macintosh .window-control {
      position: absolute;
      left: 6px;
      top: 6px;
      width: 13px;
      height: 13px;
      padding: 0;
      border: 1px solid #000;
      background: #fff;
      box-shadow: inset 0 0 0 2px #d8d8d8;
    }

    .theme-macintosh .surface-body {
      height: calc(100% - 27px);
      padding: 14px 15px;
      color: #000;
      background: #fff;
      font: 13px/1.42 Monaco, "SF Mono", ui-monospace, monospace;
    }

    .theme-macintosh .terminal .surface-body {
      color: #000;
      background:
        linear-gradient(90deg, transparent 0 15px, rgba(0,0,0,0.08) 15px 16px, transparent 16px),
        #fff;
    }

    .theme-macintosh .monitor-shell {
      grid-template-rows: 27px minmax(0, 1fr) 34px;
      padding: 0;
    }

    .theme-macintosh .monitor {
      width: calc(100% - 22px);
      border: 2px solid #000;
      background: #000;
      box-shadow: inset 0 0 0 3px #fff;
    }

    .theme-macintosh .monitor-transport {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      gap: 10px;
      align-items: center;
      padding: 0 10px;
      border-top: 2px solid #000;
      background: #dedede;
      font: 11px Monaco, "SF Mono", monospace;
    }

    .theme-macintosh .transport-button {
      width: 18px;
      height: 18px;
      display: grid;
      place-items: center;
      border: 1px solid #000;
      background: #fff;
      box-shadow: 1px 1px 0 #000;
      font-size: 9px;
    }

    .theme-macintosh .transport-track {
      position: relative;
      overflow: hidden;
      height: 8px;
      border: 1px solid #000;
      background: #fff;
    }

    .theme-macintosh .transport-fill {
      display: block;
      width: 0;
      height: 100%;
      background: repeating-linear-gradient(90deg, #000 0 2px, #fff 2px 5px);
    }

    .theme-macintosh .standby {
      color: #fff;
      font: 12px Monaco, "SF Mono", monospace;
      letter-spacing: 0;
      text-transform: none;
    }

    .theme-macintosh .caption {
      left: 14px;
      right: 14px;
      bottom: 12px;
      padding: 8px 10px;
      border: 2px solid #000;
      border-left-width: 8px;
      border-radius: 0;
      background: #fff;
      color: #000;
      box-shadow: 3px 3px 0 #000;
      font: 700 14px/1.3 Geneva, "Helvetica Neue", sans-serif;
    }

    .theme-macintosh .cue {
      top: 46px;
      right: 38px;
      max-width: 430px;
      padding: 12px 15px;
      border: 2px solid #000;
      border-radius: 0;
      background: #fff;
      color: #000;
      box-shadow: 5px 5px 0 #000;
      font: 700 13px/1.35 Geneva, "Helvetica Neue", sans-serif;
    }

    .theme-macintosh .desktop-strip {
      display: flex;
      align-items: center;
      gap: 18px;
      padding: 0 18px;
      border-top: 2px solid #000;
      background: #bdbdbd;
      font-size: 11px;
      font-weight: 800;
    }

    .theme-macintosh .desktop-icon::before {
      content: "";
      display: inline-block;
      width: 12px;
      height: 10px;
      margin-right: 6px;
      vertical-align: -1px;
      border: 1px solid #000;
      background: #fff;
      box-shadow: inset 0 3px 0 #000;
    }

    .theme-macintosh .timeline {
      height: 10px;
      border-radius: 0;
      border-top: 2px solid #000;
      background: #fff;
    }

    .theme-macintosh #timelineFill {
      background: repeating-linear-gradient(90deg, #000 0 6px, #fff 6px 9px);
    }

    body.theme-macintosh .controls {
      border: 2px solid #000;
      border-radius: 0;
      background: #fff;
      box-shadow: 4px 4px 0 #000;
    }

    body.theme-macintosh button {
      border: 1px solid #000;
      border-radius: 0;
      color: #000;
      background: #fff;
      box-shadow: 2px 2px 0 #000;
    }
  </style>
</head>
<body class="theme-${theme}">
  <main id="stage" class="theme-${theme}" data-dailies-set="${setName}" aria-label="Dailies media studio">
    <nav class="menu-bar" aria-label="Dailies Director menu">
      <span class="system-mark">◆</span>
      <span>File</span><span>Edit</span><span>View</span><span>Set</span><span>Render</span><span>Special</span>
    </nav>
    <section class="studio">
      <div class="workbench">
        <article class="surface editor" data-surface="editor">
          <div class="surface-header"><span class="window-control" aria-hidden="true"></span><span class="window-title">Scenario Source</span></div>
          <div id="editorText" class="surface-body"></div>
        </article>
        <article class="surface terminal" data-surface="terminal">
          <div class="surface-header"><span class="window-control" aria-hidden="true"></span><span class="window-title">Fixture Commands</span></div>
          <div id="terminalText" class="surface-body"></div>
        </article>
      </div>
      <article class="monitor-shell" data-surface="media">
        <div class="monitor-header"><span class="window-control" aria-hidden="true"></span><span class="window-title">Dailies Player</span></div>
        <div class="monitor">
          <div id="standby" class="standby">Program reel not loaded</div>
          <video id="mediaSource" muted playsinline preload="auto"></video>
          <canvas id="mediaMonitor" width="1280" height="720"></canvas>
          <div id="mediaCaption" class="caption"></div>
        </div>
        <div class="monitor-transport">
          <span class="transport-button">▶</span>
          <span class="transport-track" aria-hidden="true"><span id="transportFill" class="transport-fill"></span></span>
          <span id="monitorStatus">Standby</span>
          <span id="transportTime">00:00 / 00:00</span>
        </div>
      </article>
    </section>
    <div class="desktop-strip" aria-label="Production artifacts">
      <span class="desktop-icon">Scenario</span>
      <span class="desktop-icon">Timeline</span>
      <span class="desktop-icon">Audio</span>
      <span class="desktop-icon">Manifest</span>
      <span class="desktop-icon">Movie</span>
    </div>
    <aside id="cueCard" class="cue"></aside>
    <div class="timeline"><div id="timelineFill"></div></div>
  </main>
  <div id="controls" class="controls">
    <button id="playPause" type="button">Play</button>
    <input id="scrub" type="range" min="0" max="1000" value="0" aria-label="Scrub timeline">
    <button id="restart" type="button">Restart</button>
  </div>
  <script id="dailies-timeline" type="application/json">${timelineJson}</script>
  <script>
    ${RENDER_STATE_BROWSER_SCRIPT}

    const timeline = JSON.parse(document.getElementById("dailies-timeline").textContent);
    const editorText = document.getElementById("editorText");
    const terminalText = document.getElementById("terminalText");
    const mediaSource = document.getElementById("mediaSource");
    const mediaMonitor = document.getElementById("mediaMonitor");
    const mediaContext = mediaMonitor.getContext("2d");
    const mediaCaption = document.getElementById("mediaCaption");
    const monitorStatus = document.getElementById("monitorStatus");
    const standby = document.getElementById("standby");
    const cueCard = document.getElementById("cueCard");
    const timelineFill = document.getElementById("timelineFill");
    const playPause = document.getElementById("playPause");
    const restart = document.getElementById("restart");
    const scrub = document.getElementById("scrub");
    const controls = document.getElementById("controls");
    const editorWindow = document.querySelector(".surface.editor");
    const terminalWindow = document.querySelector(".surface.terminal");
    const monitorWindow = document.querySelector(".monitor-shell");
    const transportFill = document.getElementById("transportFill");
    const transportTime = document.getElementById("transportTime");
    const params = new URLSearchParams(location.search);
    const durationMs = Math.max(timeline.durationMs || 1, 1);
    const mediaEvents = (timeline.events || []).filter((event) => event.surface === "media");
    let loadedSource = "";
    let lastDecodedSourceTime = null;
    window.__dailiesInjectedMediaFrame = null;
    let interactiveSeek = null;
    let pendingInteractiveFrame = null;
    let playing = params.get("autoplay") === "1";
    let startTimestamp = 0;
    let startedAtMs = 0;
    let currentMs = Number(params.get("t") || 0);

    if (params.get("chrome") === "0") controls.classList.add("hidden");

    function activeMediaEvent(timeMs) {
      return mediaEvents.find((event) => timeMs >= event.startMs && timeMs < event.startMs + event.durationMs) || null;
    }

    function latestMediaEvent(timeMs) {
      return [...mediaEvents].reverse().find((event) => timeMs >= event.startMs) || null;
    }

    function mediaOpacity(event, timeMs) {
      if (!event || event.media.transition !== "fade" || !event.media.fadeMs) return event ? 1 : 0;
      const elapsed = timeMs - event.startMs;
      const remaining = event.startMs + event.durationMs - timeMs;
      return Math.max(0, Math.min(1, elapsed / event.media.fadeMs, remaining / event.media.fadeMs));
    }

    function formatTransportTime(timeMs) {
      const seconds = Math.floor(Math.max(0, timeMs) / 1000);
      return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
    }

    function mediaTransportState(event, activeEvent, timeMs) {
      if (!event) return { elapsedMs: 0, durationMs: 0, progress: 0 };
      const elapsedMs = activeEvent ? clamp(timeMs - event.startMs, 0, event.durationMs) : event.durationMs;
      return {
        elapsedMs,
        durationMs: event.durationMs,
        progress: event.durationMs > 0 ? elapsedMs / event.durationMs : 0,
      };
    }

    function ensureSource(event) {
      const source = event ? "/" + event.media.source : "";
      if (!source || loadedSource === source) return;
      loadedSource = source;
      mediaSource.src = source;
      mediaSource.load();
    }

    function draw(timeMs) {
      const boundedMs = clamp(timeMs, 0, durationMs);
      const state = renderDailiesState(timeline, boundedMs);
      editorText.textContent = state.editorText;
      editorText.scrollTop = editorText.scrollHeight;
      terminalText.textContent = state.terminalEntries.map((entry) => (entry.kind === "command" ? "$ " : "") + entry.text).join("\\n\\n");
      const event = activeMediaEvent(boundedMs);
      const displayedEvent = event || latestMediaEvent(boundedMs);
      ensureSource(displayedEvent);
      const opacity = event ? mediaOpacity(event, boundedMs) : (displayedEvent ? 1 : 0);
      mediaMonitor.style.opacity = String(opacity);
      standby.style.opacity = displayedEvent ? "0" : "1";
      monitorStatus.textContent = event
        ? (lastDecodedSourceTime === null ? "Loading frame" : "Source " + lastDecodedSourceTime.toFixed(2) + "s")
        : (displayedEvent ? "Hold" : "Standby");
      const transport = mediaTransportState(displayedEvent, event, boundedMs);
      if (transportFill) {
        transportFill.style.width = (transport.progress * 100).toFixed(2) + "%";
      }
      if (transportTime) {
        transportTime.textContent = formatTransportTime(transport.elapsedMs) + " / " + formatTransportTime(transport.durationMs);
      }
      editorWindow.classList.toggle("active-window", state.activeSurface === "editor");
      terminalWindow.classList.toggle("active-window", state.activeSurface === "terminal");
      monitorWindow.classList.toggle("active-window", Boolean(event));
      mediaCaption.textContent = displayedEvent?.media.caption || "";
      mediaCaption.style.opacity = displayedEvent?.media.caption ? String(opacity) : "0";
      if (state.audioCue) {
        cueCard.classList.add("visible");
        cueCard.textContent = (state.audioCue.cue.line || "Narrator") + ": " + (state.audioCue.cue.text || "");
      } else {
        cueCard.classList.remove("visible");
        cueCard.textContent = "";
      }
      timelineFill.style.width = (state.progress * 100).toFixed(2) + "%";
      scrub.value = String(Math.round(state.progress * 1000));
      playPause.textContent = playing ? "Pause" : "Play";
      return event;
    }

    function waitForEvent(target, name) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          target.removeEventListener(name, onEvent);
          reject(new Error("timed out waiting for video " + name));
        }, 10000);
        const onEvent = () => {
          clearTimeout(timeout);
          resolve();
        };
        target.addEventListener(name, onEvent, { once: true });
      });
    }

    async function seekMedia(event, timeMs) {
      if (!event) return;
      ensureSource(event);
      if (mediaSource.readyState < 1) await waitForEvent(mediaSource, "loadedmetadata");
      if (mediaSource.readyState < 2) await waitForEvent(mediaSource, "loadeddata");
      const requestedSeconds = (event.media.sourceOffsetMs + (timeMs - event.startMs)) / 1000;
      const maxSeconds = Math.max(0, (mediaSource.duration || requestedSeconds) - 0.001);
      const targetSeconds = Math.min(requestedSeconds, maxSeconds);
      let sought = false;
      if (Math.abs(mediaSource.currentTime - targetSeconds) > 0.005) {
        mediaSource.pause();
        mediaSource.currentTime = targetSeconds;
        sought = true;
      }
      if (sought && typeof mediaSource.requestVideoFrameCallback === "function") {
        await playDecodedFrame(event, targetSeconds);
      } else {
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const frame = await createImageBitmap(mediaSource);
        lastDecodedSourceTime = mediaSource.currentTime;
        drawMediaFrame(event, frame);
        frame.close();
      }
    }

    async function playDecodedFrame(event, targetSeconds) {
      await mediaSource.play();
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          mediaSource.pause();
          reject(new Error("timed out waiting for decoded video frame"));
        }, 5000);
        const onFrame = async (_now, metadata) => {
          if (metadata.mediaTime + 0.03 < targetSeconds) {
            mediaSource.requestVideoFrameCallback(onFrame);
            return;
          }
          try {
            const frame = await createImageBitmap(mediaSource);
            clearTimeout(timeout);
            lastDecodedSourceTime = metadata.mediaTime;
            drawMediaFrame(event, frame);
            frame.close();
            mediaSource.pause();
            resolve();
          } catch (error) {
            clearTimeout(timeout);
            mediaSource.pause();
            reject(error);
          }
        };
        mediaSource.requestVideoFrameCallback(onFrame);
      });
    }

    function drawMediaFrame(event, frame) {
      const sourceWidth = frame.width;
      const sourceHeight = frame.height;
      if (!sourceWidth || !sourceHeight) {
        throw new Error("decoded video frame has no dimensions");
      }
      const targetWidth = mediaMonitor.width;
      const targetHeight = mediaMonitor.height;
      const scale = event.media.fit === "cover"
        ? Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
        : Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
      const width = sourceWidth * scale;
      const height = sourceHeight * scale;
      const x = (targetWidth - width) / 2;
      const y = (targetHeight - height) / 2;
      mediaContext.fillStyle = "#000";
      mediaContext.fillRect(0, 0, targetWidth, targetHeight);
      mediaContext.drawImage(frame, x, y, width, height);
    }

    function scheduleInteractiveSeek(event, timeMs) {
      pendingInteractiveFrame = { event, timeMs };
      if (interactiveSeek) return;
      interactiveSeek = (async () => {
        while (pendingInteractiveFrame) {
          const next = pendingInteractiveFrame;
          pendingInteractiveFrame = null;
          await seekMedia(next.event, next.timeMs);
        }
      })()
        .catch((error) => {
          playing = false;
          console.error(error);
        })
        .finally(() => {
          interactiveSeek = null;
          if (pendingInteractiveFrame) scheduleInteractiveSeek(pendingInteractiveFrame.event, pendingInteractiveFrame.timeMs);
        });
    }

    window.__dailiesSetMediaFrame = (dataUrl, sourceTimeMs) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        window.__dailiesInjectedMediaFrame = { image, sourceTimeMs };
        resolve(true);
      };
      image.onerror = () => reject(new Error("failed to load injected media frame"));
      image.src = dataUrl;
    });

    window.__dailiesPrepareFrame = async (timeMs) => {
      currentMs = clamp(timeMs, 0, durationMs);
      startedAtMs = currentMs;
      startTimestamp = 0;
      playing = false;
      const event = draw(currentMs);
      const injected = window.__dailiesInjectedMediaFrame;
      window.__dailiesInjectedMediaFrame = null;
      if (event && injected) {
        lastDecodedSourceTime = injected.sourceTimeMs / 1000;
        drawMediaFrame(event, injected.image);
        monitorStatus.textContent = "Source " + lastDecodedSourceTime.toFixed(2) + "s";
      } else {
        await seekMedia(event, currentMs);
      }
      await new Promise((resolve) => requestAnimationFrame(() => resolve(true)));
      return true;
    };

    function tick(timestamp) {
      if (!startTimestamp) startTimestamp = timestamp;
      if (playing) {
        currentMs = startedAtMs + (timestamp - startTimestamp);
        if (currentMs >= durationMs) {
          currentMs = durationMs;
          playing = false;
        }
      }
      const event = draw(currentMs);
      if (event && playing) scheduleInteractiveSeek(event, currentMs);
      requestAnimationFrame(tick);
    }

    playPause.addEventListener("click", () => {
      playing = !playing;
      startTimestamp = 0;
      startedAtMs = currentMs;
    });
    restart.addEventListener("click", () => {
      currentMs = 0;
      startedAtMs = 0;
      startTimestamp = 0;
      playing = true;
    });
    scrub.addEventListener("input", () => {
      currentMs = (Number(scrub.value) / 1000) * durationMs;
      startedAtMs = currentMs;
      startTimestamp = 0;
      playing = false;
      void window.__dailiesPrepareFrame(currentMs);
    });

    draw(currentMs);
    requestAnimationFrame(tick);
  </script>
</body>
</html>
`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeCssUrl(value) {
  return String(value).replaceAll('"', "%22").replaceAll("'", "%27");
}

function safeScriptJson(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}
