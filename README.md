# Dailies

Create Copilot-directed demo dailies from scenario sources, rendered editor and terminal performances, Relay CLI actions, generated audio fixtures, browser-friendly video exports, and self-review artifacts that let the agent decide when a candidate is ready for human feedback.

Dailies treats Copilot like the director/operator of a demo. The agent can draft the scenario, compile a timeline, inspect the generated artifacts, evaluate what is missing, and keep iterating before asking for a human watch-through.

## First use case

The first demo target is Relay CLI in action:

1. An editor surface shows the user writing Markdown narration for the scenario.
2. A terminal surface shows the same user typing and running `relay` commands.
3. Audio cues are declared as fixtures and can later be generated through the non-speaking TSRS Kokoro or Speechify wrappers.
4. The agent reviews source, timeline, audio declarations, generated artifacts, and evaluation reports before asking for feedback.

Current Relay demos:

- `demos/tsrs/queue.demo.md`: Focus mode queues updates until the user asks for one.
- `demos/tsrs/live-mode.demo.md`: Live mode plays updates automatically while Mute remains the safety override.
- `demos/tsrs/prune-before-ready.demo.md`: Skip stale work and clear a noisy line before releasing one useful update.
- `demos/tsrs/line-voices.demo.md`: Line identity moves from text labels into distinct Kokoro voice ids.
- `demos/tsrs/provider-boundary.demo.md`: Kokoro is configured through the provider boundary while TSRS still owns playback.




## Commands

```sh
npm test
npm run clean
npm run compile:demo -- demos/tsrs/queue.demo.md
npm run generate:audio -- demos/tsrs/queue.demo.md --provider say
npm run render:preview -- demos/tsrs/queue.demo.md
npm run evaluate:demo -- demos/tsrs/queue.demo.md
npm run check
npm run render:video -- demos/tsrs/queue.demo.md
npm run evaluate:candidate -- demos/tsrs/queue.demo.md
npm run render:candidate -- demos/tsrs/queue.demo.md --provider kokoro
npm run render:candidate -- demos/tsrs/queue.demo.md --provider say
npm run render:candidate -- demos/tsrs/live-mode.demo.md --provider say
npm run render:candidate -- demos/tsrs/prune-before-ready.demo.md --provider say
npm run render:candidate -- demos/tsrs/line-voices.demo.md --provider kokoro
npm run render:candidate -- demos/tsrs/provider-boundary.demo.md --provider kokoro
DAILIES_RENDERER=chrome npm run render:candidate -- demos/dailies/inception.demo.md --provider say
```

The default check is intentionally offline and dependency-free. It parses each scenario under `demos/`, compiles a timeline JSON artifact, renders a self-contained HTML preview, and evaluates each scenario against the first self-review gates. `render:video` is opt-in because it needs either local ZShot or Google Chrome plus ffmpeg.

`render:candidate` is the full local candidate loop: compile, preview, evaluate the demo source, generate audio fixtures, render MP4, and run the candidate gate.

Terminal command output appears instantly once a command finishes; only user-authored editor text and terminal commands are typed out.

`npm run clean` removes generated files under `artifacts/` and restores the tracked placeholder. Authored scenarios and committed fixtures under `assets/` are never cleanup targets.

## Sets and scenes

The default set remains the original editor plus terminal stage. A scenario can select another built-in set with frontmatter:

```yaml
set: attention-control-room
audioProvider: kokoro
maxDurationSeconds: 120
```

The attention control room consumes explicit JSON scene blocks. Put one or more audio cues immediately before the scene they belong to. `offsetMs` is relative to that following scene, and at least one cue must begin at offset `0`:

````markdown
```dailies:audio-cue
line: Narrator
text: Five workspaces are active at once.
output: artifacts/scenes/audio/five-workspaces.mp3
mode: declared-fixture
```

```dailies:audio-cue
line: Operator
text: Route the next decision.
offsetMs: 4500
output: artifacts/scenes/audio/route-decision.mp3
mode: declared-fixture
```

```dailies:scene
{
  "id": "five-workspaces",
  "durationMs": 10000,
  "clock": "08:19",
  "headline": "Five workspaces overlap.",
  "body": "The foreground moves while bounded agents continue in parallel."
}
```
````

Scene data is validated before compilation. Audio cues are bound to the following scene and compilation fails if an offset starts outside that scene. Actual generated cue durations are checked again during candidate evaluation. The control-room renderer supports `kicker`, `camera`, `accent`, `concurrency`, `foreground`, `lanes`, and `metrics` in addition to the required fields above.

Ledger scenes use `layout: ledger`. Their compact `ledger` entries declare `id`, `time`, `source`, `text`, and a scene-relative `offsetMs`. Entries from every scene are merged into one timeline-global stream, so prior activity remains visible after the headline or focus changes. Audio cues can join the same stream with `showInLedger: true`, `ledgerTime`, and `ledgerSource`; the active dialogue row expands while ambient activity stays visible.

Ledger `counters` are authored cumulative snapshots and must never move backwards across scenes. `maxAudioGapMs` adds a candidate-time pacing gate based on actual generated audio duration, including the final tail.

## Media fixtures and studio sets

Pre-existing MP4 video is a declared timeline fixture:

````markdown
```dailies:media
type: video
source: assets/demo/dailies-seed.mp4
panel: monitor
offsetMs: 0
sourceOffsetMs: 0
durationMs: 11000
fit: cover
audio: muted
transition: fade
fadeMs: 500
caption: A Dailies-rendered film inside a Dailies-rendered film.
```
````

Media paths must be repository-relative, remain under `assets/`, and point to MP4 files. Source evaluation checks path safety and existence without adding npm dependencies. When `ffprobe` is available it also checks the requested source window; candidate evaluation requires that check.

Media audio is deliberately muted in the first contract. Narration still uses normal `dailies:audio-cue` fixtures and ffmpeg mixing. A future source-audio mode can enter through that same explicit mixing boundary rather than browser capture.

Built-in sets:

- `editor-terminal`: the original source and fixture-command stage
- `attention-control-room`: scene-driven productions
- `studio-monitor`: source and command panels beside a program monitor
- `full-screen-media`: the declared media feed as the primary stage

`studio-monitor` fixtures target `panel: monitor`; `full-screen-media` fixtures target `panel: stage`. Media and production controls fail closed on sets that do not render them.

Media timelines always use the Chrome renderer. For every captured frame, Dailies seeks the hidden source video to `sourceOffsetMs + elapsedTimelineMs`, waits for `seeked`, draws the decoded frame into a canvas, and only then takes the screenshot. This avoids depending on real-time browser playback.

Lightweight production controls stay source-driven:

- `theme: dark`, `cinema`, or `light`
- optional `background: assets/...` image
- `panel: monitor` or `stage`
- `fit: contain` or `cover`
- `transition: cut` or `fade`
- optional `caption`

These controls are intentionally smaller than a generic timeline, track, plugin, or drag-and-drop editing system.

## The recursive public demo

`demos/dailies/seed.demo.md` renders a short Dailies film. A reviewed copy is committed as `assets/demo/dailies-seed.mp4`.

`demos/dailies/inception.demo.md` then uses that Dailies-produced MP4 as its declared program-monitor input. The outer film shows Dailies authoring and checking the scenario while the inner Dailies film plays inside it.

The rendered showcase is committed at [`assets/demo/dailies-inception.mp4`](assets/demo/dailies-inception.mp4), so the recursive result is watchable without rebuilding the toolchain.

The committed seed is not regenerated in CI because MP4 bytes can vary across ffmpeg versions. See `docs/artifacts.md` for the deliberate regeneration workflow.

Committed showcase provenance is deterministic even when MP4 generation is not. `npm run check` verifies the scenario, compiled timeline, input fixture, and output video hashes recorded beside each showcase.

## Video renderers

`render:video` uses `DAILIES_RENDERER=auto` by default. Auto tries ZShot first and falls back to dependency-free Chrome DevTools capture when ZShot is missing or unavailable. Scenarios with `dailies:media` bypass ZShot and require Chrome so deterministic seeking remains enforced.

```sh
DAILIES_RENDERER=zshot npm run render:video -- demos/tsrs/queue.demo.md
```

Set `CHROME_PATH` when Chrome is not installed at the standard macOS application path. `DAILIES_CHROME_FPS` controls the Chrome capture rate before ffmpeg produces the 30 fps H.264 output; the default is 12 fps for mostly static Dailies sets.


Generated artifacts for each demo follow the scenario frontmatter. The first two demos write:

- `artifacts/tsrs/queue.timeline.json`
- `artifacts/tsrs/queue.preview.html`
- `artifacts/tsrs/queue.evaluation.json`
- `artifacts/tsrs/queue.mp4` when `npm run render:video` succeeds
- `artifacts/tsrs/live-mode.timeline.json`
- `artifacts/tsrs/live-mode.preview.html`
- `artifacts/tsrs/live-mode.evaluation.json`
- `artifacts/tsrs/live-mode.mp4` when `npm run render:video` succeeds
- `artifacts/tsrs/prune-before-ready.timeline.json`
- `artifacts/tsrs/prune-before-ready.preview.html`
- `artifacts/tsrs/prune-before-ready.evaluation.json`
- `artifacts/tsrs/prune-before-ready.mp4` when `npm run render:video` succeeds
- `artifacts/<demo-group>/frames/<demo>/*.webp` compact candidate-review frame samples

Generated artifacts stay ignored. Deliberate reusable fixtures live under `assets/`; the complete policy is in `docs/artifacts.md`.

Use `--provider kokoro` with `generate:audio` when real local Kokoro fixture generation is intended and the optional TSRS Kokoro venv is already installed. A scenario can instead pin `audioProvider` in frontmatter; generation uses that provider automatically and rejects conflicting CLI overrides. Generated fixture sidecars bind each audio file to its text, provider, voice, and speed so stale audio cannot be reused after a cue configuration change. Set `TSRS_KOKORO_HELPER` to the non-speaking TSRS wrapper path when the sibling `../tri-state-relay-service/scripts/kokoro-voice-command` helper is not available. Use `--provider speechify` only when real Speechify fixture generation is intended and local credentials are already configured. Set `TSRS_SPEECHIFY_HELPER` to the non-speaking TSRS wrapper path, or put a compatible `speechify` command on `PATH`. The default development path can use the local macOS `say` voice so the video has an audio cue without touching a paid/network provider.

## Agent harness

Start with `AGENTS.md` for repository instructions. Project-specific skills live under `.github/skills/` when a repeated workflow earns one.

## Contributing and license

Dailies is licensed under the ISC License. See `CONTRIBUTING.md` for the fixture-first development workflow and `SECURITY.md` for private vulnerability-reporting guidance.

The package remains `"private": true` to prevent accidental npm publication. Open source distribution is repository-first; no npm package or remote publication is required by the current release floor.
