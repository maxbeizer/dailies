import assert from "node:assert/strict";
import test from "node:test";
import { compileTimeline } from "../src/compile-timeline.mjs";
import { demoDurationLimitSeconds, terminalCommandAllowed } from "../src/evaluate-demo.mjs";
import { mediaConfigFingerprint, validateMediaData } from "../src/media-fixtures.mjs";
import { parseDemoMarkdown } from "../src/parse-demo.mjs";
import { renderPreviewHtml } from "../src/render-preview.mjs";
import { clampMediaFrameNumber, mediaFrameRequestAt } from "../src/render-with-chrome.mjs";
import { supportedSetNames } from "../src/sets/index.mjs";

const MEDIA_SOURCE = `---
title: Dailies inception
set: studio-monitor
theme: cinema
executionMode: fixture-only
---

\`\`\`dailies:media
type: video
source: assets/demo/dailies-seed.mp4
panel: monitor
offsetMs: 1200
sourceOffsetMs: 5000
durationMs: 8000
fit: cover
audio: muted
transition: fade
fadeMs: 500
caption: A Dailies video inside a Dailies video.
\`\`\`
`;

test("media blocks parse and compile into deterministic timeline events", () => {
  const parsed = parseDemoMarkdown("/repo/demos/dailies/inception.demo.md", MEDIA_SOURCE);
  const mediaBlock = parsed.blocks.find((block) => block.type === "media");

  assert.equal(mediaBlock.data.source, "assets/demo/dailies-seed.mp4");

  const timeline = compileTimeline(parsed);
  assert.equal(timeline.set, "studio-monitor");
  assert.equal(timeline.production.theme, "cinema");
  assert.equal(timeline.durationMs, 9200);
  assert.deepEqual(timeline.events[0], {
    surface: "media",
    action: "show-video",
    startMs: 1200,
    durationMs: 8000,
    media: {
      type: "video",
      source: "assets/demo/dailies-seed.mp4",
      panel: "monitor",
      offsetMs: 1200,
      sourceOffsetMs: 5000,
      durationMs: 8000,
      fit: "cover",
      audio: "muted",
      transition: "fade",
      fadeMs: 500,
      caption: "A Dailies video inside a Dailies video.",
    },
  });
});

test("media studio demos support the System 7-inspired theme and longer declared stories", () => {
  const parsed = parseDemoMarkdown(
    "/repo/demos/dailies/directors-cut.demo.md",
    MEDIA_SOURCE
      .replace("theme: cinema", "theme: macintosh")
      .replace("executionMode: fixture-only", "executionMode: fixture-only\nmaxDurationSeconds: 60\ntailHoldMs: 3000"),
  );
  const timeline = compileTimeline(parsed);

  assert.equal(timeline.production.theme, "macintosh");
  assert.equal(timeline.tailHoldMs, 3000);
  assert.equal(timeline.durationMs, 12200);
  assert.equal(demoDurationLimitSeconds("studio-monitor", parsed.frontmatter), 60);
  assert.equal(demoDurationLimitSeconds("full-screen-media", {}), 60);
  assert.equal(demoDurationLimitSeconds("editor-terminal", { maxDurationSeconds: 60 }), 25);
});

test("media validation fails closed for unsafe or unsupported declarations", () => {
  assert.throws(() => validateMediaData({
    type: "video",
    source: "../private.mp4",
    durationMs: 1000,
  }), /assets/);
  assert.throws(() => validateMediaData({
    type: "video",
    source: "/tmp/private.mp4",
    durationMs: 1000,
  }), /relative/);
  assert.throws(() => validateMediaData({
    type: "video",
    source: "assets/demo/clip.mp4",
    durationMs: 1000,
    audio: "mix",
  }), /audio must be muted/);
  assert.throws(() => validateMediaData({
    type: "video",
    source: "assets/demo/clip.mov",
    durationMs: 1000,
  }), /MP4/);
});

test("media and production controls fail instead of silently targeting unsupported sets", () => {
  const defaultSetMedia = parseDemoMarkdown("/repo/demos/invalid.demo.md", MEDIA_SOURCE.replace("set: studio-monitor\n", ""));
  assert.throws(() => compileTimeline(defaultSetMedia), /media fixtures require/);

  const defaultSetTheme = parseDemoMarkdown("/repo/demos/invalid.demo.md", `---
theme: cinema
---

\`\`\`dailies:editor
hello
\`\`\`
`);
  assert.throws(() => compileTimeline(defaultSetTheme), /media studio set/);

  const fullScreenMonitor = parseDemoMarkdown(
    "/repo/demos/invalid.demo.md",
    MEDIA_SOURCE.replace("set: studio-monitor", "set: full-screen-media"),
  );
  assert.throws(() => compileTimeline(fullScreenMonitor), /panel: stage/);
});

test("media fingerprints bind source configuration", () => {
  const media = validateMediaData({
    type: "video",
    source: "assets/demo/clip.mp4",
    sourceOffsetMs: 2000,
    durationMs: 4000,
  });
  assert.notEqual(
    mediaConfigFingerprint(media),
    mediaConfigFingerprint({ ...media, sourceOffsetMs: 2500 }),
  );
  assert.notEqual(
    mediaConfigFingerprint(media),
    mediaConfigFingerprint({ ...media, fit: "cover" }),
  );
});

test("Chrome capture maps timeline time to exact extracted media frames", () => {
  const timeline = compileTimeline(parseDemoMarkdown("/repo/demos/dailies/inception.demo.md", MEDIA_SOURCE));
  const request = mediaFrameRequestAt(timeline, 5000, 12);

  assert.deepEqual(request, {
    eventIndex: 0,
    frameNumber: 46,
    sourceTimeMs: 8800,
  });
  assert.equal(mediaFrameRequestAt(timeline, 1000, 12), null);
  assert.equal(clampMediaFrameNumber(13, 12), 12);
  assert.throws(() => clampMediaFrameNumber(1, 0), /produced no frames/);
});

test("studio monitor previews expose deterministic media seeking", () => {
  const timeline = compileTimeline(parseDemoMarkdown("/repo/demos/dailies/inception.demo.md", MEDIA_SOURCE));
  const html = renderPreviewHtml(timeline);

  assert.match(html, /data-dailies-set="studio-monitor"/);
  assert.match(html, /id="mediaMonitor"/);
  assert.match(html, /window\.__dailiesPrepareFrame/);
  assert.match(html, /mediaContext\.drawImage/);
  assert.match(html, /scheduleInteractiveSeek/);
  assert.match(html, /A Dailies video inside a Dailies video/);
});

test("Macintosh studio previews expose period-inspired window and transport chrome", () => {
  const timeline = compileTimeline(parseDemoMarkdown(
    "/repo/demos/dailies/directors-cut.demo.md",
    MEDIA_SOURCE.replace("theme: cinema", "theme: macintosh"),
  ));
  const html = renderPreviewHtml(timeline);

  assert.match(html, /theme-macintosh/);
  assert.match(html, /class="menu-bar"/);
  assert.match(html, /class="monitor-transport"/);
  assert.match(html, /Dailies Director/);
  assert.match(html, /aspect-ratio:\s*16\s*\/\s*9/);
});

test("the set registry exposes the composable built-in presets", () => {
  assert.deepEqual(supportedSetNames(), [
    "attention-control-room",
    "editor-terminal",
    "full-screen-media",
    "studio-monitor",
  ]);
});

test("full-screen media uses the stage panel contract", () => {
  const source = MEDIA_SOURCE
    .replace("set: studio-monitor", "set: full-screen-media")
    .replace("panel: monitor", "panel: stage");
  const html = renderPreviewHtml(compileTimeline(parseDemoMarkdown("/repo/demos/full-screen.demo.md", source)));

  assert.match(html, /data-dailies-set="full-screen-media"/);
  assert.match(html, /class="workbench"/);
  assert.match(html, /display: none/);
});

test("fixture terminal commands allow only bounded Dailies npm scripts", () => {
  assert.equal(terminalCommandAllowed("relay list"), true);
  assert.equal(terminalCommandAllowed("npm run check"), true);
  assert.equal(terminalCommandAllowed("npm run render:video -- demos/dailies/inception.demo.md"), true);
  assert.equal(terminalCommandAllowed("npm exec arbitrary-package"), false);
  assert.equal(terminalCommandAllowed("npm run check && rm -rf artifacts"), false);
});
