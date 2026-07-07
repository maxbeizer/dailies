import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDemoMarkdown } from "./parse-demo.mjs";
import { compileTimeline, defaultTimelinePath, resolveArtifactOutputPath } from "./compile-timeline.mjs";
import { RENDER_STATE_BROWSER_SCRIPT } from "./render-state.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function defaultPreviewPath(sourcePath) {
  const relative = path.relative(PROJECT_ROOT, path.resolve(sourcePath));
  const withoutDemoSuffix = relative.replace(/\.demo\.md$/, "");
  if (withoutDemoSuffix.startsWith(`demos${path.sep}`)) {
    return path.join("artifacts", withoutDemoSuffix.slice(`demos${path.sep}`.length) + ".preview.html");
  }
  return path.join("artifacts", path.basename(withoutDemoSuffix) + ".preview.html");
}

export async function renderPreview(source) {
  const sourcePath = path.resolve(source);
  const markdown = await readFile(sourcePath, "utf8");
  const parsed = parseDemoMarkdown(sourcePath, markdown);
  const timeline = compileTimeline(parsed);
  const timelinePath = resolveArtifactOutputPath(parsed.frontmatter.timeline || defaultTimelinePath(sourcePath));
  const outputPath = resolveArtifactOutputPath(parsed.frontmatter.preview || defaultPreviewPath(sourcePath));

  await mkdir(path.dirname(timelinePath), { recursive: true });
  await writeFile(timelinePath, `${JSON.stringify(timeline, null, 2)}\n`);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, renderPreviewHtml(timeline), "utf8");

  return { outputPath, timelinePath, timeline };
}

export function renderPreviewHtml(timeline) {
  const timelineJson = safeScriptJson(timeline);
  const title = escapeHtml(timeline.title || "Dailies preview");

  return `<!doctype html>
<html lang="en" data-dailies-preview="true">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #080b12;
      --panel: #111827;
      --panel-2: #0d1320;
      --border: rgba(148, 163, 184, 0.22);
      --text: #e5edf7;
      --muted: #94a3b8;
      --violet: #a78bfa;
      --blue: #38bdf8;
      --amber: #f59e0b;
      --green: #34d399;
      --red: #f87171;
      --shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at 18% 12%, rgba(124, 58, 237, 0.24), transparent 32%),
        radial-gradient(circle at 82% 18%, rgba(56, 189, 248, 0.18), transparent 30%),
        linear-gradient(135deg, #05070d, var(--bg));
      color: var(--text);
    }

    #stage {
      width: 1280px;
      height: 720px;
      overflow: hidden;
      position: relative;
      background: linear-gradient(145deg, rgba(15, 23, 42, 0.96), rgba(3, 7, 18, 0.98));
      border: 1px solid rgba(148, 163, 184, 0.18);
      box-shadow: var(--shadow);
      padding: 34px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
      font-size: 14px;
      font-weight: 700;
    }

    .status-light {
      width: 13px;
      height: 13px;
      border-radius: 999px;
      background: var(--red);
      box-shadow: 0 0 24px rgba(248, 113, 113, 0.8);
    }

    .title {
      font-size: 22px;
      font-weight: 800;
      color: #f8fafc;
    }

    .surfaces {
      display: grid;
      grid-template-columns: 0.92fr 1.08fr;
      gap: 24px;
      height: 540px;
    }

    .surface {
      position: relative;
      min-width: 0;
      border: 1px solid var(--border);
      border-radius: 22px;
      background: rgba(15, 23, 42, 0.86);
      overflow: hidden;
      box-shadow: 0 16px 44px rgba(0, 0, 0, 0.22);
    }

    .surface.active {
      border-color: rgba(56, 189, 248, 0.58);
      box-shadow: 0 20px 60px rgba(56, 189, 248, 0.13);
    }

    .surface-header {
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 18px;
      background: rgba(2, 6, 23, 0.58);
      border-bottom: 1px solid var(--border);
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .dots {
      display: flex;
      gap: 7px;
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: #475569;
    }

    .dot:nth-child(1) { background: #f87171; }
    .dot:nth-child(2) { background: #fbbf24; }
    .dot:nth-child(3) { background: #34d399; }

    .editor-body,
    .terminal-body {
      padding: 22px;
      font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
      font-size: 18px;
      line-height: 1.44;
      white-space: pre-wrap;
      tab-size: 2;
    }

    .editor-body {
      color: #dbeafe;
    }

    .editor-body.typing::after,
    .terminal-line.command.active::after {
      content: " ";
      display: inline-block;
      width: 0.62em;
      height: 1.1em;
      transform: translateY(0.18em);
      background: var(--blue);
      animation: blink 0.95s steps(1) infinite;
    }

    .terminal-body {
      background: #050914;
      height: calc(100% - 48px);
      overflow: hidden;
      color: #d1fae5;
      scroll-behavior: auto;
      padding-bottom: 46px;
    }

    .terminal-line {
      margin: 0 0 11px;
    }

    .terminal-line:first-child {
      margin-top: 0;
    }

    .terminal-line.command {
      color: #f8fafc;
    }

    .terminal-line.command::before {
      content: "$ ";
      color: var(--green);
      font-weight: 800;
    }

    .terminal-line.output {
      color: #93c5fd;
      padding-left: 20px;
    }

    .cue-card {
      position: absolute;
      left: 64px;
      bottom: 78px;
      min-width: 390px;
      max-width: 480px;
      padding: 16px 20px;
      border-radius: 18px;
      border: 1px solid rgba(245, 158, 11, 0.38);
      background: rgba(15, 23, 42, 0.92);
      box-shadow: 0 18px 54px rgba(0, 0, 0, 0.32);
      opacity: 0;
      transition: opacity 180ms ease;
    }

    .cue-card.visible {
      opacity: 1;
    }

    .cue-label {
      color: var(--amber);
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 7px;
    }

    .cue-text {
      font-size: 20px;
      font-weight: 750;
    }

    .wave {
      display: flex;
      align-items: end;
      gap: 5px;
      height: 26px;
      margin-top: 13px;
    }

    .bar {
      width: 8px;
      border-radius: 999px;
      background: linear-gradient(180deg, var(--amber), var(--blue));
      animation: wave 900ms ease-in-out infinite;
    }

    .bar:nth-child(1) { height: 10px; animation-delay: 0ms; }
    .bar:nth-child(2) { height: 22px; animation-delay: 120ms; }
    .bar:nth-child(3) { height: 16px; animation-delay: 240ms; }
    .bar:nth-child(4) { height: 26px; animation-delay: 360ms; }
    .bar:nth-child(5) { height: 12px; animation-delay: 480ms; }

    .timeline {
      position: absolute;
      left: 34px;
      right: 34px;
      bottom: 28px;
      height: 8px;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.18);
      overflow: hidden;
    }

    .timeline-fill {
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, var(--violet), var(--blue), var(--green));
    }

    .controls {
      position: fixed;
      left: 50%;
      bottom: 18px;
      transform: translateX(-50%);
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 10px 12px;
      border-radius: 999px;
      background: rgba(2, 6, 23, 0.78);
      border: 1px solid var(--border);
      backdrop-filter: blur(10px);
    }

    .controls.hidden {
      display: none;
    }

    button {
      border: 0;
      color: #04111f;
      background: var(--blue);
      border-radius: 999px;
      padding: 8px 13px;
      font-weight: 800;
      cursor: pointer;
    }

    input[type="range"] {
      width: 420px;
    }

    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }

    @keyframes wave {
      0%, 100% { transform: scaleY(0.45); opacity: 0.72; }
      50% { transform: scaleY(1); opacity: 1; }
    }
  </style>
</head>
<body>
  <main id="stage" aria-label="Dailies preview stage">
    <header class="header">
      <div class="brand"><span class="status-light"></span><span>Dailies</span></div>
      <div class="title">${title}</div>
      <div class="brand">Relay CLI demo</div>
    </header>
    <section class="surfaces">
      <article class="surface editor active" data-surface="editor">
        <div class="surface-header">
          <span>Scenario.md</span>
          <span class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>
        </div>
        <div id="editorText" class="editor-body"></div>
      </article>
      <article class="surface terminal" data-surface="terminal">
        <div class="surface-header">
          <span>relay — fixture terminal</span>
          <span>Focus mode</span>
        </div>
        <div id="terminalText" class="terminal-body"></div>
      </article>
    </section>
    <aside id="cueCard" class="cue-card" data-surface="audio">
      <div class="cue-label">Audio cue declared</div>
      <div id="cueText" class="cue-text"></div>
      <div class="wave" aria-hidden="true"><span class="bar"></span><span class="bar"></span><span class="bar"></span><span class="bar"></span><span class="bar"></span></div>
    </aside>
    <div class="timeline"><div id="timelineFill" class="timeline-fill"></div></div>
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
    const cueCard = document.getElementById("cueCard");
    const cueText = document.getElementById("cueText");
    const timelineFill = document.getElementById("timelineFill");
    const playPause = document.getElementById("playPause");
    const restart = document.getElementById("restart");
    const scrub = document.getElementById("scrub");
    const controls = document.getElementById("controls");
    const params = new URLSearchParams(location.search);
    const durationMs = Math.max(timeline.durationMs || 1, 1);
    let playing = params.get("autoplay") === "1";
    let startTimestamp = 0;
    let startedAtMs = 0;
    let currentMs = Number(params.get("t") || 0);

    if (params.get("chrome") === "0") {
      controls.classList.add("hidden");
    }

    function setSurface(surface) {
      document.querySelectorAll(".surface").forEach((node) => {
        node.classList.toggle("active", node.dataset.surface === surface);
      });
    }

    function draw(timeMs) {
      const state = renderDailiesState(timeline, clamp(timeMs, 0, durationMs));
      editorText.textContent = state.editorText;
      editorText.classList.toggle("typing", Boolean(state.editorTyping));
      terminalText.textContent = "";
      for (const entry of state.terminalEntries) {
        const line = document.createElement("div");
        line.className = "terminal-line " + entry.kind + (entry.active ? " active" : "");
        line.textContent = entry.text;
        terminalText.appendChild(line);
      }
      terminalText.scrollTop = terminalText.scrollHeight;
      setSurface(state.activeSurface === "audio" ? "terminal" : state.activeSurface);
      if (state.audioCue) {
        cueCard.classList.add("visible");
        cueText.textContent = (state.audioCue.cue.line || "Relay") + ": " + (state.audioCue.cue.text || "");
      } else {
        cueCard.classList.remove("visible");
        cueText.textContent = "";
      }
      timelineFill.style.width = (state.progress * 100).toFixed(2) + "%";
      scrub.value = String(Math.round(state.progress * 1000));
      playPause.textContent = playing ? "Pause" : "Play";
    }

    function tick(timestamp) {
      if (!startTimestamp) startTimestamp = timestamp;
      if (playing) {
        currentMs = startedAtMs + (timestamp - startTimestamp);
        if (currentMs >= durationMs) {
          currentMs = durationMs;
          playing = false;
        }
      }
      draw(currentMs);
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
      draw(currentMs);
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

function safeScriptJson(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

async function main(argv) {
  const source = argv[2];
  if (!source) {
    console.error("Usage: node src/render-preview.mjs <demo.md>");
    return 2;
  }

  const { outputPath } = await renderPreview(source);
  console.log(outputPath);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv).then((code) => {
    process.exitCode = code;
  });
}
