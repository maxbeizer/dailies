import assert from "node:assert/strict";
import test from "node:test";
import { compileTimeline } from "../src/compile-timeline.mjs";
import { parseDemoMarkdown } from "../src/parse-demo.mjs";
import { renderPreviewHtml } from "../src/render-preview.mjs";

const SCENE_SOURCE = `---
title: Attention control
set: attention-control-room
maxDurationSeconds: 120
---

\`\`\`dailies:audio-cue
line: Narrator
voice: am_puck
text: Five workspaces are active at once.
output: artifacts/scenes/audio/five-workspaces.mp3
mode: declared-fixture
\`\`\`

\`\`\`dailies:scene
{
  "id": "five-workspaces",
  "durationMs": 9000,
  "clock": "08:19",
  "kicker": "Concurrency",
  "headline": "Five workspaces overlap.",
  "body": "The foreground keeps moving while bounded agents continue in parallel.",
  "camera": "push",
  "accent": "copilot",
  "concurrency": 5,
  "foreground": {
    "label": "Human foreground",
    "action": "Route the next decision"
  },
  "lanes": [
    {
      "id": "copilot",
      "label": "Copilot",
      "status": "5 active",
      "active": true,
      "items": ["FR handoff", "Weekly snippets"]
    }
  ]
}
\`\`\`
`;

test("scene blocks compile into an explicitly timed named set", () => {
  const parsed = parseDemoMarkdown("/repo/demos/scenes/work.demo.md", SCENE_SOURCE);
  const sceneBlock = parsed.blocks.find((block) => block.type === "scene");

  assert.equal(sceneBlock.data.id, "five-workspaces");

  const timeline = compileTimeline(parsed);
  assert.equal(timeline.set, "attention-control-room");
  assert.equal(timeline.maxDurationSeconds, 120);
  assert.equal(timeline.durationMs, 9000);
  assert.deepEqual(timeline.events.map((event) => [event.surface, event.startMs]), [
    ["audio", 0],
    ["scene", 0],
  ]);
  assert.equal(timeline.events[1].scene.concurrency, 5);
});

test("attention control room previews keep the ZShot driver contract", () => {
  const timeline = compileTimeline(parseDemoMarkdown("/repo/demos/scenes/work.demo.md", SCENE_SOURCE));
  const html = renderPreviewHtml(timeline);

  assert.match(html, /id="stage"/);
  assert.match(html, /data-dailies-set="attention-control-room"/);
  assert.match(html, /params\.get\("autoplay"\)/);
  assert.match(html, /params\.get\("chrome"\)/);
  assert.match(html, /params\.get\("t"\)/);
  assert.match(html, /let playing =/);
  assert.match(html, /let startTimestamp =/);
  assert.match(html, /let startedAtMs =/);
  assert.match(html, /let currentMs =/);
  assert.match(html, /function draw\(/);
});

test("legacy demos do not gain named-set metadata", () => {
  const parsed = parseDemoMarkdown("/repo/demos/legacy.demo.md", `# Legacy

\`\`\`dailies:editor
hello
\`\`\`

\`\`\`dailies:terminal
$ relay list
empty
\`\`\`
`);
  const timeline = compileTimeline(parsed);

  assert.equal("set" in timeline, false);
  assert.deepEqual(timeline.events.map((event) => event.surface), ["editor", "terminal", "terminal"]);
});

test("invalid scene JSON fails closed", () => {
  const parsed = parseDemoMarkdown("/repo/demos/scenes/invalid.demo.md", `---
set: attention-control-room
---

\`\`\`dailies:scene
{"id":"broken","clock":"08:19","headline":"Broken scene","body":"No duration was declared."}
\`\`\`
`);

  assert.throws(() => compileTimeline(parsed), /scene durationMs/);
});
