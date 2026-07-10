import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { cueFixtureMatches, cueSynthesisFingerprint, writeCueFixtureSidecars } from "../src/audio-cues.mjs";
import { compileTimeline } from "../src/compile-timeline.mjs";
import { audioCuesStayWithinScenes } from "../src/evaluate-candidate.mjs";
import { parseArgs, resolveAudioProvider } from "../src/generate-audio-fixtures.mjs";
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

const CUTAWAY_SOURCE = `---
title: Acted attention control
set: attention-control-room
maxDurationSeconds: 30
---

\`\`\`dailies:audio-cue
line: Copilot
role: copilot
text: I made an unsupported claim.
displayText: I made an unsupported claim.
offsetMs: 0
voice: af_heart
output: artifacts/scenes/audio/copilot-claim.mp3
mode: declared-fixture
\`\`\`

\`\`\`dailies:audio-cue
line: @jonmagic
role: operator
text: That did not happen.
displayText: That did not happen.
offsetMs: 4500
voice: am_puck
output: artifacts/scenes/audio/operator-correction.mp3
mode: declared-fixture
\`\`\`

\`\`\`dailies:scene
{
  "id": "copilot-correction",
  "durationMs": 10000,
  "clock": "Session replay",
  "kicker": "Act one",
  "headline": "The operator catches an invented premise.",
  "body": "The exchange is acted from the source trail.",
  "layout": "cutaway",
  "variant": "copilot",
  "reenactment": true,
  "sourceLabel": "Copilot session replay"
}
\`\`\`
`;

test("audio cue offsets create acted dialogue inside one scene", () => {
  const timeline = compileTimeline(parseDemoMarkdown("/repo/demos/scenes/acted.demo.md", CUTAWAY_SOURCE));

  assert.deepEqual(timeline.events.map((event) => [event.surface, event.startMs]), [
    ["audio", 0],
    ["audio", 4500],
    ["scene", 0],
  ]);
  assert.deepEqual(timeline.events.slice(0, 2).map((event) => event.sceneIndex), [0, 0]);
  assert.equal(timeline.events[2].scene.layout, "cutaway");
  assert.equal(timeline.events[2].scene.sourceLabel, "Copilot session replay");
});

test("cutaway previews expose the reenactment and dialogue contract", () => {
  const timeline = compileTimeline(parseDemoMarkdown("/repo/demos/scenes/acted.demo.md", CUTAWAY_SOURCE));
  const html = renderPreviewHtml(timeline);

  assert.match(html, /class="cutaway-view"/);
  assert.match(html, /acted, not a recording/i);
  assert.match(html, /id="globalReenactmentBadge"/);
  assert.match(html, /function currentAudioEvent\(/);
  assert.match(html, /function drawCutaway\(/);
});

test("negative audio cue offsets fail closed", () => {
  const parsed = parseDemoMarkdown("/repo/demos/scenes/invalid-offset.demo.md", CUTAWAY_SOURCE.replace("offsetMs: 4500", "offsetMs: -1"));

  assert.throws(() => compileTimeline(parsed), /audio cue offsetMs/);
});

test("audio cue offsets cannot migrate into a later scene", () => {
  const parsed = parseDemoMarkdown(
    "/repo/demos/scenes/invalid-offset.demo.md",
    CUTAWAY_SOURCE.replace("offsetMs: 4500", "offsetMs: 10500"),
  );

  assert.throws(() => compileTimeline(parsed), /must start within following scene/);
});

test("legacy candidates skip scene-boundary audio checks", async () => {
  assert.equal(await audioCuesStayWithinScenes([{ event: { startMs: 0 } }], { events: [] }), true);
});

test("audio synthesis fingerprints include provider, voice, and speed", () => {
  const cue = {
    provider: "kokoro",
    voice: "am_fenrir",
    speed: 0.9,
    text: "Might be the same actor.",
  };

  assert.notEqual(cueSynthesisFingerprint(cue), cueSynthesisFingerprint({ ...cue, speed: 1 }));
  assert.notEqual(cueSynthesisFingerprint(cue), cueSynthesisFingerprint({ ...cue, voice: "af_heart" }));
  assert.notEqual(cueSynthesisFingerprint(cue), cueSynthesisFingerprint({ ...cue, provider: "say" }));
});

test("declared audio providers are selected and enforced", () => {
  const cues = [{ provider: "kokoro" }];

  assert.equal(resolveAudioProvider(cues, null), "kokoro");
  assert.equal(resolveAudioProvider([], null), "say");
  assert.throws(() => resolveAudioProvider(cues, "say"), /requires the kokoro/);
  assert.throws(() => resolveAudioProvider([{ provider: "kokroo" }], null), /audio provider must be/);
  assert.throws(() => parseArgs(["node", "script", "demo.md", "--provider"]), /--provider requires/);
});

test("legacy fixtures adopt voice checks once metadata exists", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dailies-audio-"));
  const baseCue = {
    outputPath: path.join(directory, "cue.mp3"),
    text: "A legacy fixture.",
    voice: "voice-a",
    provider: null,
  };

  try {
    await writeCueFixtureSidecars(baseCue, "say");
    assert.equal(await cueFixtureMatches(baseCue), true);
    assert.equal(await cueFixtureMatches({ ...baseCue, voice: "voice-b" }), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
