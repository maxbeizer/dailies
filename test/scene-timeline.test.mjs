import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { cueFixtureMatches, cueSynthesisFingerprint, writeCueFixtureSidecars } from "../src/audio-cues.mjs";
import { compileTimeline, ledgerCountersMonotonic } from "../src/compile-timeline.mjs";
import { audioCuesStayWithinScenes } from "../src/evaluate-candidate.mjs";
import { parseArgs, resolveAudioProvider } from "../src/generate-audio-fixtures.mjs";
import { parseDemoMarkdown } from "../src/parse-demo.mjs";
import { renderPreviewHtml } from "../src/render-preview.mjs";
import { collectLedgerEntries } from "../src/sets/attention-control-room.mjs";

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

const LEDGER_SOURCE = `---
title: Activity ledger
set: attention-control-room
maxDurationSeconds: 20
---

\`\`\`dailies:audio-cue
line: @jonmagic
role: operator
text: First focused exchange.
displayText: First focused exchange.
showInLedger: true
ledgerTime: 08:05
ledgerSource: copilot
output: artifacts/scenes/audio/ledger-first.mp3
mode: declared-fixture
\`\`\`

\`\`\`dailies:scene
{
  "id": "ledger-one",
  "durationMs": 5000,
  "clock": "08:05",
  "headline": "The ledger starts.",
  "body": "Background activity remains visible.",
  "layout": "ledger",
  "focus": "copilot",
  "reenactment": true,
  "sourceLabel": "Copilot replay",
  "concurrency": 3,
  "ledger": [
    {
      "id": "brain-checkpoint",
      "offsetMs": 1000,
      "time": "08:07",
      "source": "brain",
      "text": "Source trail persisted."
    }
  ],
  "counters": [
    { "id": "tools", "value": 33, "label": "tool calls" },
    { "id": "turns", "value": 11, "label": "assistant turns" },
    { "id": "subagents", "value": 1, "label": "subagents" }
  ]
}
\`\`\`

\`\`\`dailies:audio-cue
line: @billythekid
role: collaborator
text: Second focused exchange.
displayText: Second focused exchange.
showInLedger: true
ledgerTime: 08:46
ledgerSource: slack
output: artifacts/scenes/audio/ledger-second.mp3
mode: declared-fixture
\`\`\`

\`\`\`dailies:scene
{
  "id": "ledger-two",
  "durationMs": 5000,
  "clock": "08:46",
  "headline": "The stream continues.",
  "body": "The first scene does not disappear.",
  "layout": "ledger",
  "focus": "slack",
  "reenactment": true,
  "sourceLabel": "Public Slack replay",
  "concurrency": 5,
  "ledger": [
    {
      "id": "github-review",
      "offsetMs": 1000,
      "time": "08:48",
      "source": "github",
      "text": "Review requested."
    }
  ],
  "counters": [
    { "id": "tools", "value": 44, "label": "tool calls" },
    { "id": "turns", "value": 18, "label": "assistant turns" },
    { "id": "subagents", "value": 2, "label": "subagents" }
  ]
}
\`\`\`
`;

test("ledger entries persist across scene boundaries", () => {
  const timeline = compileTimeline(parseDemoMarkdown("/repo/demos/scenes/ledger.demo.md", LEDGER_SOURCE));
  const entries = collectLedgerEntries(timeline);

  assert.deepEqual(entries.map((entry) => entry.text), [
    "First focused exchange.",
    "Source trail persisted.",
    "Second focused exchange.",
    "Review requested.",
  ]);
  assert.deepEqual(entries.map((entry) => entry.revealMs), [0, 1000, 5000, 6000]);
});

test("ledger previews expose one global activity stream", () => {
  const timeline = compileTimeline(parseDemoMarkdown("/repo/demos/scenes/ledger.demo.md", LEDGER_SOURCE));
  const html = renderPreviewHtml(timeline);

  assert.match(html, /class="ledger-view"/);
  assert.match(html, /id="ledgerStream"/);
  assert.match(html, /function drawLedger\(/);
  assert.match(html, /reset 08:05/i);
});

test("ledger entries must reveal inside their declared scene", () => {
  const parsed = parseDemoMarkdown(
    "/repo/demos/scenes/invalid-ledger.demo.md",
    LEDGER_SOURCE.replace('"offsetMs": 1000', '"offsetMs": 6000'),
  );

  assert.throws(() => compileTimeline(parsed), /ledger entry offsetMs/);
});

test("ledger counters cannot move backwards", () => {
  const timeline = compileTimeline(parseDemoMarkdown("/repo/demos/scenes/ledger.demo.md", LEDGER_SOURCE));
  assert.equal(ledgerCountersMonotonic(timeline), true);

  timeline.events.find((event) => event.scene?.id === "ledger-two").scene.counters[0].value = 20;
  assert.equal(ledgerCountersMonotonic(timeline), false);
});
