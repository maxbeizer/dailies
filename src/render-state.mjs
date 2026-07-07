export const RENDER_STATE_BROWSER_SCRIPT = `
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function revealText(text, startMs, durationMs, timeMs) {
  if (timeMs <= startMs) return "";
  if (durationMs <= 0 || timeMs >= startMs + durationMs) return text;
  const progress = clamp((timeMs - startMs) / durationMs, 0, 1);
  return text.slice(0, Math.round(text.length * progress));
}

function visibleTextForEvent(event, timeMs) {
  if (event.action === "show-output") {
    return timeMs >= event.startMs ? event.text : "";
  }
  return revealText(event.text, event.startMs, event.durationMs, timeMs);
}

function isActive(event, timeMs) {
  return timeMs >= event.startMs && timeMs < event.startMs + Math.max(event.durationMs, 900);
}

function renderDailiesState(timeline, timeMs) {
  const editorEvents = [];
  const terminalEntries = [];
  const audioCues = [];
  let activeSurface = "editor";
  let activeEvent = null;

  for (const event of timeline.events || []) {
    if (timeMs >= event.startMs) {
      activeSurface = event.surface;
      activeEvent = event;
    }

    if (event.surface === "editor" && event.action === "type") {
      const text = revealText(event.text, event.startMs, event.durationMs, timeMs);
      if (text) {
        editorEvents.push({ text, active: isActive(event, timeMs) });
      }
    }

    if (event.surface === "terminal" && event.startMs <= timeMs) {
      const text = visibleTextForEvent(event, timeMs);
      if (text) {
        terminalEntries.push({
          kind: event.action === "type-command" ? "command" : "output",
          text,
          active: isActive(event, timeMs)
        });
      }
    }

    if (event.surface === "audio" && event.startMs <= timeMs) {
      audioCues.push({
        cue: event.cue || {},
        active: timeMs < event.startMs + 3500
      });
    }
  }

  return {
    timeMs,
    durationMs: timeline.durationMs || 0,
    progress: timeline.durationMs ? clamp(timeMs / timeline.durationMs, 0, 1) : 0,
    activeSurface,
    activeEvent,
    editorTyping: activeEvent && activeEvent.surface === "editor" && activeEvent.action === "type" && isActive(activeEvent, timeMs),
    editorText: editorEvents.map((event) => event.text).join("\\n\\n"),
    terminalEntries,
    audioCue: audioCues.find((cue) => cue.active) || null
  };
}
`;

let cachedRenderState = null;

export function renderState(timeline, timeMs) {
  if (!cachedRenderState) {
    cachedRenderState = new Function(`${RENDER_STATE_BROWSER_SCRIPT}; return renderDailiesState;`)();
  }
  return cachedRenderState(timeline, timeMs);
}
