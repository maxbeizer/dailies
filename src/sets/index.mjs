import { SUPPORTED_SET_NAMES } from "../set-names.mjs";
import { renderAttentionControlRoomHtml } from "./attention-control-room.mjs";
import { renderFullScreenMediaHtml, renderStudioMonitorHtml } from "./media-studio.mjs";

const SET_RENDERERS = new Map([
  ["attention-control-room", renderAttentionControlRoomHtml],
  ["full-screen-media", renderFullScreenMediaHtml],
  ["studio-monitor", renderStudioMonitorHtml],
]);

export function renderNamedSetHtml(timeline) {
  const renderer = SET_RENDERERS.get(timeline.set);
  if (!renderer) throw new Error(`set renderer is not registered: ${timeline.set}`);
  return renderer(timeline);
}

export function supportedSetNames() {
  return [...SUPPORTED_SET_NAMES];
}
