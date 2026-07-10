const LANE_ORDER = ["slack", "github", "copilot", "brain"];

export function renderAttentionControlRoomHtml(timeline) {
  const timelineJson = safeScriptJson(timeline);
  const title = escapeHtml(timeline.title || "Attention control");

  return `<!doctype html>
<html lang="en" data-dailies-preview="true">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: dark;
      --ink: #edf7ff;
      --muted: #8fa5b9;
      --panel: rgba(7, 18, 31, 0.88);
      --panel-strong: rgba(8, 22, 38, 0.96);
      --line: rgba(135, 190, 221, 0.18);
      --accent: #fb7185;
      --accent-soft: rgba(251, 113, 133, 0.16);
      --slack: #f472b6;
      --github: #34d399;
      --copilot: #38bdf8;
      --brain: #fbbf24;
      --timeline-offset: 0ms;
      --stage-padding: 22px;
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
      background:
        radial-gradient(circle at 50% 22%, rgba(24, 105, 145, 0.24), transparent 34%),
        radial-gradient(circle at 16% 82%, rgba(244, 114, 182, 0.12), transparent 28%),
        #02070d;
    }

    #stage {
      width: 1280px;
      height: 720px;
      position: relative;
      overflow: hidden;
      display: grid;
      grid-template-rows: 44px minmax(0, 1fr) 150px 36px 7px;
      gap: 10px;
      padding: var(--stage-padding);
      background:
        linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.018) 1px, transparent 1px),
        radial-gradient(circle at 50% -20%, rgba(56, 189, 248, 0.16), transparent 44%),
        linear-gradient(155deg, #07111d 0%, #030811 58%, #07101a 100%);
      background-size: 36px 36px, 36px 36px, auto, auto;
      border: 1px solid rgba(135, 190, 221, 0.16);
      box-shadow: 0 40px 120px rgba(0, 0, 0, 0.58);
      isolation: isolate;
    }

    #stage::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 20;
      opacity: 0.19;
      background-position: center;
      background-size: cover;
      mix-blend-mode: screen;
    }

    #stage::after {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 30;
      pointer-events: none;
      background:
        linear-gradient(90deg, rgba(0, 0, 0, 0.42), transparent 8%, transparent 92%, rgba(0, 0, 0, 0.42)),
        radial-gradient(ellipse at center, transparent 45%, rgba(0, 0, 0, 0.36) 100%);
    }

    .topbar,
    .room,
    .story,
    .timeline {
      position: relative;
      z-index: 10;
    }

    .topbar {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      min-width: 0;
      border-bottom: 1px solid var(--line);
    }

    .eyebrow {
      color: #9edffb;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    .clock {
      display: flex;
      align-items: baseline;
      gap: 10px;
      font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
    }

    .clock-time {
      color: white;
      font-size: 23px;
      font-weight: 900;
      letter-spacing: -0.03em;
    }

    .clock-window {
      color: var(--muted);
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .scene-count {
      color: var(--muted);
      font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
      font-size: 12px;
    }

    .topbar-meta {
      justify-self: end;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .global-reenactment-badge {
      display: none;
      padding: 4px 7px;
      border: 1px solid rgba(247, 217, 141, 0.28);
      border-radius: 999px;
      color: #f7d98d;
      background: rgba(247, 217, 141, 0.07);
      font-size: 8px;
      font-weight: 950;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .global-reenactment-badge.visible {
      display: inline-flex;
    }

    .room {
      min-height: 0;
      overflow: hidden;
      border: 1px solid rgba(135, 190, 221, 0.14);
      border-radius: 26px;
      background:
        radial-gradient(circle at 50% 48%, var(--accent-soft), transparent 28%),
        linear-gradient(180deg, rgba(13, 36, 55, 0.55), rgba(3, 10, 18, 0.88));
      box-shadow: inset 0 0 90px rgba(0, 0, 0, 0.5);
    }

    .room::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0.56;
      background:
        linear-gradient(110deg, transparent 0 24%, rgba(71, 166, 211, 0.08) 24.2% 24.5%, transparent 24.7%),
        linear-gradient(70deg, transparent 0 75%, rgba(71, 166, 211, 0.08) 75.2% 75.5%, transparent 75.7%),
        repeating-radial-gradient(ellipse at 50% 112%, transparent 0 44px, rgba(135, 190, 221, 0.05) 45px 46px);
    }

    .room-grid {
      position: absolute;
      inset: 16px;
      display: grid;
      grid-template-columns: 300px minmax(0, 1fr) 300px;
      grid-template-rows: 1fr 1fr;
      gap: 14px 38px;
      transform-origin: center;
      transform: scale(1) translateY(0);
    }

    #stage[data-layout="cutaway"] .room-grid {
      display: none;
    }

    #stage[data-layout="control-room"] .cutaway-view {
      display: none;
    }

    .cutaway-view {
      position: absolute;
      inset: 16px;
      display: grid;
      grid-template-rows: 46px minmax(0, 1fr);
      overflow: hidden;
      border: 1px solid rgba(135, 190, 221, 0.18);
      border-radius: 18px;
      background:
        radial-gradient(circle at 82% 18%, var(--accent-soft), transparent 34%),
        linear-gradient(145deg, rgba(8, 25, 40, 0.98), rgba(2, 8, 15, 0.98));
      box-shadow: inset 0 0 70px rgba(0, 0, 0, 0.34);
    }

    #stage[data-variant="slack"] .cutaway-view {
      background:
        radial-gradient(circle at 12% 86%, rgba(244, 114, 182, 0.13), transparent 34%),
        linear-gradient(145deg, #22162a, #090a13 68%);
    }

    #stage[data-variant="deployment"] .cutaway-view {
      background:
        linear-gradient(rgba(52, 211, 153, 0.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(52, 211, 153, 0.035) 1px, transparent 1px),
        linear-gradient(145deg, #061b17, #030a0c 72%);
      background-size: 24px 24px, 24px 24px, auto;
    }

    .cutaway-header {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      padding: 0 16px;
      border-bottom: 1px solid rgba(135, 190, 221, 0.13);
      background: rgba(2, 8, 15, 0.54);
    }

    .cutaway-mark {
      width: 27px;
      height: 27px;
      display: grid;
      place-items: center;
      border: 1px solid color-mix(in srgb, var(--accent) 48%, transparent);
      border-radius: 8px;
      color: var(--accent);
      background: var(--accent-soft);
      font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
      font-size: 10px;
      font-weight: 900;
    }

    .cutaway-source {
      min-width: 0;
      overflow: hidden;
      color: #cce1ee;
      font-size: 12px;
      font-weight: 800;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .reenactment-badge {
      color: #f7d98d;
      font-size: 9px;
      font-weight: 950;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .dialogue-stream {
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow: hidden;
      padding: 13px 18px 15px;
    }

    .dialogue-message {
      --speaker: #9edffb;
      width: min(82%, 820px);
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
      padding: 9px 12px;
      border: 1px solid color-mix(in srgb, var(--speaker) 34%, transparent);
      border-radius: 14px;
      color: #dceaf4;
      background: rgba(4, 13, 22, 0.9);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
      opacity: 0.74;
    }

    .dialogue-message.active {
      border-color: color-mix(in srgb, var(--speaker) 72%, transparent);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--speaker) 14%, transparent), 0 14px 36px rgba(0, 0, 0, 0.28);
      opacity: 1;
    }

    .dialogue-message[data-role="operator"] {
      --speaker: #fb7185;
      align-self: flex-end;
      grid-template-columns: minmax(0, 1fr) 34px;
    }

    .dialogue-message[data-role="operator"] .dialogue-avatar {
      grid-column: 2;
      grid-row: 1;
    }

    .dialogue-message[data-role="operator"] .dialogue-copy {
      grid-column: 1;
      grid-row: 1;
      text-align: right;
    }

    .dialogue-message[data-role="collaborator"] { --speaker: #f59e0b; }
    .dialogue-message[data-role="copilot"] { --speaker: #38bdf8; }
    .dialogue-message[data-role="system"] { --speaker: #34d399; }
    .dialogue-message[data-role="control-room"] { --speaker: #fbbf24; }
    .dialogue-message[data-role="narrator"] { --speaker: #c4b5fd; }

    .dialogue-avatar {
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border: 1px solid color-mix(in srgb, var(--speaker) 58%, transparent);
      border-radius: 10px;
      color: var(--speaker);
      background: color-mix(in srgb, var(--speaker) 12%, #07111d);
      font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
      font-size: 9px;
      font-weight: 950;
      text-transform: uppercase;
    }

    .dialogue-speaker {
      margin-bottom: 4px;
      color: var(--speaker);
      font-size: 10px;
      font-weight: 950;
      letter-spacing: 0.06em;
    }

    .dialogue-text {
      color: #e7f1f7;
      font-size: 13px;
      font-weight: 620;
      line-height: 1.3;
      white-space: pre-wrap;
    }

    .lane {
      --lane: #9edffb;
      position: relative;
      min-width: 0;
      overflow: hidden;
      padding: 13px 15px;
      border: 1px solid rgba(135, 190, 221, 0.15);
      border-radius: 17px;
      background:
        linear-gradient(145deg, rgba(12, 29, 46, 0.9), rgba(4, 12, 22, 0.92));
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.22);
      transition: border-color 300ms ease, box-shadow 300ms ease, opacity 300ms ease;
    }

    .lane[data-lane-id="slack"] { --lane: var(--slack); grid-column: 1; grid-row: 1; }
    .lane[data-lane-id="github"] { --lane: var(--github); grid-column: 1; grid-row: 2; }
    .lane[data-lane-id="copilot"] { --lane: var(--copilot); grid-column: 3; grid-row: 1; }
    .lane[data-lane-id="brain"] { --lane: var(--brain); grid-column: 3; grid-row: 2; }

    .lane::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0.13;
      background: linear-gradient(115deg, transparent 30%, var(--lane), transparent 68%);
      transform: translateX(-100%);
    }

    .lane.active {
      border-color: color-mix(in srgb, var(--lane) 62%, transparent);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--lane) 12%, transparent), 0 16px 46px color-mix(in srgb, var(--lane) 14%, transparent);
    }

    .lane.active::before {
      animation: scan 2.4s ease-in-out infinite;
      animation-delay: var(--timeline-offset);
      animation-play-state: paused;
    }

    .lane.dimmed {
      opacity: 0.55;
    }

    .lane-connector {
      position: absolute;
      top: 50%;
      width: 38px;
      height: 1px;
      overflow: visible;
      background: linear-gradient(90deg, transparent, var(--lane));
    }

    [data-lane-id="slack"] .lane-connector,
    [data-lane-id="github"] .lane-connector {
      right: -39px;
    }

    [data-lane-id="copilot"] .lane-connector,
    [data-lane-id="brain"] .lane-connector {
      left: -39px;
      transform: rotate(180deg);
    }

    .lane.active .lane-connector::after {
      content: "";
      position: absolute;
      top: -3px;
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: var(--lane);
      box-shadow: 0 0 14px var(--lane);
      animation: signal 1.45s linear infinite;
      animation-delay: var(--timeline-offset);
      animation-play-state: paused;
    }

    .lane-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 9px;
    }

    .lane-title {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      color: var(--lane);
      font-size: 12px;
      font-weight: 950;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .lane-dot {
      width: 8px;
      height: 8px;
      flex: 0 0 auto;
      border-radius: 999px;
      background: var(--lane);
      box-shadow: 0 0 12px var(--lane);
    }

    .lane-status {
      color: #dcebf6;
      font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
      font-size: 10px;
      white-space: nowrap;
    }

    .lane-items {
      display: grid;
      gap: 6px;
    }

    .lane-item {
      overflow: hidden;
      color: #c4d5e2;
      font-size: 12px;
      line-height: 1.22;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .lane-item::before {
      content: "";
      display: inline-block;
      width: 12px;
      height: 1px;
      margin-right: 7px;
      transform: translateY(-3px);
      background: color-mix(in srgb, var(--lane) 72%, transparent);
    }

    .mission-core {
      position: relative;
      grid-column: 2;
      grid-row: 1 / 3;
      min-width: 0;
      overflow: hidden;
      border: 1px solid rgba(135, 190, 221, 0.14);
      border-radius: 40% 40% 21px 21px;
      background:
        radial-gradient(circle at 50% 34%, rgba(56, 189, 248, 0.12), transparent 30%),
        linear-gradient(180deg, rgba(6, 22, 35, 0.58), rgba(3, 10, 18, 0.9));
      box-shadow: inset 0 24px 70px rgba(56, 189, 248, 0.04);
    }

    .mission-core::before,
    .mission-core::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 43%;
      border: 1px solid color-mix(in srgb, var(--accent) 34%, transparent);
      border-radius: 999px;
      transform: translate(-50%, -50%);
    }

    .mission-core::before {
      width: 270px;
      height: 270px;
      animation: orbit 18s linear infinite;
      animation-delay: var(--timeline-offset);
      animation-play-state: paused;
    }

    .mission-core::after {
      width: 205px;
      height: 205px;
      border-style: dashed;
      animation: orbitReverse 14s linear infinite;
      animation-delay: var(--timeline-offset);
      animation-play-state: paused;
    }

    .pods {
      position: absolute;
      top: 24px;
      left: 50%;
      z-index: 4;
      display: flex;
      gap: 9px;
      transform: translateX(-50%);
    }

    .pod {
      width: 42px;
      height: 24px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(135, 190, 221, 0.18);
      border-radius: 8px 8px 13px 13px;
      color: #5d7385;
      background: rgba(5, 14, 24, 0.86);
      font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
      font-size: 9px;
      transition: all 320ms ease;
    }

    .pod.live {
      color: white;
      border-color: rgba(56, 189, 248, 0.62);
      background: rgba(14, 74, 103, 0.64);
      box-shadow: 0 0 18px rgba(56, 189, 248, 0.3);
    }

    .operator {
      position: absolute;
      left: 50%;
      top: 46%;
      z-index: 3;
      width: 178px;
      height: 198px;
      transform: translate(-50%, -50%);
      background-position: center;
      background-repeat: no-repeat;
      background-size: contain;
    }

    .operator::before {
      content: "";
      position: absolute;
      left: 50%;
      top: 30px;
      width: 62px;
      height: 68px;
      border-radius: 46% 46% 42% 42%;
      transform: translateX(-50%);
      background: linear-gradient(145deg, #17334a, #07111d 74%);
      box-shadow: inset -10px -8px 18px rgba(0, 0, 0, 0.32), 0 0 36px var(--accent-soft);
    }

    .operator::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 88px;
      width: 142px;
      height: 96px;
      border-radius: 52% 52% 14% 14%;
      transform: translateX(-50%);
      background: linear-gradient(150deg, #10283d, #050c15 72%);
      box-shadow: inset 0 16px 30px rgba(56, 189, 248, 0.04);
    }

    .control-loop-emblem {
      position: absolute;
      left: 50%;
      top: 43%;
      z-index: 2;
      width: 292px;
      height: 292px;
      border-radius: 999px;
      transform: translate(-50%, -50%);
      background-position: center;
      background-repeat: no-repeat;
      background-size: contain;
      opacity: 0;
      transition: opacity 220ms ease;
    }

    #stage[data-scene="control-loop"] .control-loop-emblem {
      opacity: 0.42;
    }

    .foreground {
      position: absolute;
      left: 22px;
      right: 22px;
      bottom: 18px;
      z-index: 7;
      padding: 12px 14px;
      border: 1px solid color-mix(in srgb, var(--accent) 42%, transparent);
      border-radius: 14px;
      background: rgba(3, 10, 18, 0.9);
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.28);
    }

    .foreground-label {
      margin-bottom: 5px;
      color: var(--accent);
      font-size: 10px;
      font-weight: 950;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .foreground-action {
      color: white;
      font-size: 14px;
      font-weight: 760;
      line-height: 1.2;
    }

    .concurrency {
      position: absolute;
      top: 61px;
      left: 50%;
      z-index: 5;
      display: flex;
      align-items: baseline;
      gap: 7px;
      transform: translateX(-50%);
      color: var(--muted);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .concurrency strong {
      color: #fff;
      font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
      font-size: 17px;
    }

    .story {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 310px;
      gap: 16px;
      min-width: 0;
      overflow: hidden;
      padding: 16px 18px;
      border: 1px solid rgba(135, 190, 221, 0.14);
      border-radius: 20px;
      background:
        linear-gradient(105deg, var(--accent-soft), transparent 34%),
        var(--panel-strong);
    }

    .story-copy {
      min-width: 0;
    }

    .story-kicker {
      margin-bottom: 7px;
      color: var(--accent);
      font-size: 11px;
      font-weight: 950;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .story-headline {
      margin: 0 0 7px;
      color: white;
      font-size: 28px;
      font-weight: 920;
      letter-spacing: -0.035em;
      line-height: 1;
    }

    .story-body {
      max-width: 760px;
      margin: 0;
      color: #b9cad7;
      font-size: 14px;
      line-height: 1.35;
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      align-content: stretch;
    }

    .metric {
      min-width: 0;
      padding: 10px 11px;
      border: 1px solid rgba(135, 190, 221, 0.12);
      border-radius: 13px;
      background: rgba(3, 10, 18, 0.66);
    }

    .metric-value {
      overflow: hidden;
      color: white;
      font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
      font-size: 19px;
      font-weight: 900;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .metric-label {
      margin-top: 4px;
      color: var(--muted);
      font-size: 9px;
      font-weight: 850;
      letter-spacing: 0.08em;
      line-height: 1.2;
      text-transform: uppercase;
    }

    .narration {
      position: relative;
      z-index: 10;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 7px 18px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 13px;
      color: #f5fbff;
      background: rgba(1, 6, 12, 0.86);
      box-shadow: 0 14px 46px rgba(0, 0, 0, 0.42);
      font-size: 13px;
      font-weight: 680;
      line-height: 1.25;
      text-align: center;
      opacity: 0;
      transition: opacity 180ms ease;
    }

    .narration-role {
      flex: 0 0 auto;
      color: #9edffb;
      font-size: 9px;
      font-weight: 950;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .narration[data-voice-role="operator"] .narration-role {
      color: #fb7185;
    }

    .narration[data-voice-role="control-room"] .narration-role {
      color: #fbbf24;
    }

    .narration[data-voice-role="collaborator"] .narration-role {
      color: #f59e0b;
    }

    .narration[data-voice-role="copilot"] .narration-role {
      color: #38bdf8;
    }

    .narration[data-voice-role="system"] .narration-role {
      color: #34d399;
    }

    .narration-text {
      min-width: 0;
    }

    .narration.visible {
      opacity: 1;
    }

    .timeline {
      overflow: hidden;
      border-radius: 999px;
      background: rgba(135, 190, 221, 0.12);
    }

    .timeline-fill {
      width: 0%;
      height: 100%;
      background: linear-gradient(90deg, var(--slack), var(--copilot), var(--brain), var(--github));
      box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 62%, transparent);
    }

    .controls {
      position: fixed;
      left: 50%;
      bottom: 18px;
      z-index: 50;
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 10px 12px;
      border: 1px solid rgba(135, 190, 221, 0.2);
      border-radius: 999px;
      transform: translateX(-50%);
      background: rgba(1, 6, 12, 0.84);
      backdrop-filter: blur(12px);
    }

    .controls.hidden {
      display: none;
    }

    button {
      border: 0;
      border-radius: 999px;
      padding: 8px 13px;
      color: #06111c;
      background: #8be2ff;
      font-weight: 900;
      cursor: pointer;
    }

    input[type="range"] {
      width: 420px;
    }

    @keyframes scan {
      0% { transform: translateX(-115%); }
      58%, 100% { transform: translateX(115%); }
    }

    @keyframes signal {
      from { left: 0; opacity: 0; }
      18% { opacity: 1; }
      to { left: calc(100% - 7px); opacity: 0; }
    }

    @keyframes orbit {
      to { transform: translate(-50%, -50%) rotate(360deg); }
    }

    @keyframes orbitReverse {
      to { transform: translate(-50%, -50%) rotate(-360deg); }
    }

  </style>
</head>
<body>
  <main id="stage" data-dailies-set="attention-control-room" data-camera="wide" aria-label="Attention control room">
    <header class="topbar">
      <div class="eyebrow">Attention control room</div>
      <div class="clock">
        <span id="clockTime" class="clock-time">08:05</span>
        <span class="clock-window">one hour compressed</span>
      </div>
      <div class="topbar-meta">
        <span id="globalReenactmentBadge" class="global-reenactment-badge">Acted reenactment - not a recording</span>
        <span id="sceneCount" class="scene-count">01 / 01</span>
      </div>
    </header>

    <section class="room" aria-label="Live work lanes">
      <section class="cutaway-view" aria-label="Source-backed acted interaction">
        <header class="cutaway-header">
          <div id="cutawayMark" class="cutaway-mark">AI</div>
          <div id="cutawaySource" class="cutaway-source"></div>
          <div class="reenactment-badge">Source-backed reenactment - acted, not a recording</div>
        </header>
        <div id="dialogueStream" class="dialogue-stream"></div>
      </section>
      <div class="room-grid">
        ${LANE_ORDER.map((laneId) => laneMarkup(laneId)).join("")}
        <section class="mission-core" aria-label="Human foreground">
          <div id="pods" class="pods" aria-label="Active Copilot workspaces">
            <span class="pod">01</span><span class="pod">02</span><span class="pod">03</span><span class="pod">04</span><span class="pod">05</span>
          </div>
          <div class="concurrency"><strong id="concurrencyValue">0</strong><span>workspaces active</span></div>
          <div class="control-loop-emblem" aria-hidden="true"></div>
          <div class="operator" aria-hidden="true"></div>
          <article class="foreground">
            <div id="foregroundLabel" class="foreground-label">Human foreground</div>
            <div id="foregroundAction" class="foreground-action"></div>
          </article>
        </section>
      </div>
    </section>

    <section class="story" aria-live="polite">
      <div id="storyCopy" class="story-copy">
        <div id="storyKicker" class="story-kicker"></div>
        <h1 id="storyHeadline" class="story-headline"></h1>
        <p id="storyBody" class="story-body"></p>
      </div>
      <div id="metrics" class="metrics" aria-label="Scene metrics"></div>
    </section>

    <aside id="narration" class="narration">
      <span id="narrationRole" class="narration-role"></span>
      <span id="narrationText" class="narration-text"></span>
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
    const timeline = JSON.parse(document.getElementById("dailies-timeline").textContent);
    const stage = document.getElementById("stage");
    const roomGrid = document.querySelector(".room-grid");
    const cutawayMark = document.getElementById("cutawayMark");
    const cutawaySource = document.getElementById("cutawaySource");
    const dialogueStream = document.getElementById("dialogueStream");
    const clockTime = document.getElementById("clockTime");
    const sceneCount = document.getElementById("sceneCount");
    const globalReenactmentBadge = document.getElementById("globalReenactmentBadge");
    const foregroundLabel = document.getElementById("foregroundLabel");
    const foregroundAction = document.getElementById("foregroundAction");
    const storyCopy = document.getElementById("storyCopy");
    const storyKicker = document.getElementById("storyKicker");
    const storyHeadline = document.getElementById("storyHeadline");
    const storyBody = document.getElementById("storyBody");
    const metrics = document.getElementById("metrics");
    const concurrencyValue = document.getElementById("concurrencyValue");
    const pods = [...document.querySelectorAll(".pod")];
    const narration = document.getElementById("narration");
    const narrationRole = document.getElementById("narrationRole");
    const narrationText = document.getElementById("narrationText");
    const timelineFill = document.getElementById("timelineFill");
    const playPause = document.getElementById("playPause");
    const restart = document.getElementById("restart");
    const scrub = document.getElementById("scrub");
    const controls = document.getElementById("controls");
    const params = new URLSearchParams(location.search);
    const sceneEvents = (timeline.events || []).filter((event) => event.surface === "scene");
    const audioEvents = (timeline.events || []).filter((event) => event.surface === "audio");
    const durationMs = Math.max(timeline.durationMs || 1, 1);
    const accentColors = {
      human: "#fb7185",
      slack: "#f472b6",
      github: "#34d399",
      copilot: "#38bdf8",
      brain: "#fbbf24",
      incident: "#f87171"
    };
    const cameraFrames = {
      wide: { scale: 1, translateY: 0 },
      push: { scale: 1.025, translateY: 2 },
      close: { scale: 1.055, translateY: 6 },
      overhead: { scale: 0.975, translateY: -3 }
    };
    let playing = params.get("autoplay") === "1";
    let startTimestamp = 0;
    let startedAtMs = 0;
    let currentMs = Number(params.get("t") || 0);
    let renderedDialogueKey = "";

    if (params.get("chrome") === "0") {
      controls.classList.add("hidden");
    }
    globalReenactmentBadge.classList.toggle("visible", sceneEvents.some((event) => event.scene?.reenactment === true));

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function currentSceneEvent(timeMs) {
      let current = sceneEvents[0] || null;
      for (const event of sceneEvents) {
        if (event.startMs <= timeMs) current = event;
        if (event.startMs > timeMs) break;
      }
      return current;
    }

    function audioEventsForScene(sceneEvent) {
      if (!sceneEvent) return null;
      const sceneEndMs = sceneEvent.startMs + sceneEvent.durationMs;
      return audioEvents
        .filter((event) => event.startMs >= sceneEvent.startMs && event.startMs < sceneEndMs)
        .sort((left, right) => left.startMs - right.startMs);
    }

    function currentAudioEvent(sceneEvent, timeMs) {
      const sceneAudio = audioEventsForScene(sceneEvent) || [];
      let current = sceneAudio[0] || null;
      for (const event of sceneAudio) {
        if (event.startMs <= timeMs) current = event;
        if (event.startMs > timeMs) break;
      }
      return current;
    }

    function setText(node, value) {
      node.textContent = value || "";
    }

    function drawLane(laneId, lane) {
      const node = document.querySelector('[data-lane-id="' + laneId + '"]');
      const title = node.querySelector(".lane-label");
      const status = node.querySelector(".lane-status");
      const items = node.querySelector(".lane-items");
      const data = lane || {
        label: laneId[0].toUpperCase() + laneId.slice(1),
        status: "standing by",
        active: false,
        items: ["No foreground activity"]
      };

      setText(title, data.label);
      setText(status, data.status || "standing by");
      node.classList.toggle("active", Boolean(data.active));
      node.classList.toggle("dimmed", data.dimmed === true);
      items.textContent = "";
      for (const item of (data.items || []).slice(0, 3)) {
        const itemNode = document.createElement("div");
        itemNode.className = "lane-item";
        itemNode.textContent = item;
        items.appendChild(itemNode);
      }
    }

    function drawMetrics(scene) {
      metrics.textContent = "";
      const sceneMetrics = Array.isArray(scene.metrics) ? scene.metrics.slice(0, 4) : [];
      if (sceneMetrics.length === 0) {
        sceneMetrics.push(
          { value: String(scene.concurrency || 0), label: "active workspaces" },
          { value: scene.clock || "--:--", label: "foreground clock" }
        );
      }

      for (const metric of sceneMetrics) {
        const card = document.createElement("div");
        card.className = "metric";
        const value = document.createElement("div");
        value.className = "metric-value";
        value.textContent = metric.value || "";
        const label = document.createElement("div");
        label.className = "metric-label";
        label.textContent = metric.label || "";
        card.append(value, label);
        metrics.appendChild(card);
      }
    }

    function avatarLabel(cue) {
      if (cue.avatar) return cue.avatar;
      if (cue.role === "copilot") return "AI";
      if (cue.role === "system") return "SYS";
      const line = cue.line || "?";
      return line.startsWith("@") ? line.slice(1, 3) : line.slice(0, 2);
    }

    function drawCutaway(sceneEvent, timeMs, audioEvent) {
      const scene = sceneEvent.scene || {};
      const visibleEvents = (audioEventsForScene(sceneEvent) || []).filter((event) => event.startMs <= timeMs);
      const dialogueKey = scene.id + ":" + visibleEvents.length + ":" + (audioEvent?.cue?.output || "");
      const marks = { copilot: "AI", slack: "#", deployment: ">_" };

      setText(cutawayMark, marks[scene.variant] || ">>");
      setText(cutawaySource, scene.sourceLabel || "");
      if (dialogueKey === renderedDialogueKey) return;
      renderedDialogueKey = dialogueKey;
      dialogueStream.textContent = "";

      for (const event of visibleEvents) {
        const cue = event.cue || {};
        const role = cue.role || "system";
        const card = document.createElement("article");
        card.className = "dialogue-message";
        card.dataset.role = role;
        card.classList.toggle("active", event === audioEvent);

        const avatar = document.createElement("div");
        avatar.className = "dialogue-avatar";
        avatar.textContent = avatarLabel(cue);

        const copy = document.createElement("div");
        copy.className = "dialogue-copy";
        const speaker = document.createElement("div");
        speaker.className = "dialogue-speaker";
        speaker.textContent = cue.line || role;
        const text = document.createElement("div");
        text.className = "dialogue-text";
        text.textContent = String(cue.displayText || cue.text || "").replaceAll("\\\\n", "\\n");
        copy.append(speaker, text);
        card.append(avatar, copy);
        dialogueStream.appendChild(card);
      }

      dialogueStream.scrollTop = dialogueStream.scrollHeight;
    }

    function drawScene(sceneEvent, timeMs) {
      if (!sceneEvent) return;
      const scene = sceneEvent.scene || {};
      const sceneIndex = Math.max(0, sceneEvents.indexOf(sceneEvent));
      const previousScene = sceneEvents[Math.max(0, sceneIndex - 1)]?.scene || scene;
      const lanes = new Map((scene.lanes || []).map((lane) => [lane.id, lane]));
      const concurrency = clamp(Number(scene.concurrency || 0), 0, 5);
      const audioEvent = currentAudioEvent(sceneEvent, timeMs);
      const transitionProgress = clamp((timeMs - sceneEvent.startMs) / 900, 0, 1);
      const easedProgress = 1 - Math.pow(1 - transitionProgress, 3);
      const fromCamera = cameraFrames[previousScene.camera] || cameraFrames.wide;
      const toCamera = cameraFrames[scene.camera] || cameraFrames.wide;
      const scale = fromCamera.scale + (toCamera.scale - fromCamera.scale) * easedProgress;
      const translateY = fromCamera.translateY + (toCamera.translateY - fromCamera.translateY) * easedProgress;
      const introProgress = clamp((timeMs - sceneEvent.startMs) / 480, 0, 1);

      stage.dataset.camera = scene.camera || "wide";
      stage.dataset.scene = scene.id || "";
      stage.dataset.layout = scene.layout || "control-room";
      stage.dataset.variant = scene.variant || "";
      stage.style.setProperty("--accent", accentColors[scene.accent] || accentColors.human);
      stage.style.setProperty("--accent-soft", (accentColors[scene.accent] || accentColors.human) + "24");
      roomGrid.style.transform = "scale(" + scale.toFixed(4) + ") translateY(" + translateY.toFixed(2) + "px)";
      storyCopy.style.opacity = String(introProgress);
      storyCopy.style.transform = "translateY(" + ((1 - introProgress) * 7).toFixed(2) + "px)";
      setText(clockTime, scene.clock);
      setText(sceneCount, String(sceneIndex + 1).padStart(2, "0") + " / " + String(sceneEvents.length).padStart(2, "0"));
      setText(foregroundLabel, scene.foreground?.label || "Human foreground");
      setText(foregroundAction, scene.foreground?.action || scene.headline);
      setText(storyKicker, scene.kicker || "Attention");
      setText(storyHeadline, scene.headline);
      setText(storyBody, scene.body);
      setText(concurrencyValue, String(concurrency));

      if (scene.layout === "cutaway") {
        drawCutaway(sceneEvent, timeMs, audioEvent);
      } else {
        renderedDialogueKey = "";
        for (const laneId of ${JSON.stringify(LANE_ORDER)}) {
          drawLane(laneId, lanes.get(laneId));
        }
        pods.forEach((pod, index) => {
          pod.classList.toggle("live", index < concurrency);
        });
      }

      drawMetrics(scene);
      const voiceLabel = audioEvent?.cue?.line || "";
      const voiceRole = audioEvent?.cue?.role || voiceLabel;
      setText(narrationRole, voiceLabel);
      setText(narrationText, audioEvent?.cue?.text || "");
      narration.dataset.voiceRole = voiceRole.toLowerCase().replaceAll(" ", "-");
      narration.classList.toggle("visible", Boolean(audioEvent?.cue?.text));
    }

    function draw(timeMs) {
      const boundedMs = clamp(timeMs, 0, durationMs);
      stage.style.setProperty("--timeline-offset", String(-Math.round(boundedMs)) + "ms");
      drawScene(currentSceneEvent(boundedMs), boundedMs);
      const progress = durationMs ? boundedMs / durationMs : 0;
      timelineFill.style.width = (progress * 100).toFixed(2) + "%";
      scrub.value = String(Math.round(progress * 1000));
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

function laneMarkup(laneId) {
  const label = laneId[0].toUpperCase() + laneId.slice(1);
  return `<article class="lane" data-lane-id="${laneId}">
    <span class="lane-connector" aria-hidden="true"></span>
    <div class="lane-head">
      <div class="lane-title"><span class="lane-dot"></span><span class="lane-label">${label}</span></div>
      <div class="lane-status">standing by</div>
    </div>
    <div class="lane-items"><div class="lane-item">No foreground activity</div></div>
  </article>`;
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
