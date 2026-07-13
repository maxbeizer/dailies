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
      width: 1px;
      height: 1px;
      opacity: 0;
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
  </style>
</head>
<body>
  <main id="stage" data-dailies-set="${setName}" aria-label="Dailies media studio">
    <section class="studio">
      <div class="workbench">
        <article class="surface editor" data-surface="editor">
          <div class="surface-header"><span>Scenario source</span><span>Dailies</span></div>
          <div id="editorText" class="surface-body"></div>
        </article>
        <article class="surface terminal" data-surface="terminal">
          <div class="surface-header"><span>Fixture commands</span><span>Offline</span></div>
          <div id="terminalText" class="surface-body"></div>
        </article>
      </div>
      <article class="monitor-shell" data-surface="media">
        <div class="monitor-header"><span>Program monitor</span><span id="monitorStatus">Standby</span></div>
        <div class="monitor">
          <div id="standby" class="standby">Waiting for declared media</div>
          <video id="mediaSource" muted playsinline preload="auto"></video>
          <canvas id="mediaMonitor" width="1280" height="720"></canvas>
          <div id="mediaCaption" class="caption"></div>
        </div>
      </article>
    </section>
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
    const params = new URLSearchParams(location.search);
    const durationMs = Math.max(timeline.durationMs || 1, 1);
    const mediaEvents = (timeline.events || []).filter((event) => event.surface === "media");
    let loadedSource = "";
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

    function mediaOpacity(event, timeMs) {
      if (!event || event.media.transition !== "fade" || !event.media.fadeMs) return event ? 1 : 0;
      const elapsed = timeMs - event.startMs;
      const remaining = event.startMs + event.durationMs - timeMs;
      return Math.max(0, Math.min(1, elapsed / event.media.fadeMs, remaining / event.media.fadeMs));
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
      terminalText.textContent = state.terminalEntries.map((entry) => (entry.kind === "command" ? "$ " : "") + entry.text).join("\\n\\n");
      const event = activeMediaEvent(boundedMs);
      ensureSource(event);
      const opacity = mediaOpacity(event, boundedMs);
      mediaMonitor.style.opacity = String(opacity);
      standby.style.opacity = event ? "0" : "1";
      monitorStatus.textContent = event ? "Playing declared fixture" : "Standby";
      mediaCaption.textContent = event?.media.caption || "";
      mediaCaption.style.opacity = event?.media.caption ? String(opacity) : "0";
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
      if (Math.abs(mediaSource.currentTime - targetSeconds) > 0.005) {
        const seeked = waitForEvent(mediaSource, "seeked");
        mediaSource.currentTime = targetSeconds;
        await seeked;
      }
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      drawMediaFrame(event);
    }

    function drawMediaFrame(event) {
      const sourceWidth = mediaSource.videoWidth;
      const sourceHeight = mediaSource.videoHeight;
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
      mediaContext.drawImage(mediaSource, x, y, width, height);
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

    window.__dailiesPrepareFrame = async (timeMs) => {
      currentMs = clamp(timeMs, 0, durationMs);
      startedAtMs = currentMs;
      startTimestamp = 0;
      playing = false;
      const event = draw(currentMs);
      await seekMedia(event, currentMs);
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
