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
```

The default check is intentionally offline and dependency-free. It parses each scenario under `demos/`, compiles a timeline JSON artifact, renders a self-contained HTML preview, and evaluates each scenario against the first self-review gates. `render:video` is opt-in because it needs either local ZShot or Google Chrome plus ffmpeg.

`render:candidate` is the full local candidate loop: compile, preview, evaluate the demo source, generate audio fixtures, render MP4, and run the candidate gate.

Terminal command output appears instantly once a command finishes; only user-authored editor text and terminal commands are typed out.

## Sets and scenes

The default set remains the original editor plus terminal stage. A scenario can select another built-in set with frontmatter:

```yaml
set: attention-control-room
maxDurationSeconds: 120
```

The attention control room consumes explicit JSON scene blocks. Put each narration cue immediately before its scene so they share a start time:

````markdown
```dailies:audio-cue
line: Narrator
text: Five workspaces are active at once.
output: artifacts/scenes/audio/five-workspaces.mp3
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

Scene data is validated before compilation. The control-room renderer supports `kicker`, `camera`, `accent`, `concurrency`, `foreground`, `lanes`, and `metrics` in addition to the required fields above.

## Video renderers

`render:video` uses `DAILIES_RENDERER=auto` by default. Auto tries ZShot first and falls back to dependency-free Chrome DevTools capture when ZShot is missing or unavailable.

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

Use `--provider kokoro` with `generate:audio` when real local Kokoro fixture generation is intended and the optional TSRS Kokoro venv is already installed. Set `TSRS_KOKORO_HELPER` to the non-speaking TSRS wrapper path when the sibling `../tri-state-relay-service/scripts/kokoro-voice-command` helper is not available. Use `--provider speechify` only when real Speechify fixture generation is intended and local credentials are already configured. Set `TSRS_SPEECHIFY_HELPER` to the non-speaking TSRS wrapper path, or put a compatible `speechify` command on `PATH`. The default development path can use the local macOS `say` voice so the video has an audio cue without touching a paid/network provider.

## Agent harness

Start with `AGENTS.md` for repository instructions. Project-specific skills live under `.github/skills/` when a repeated workflow earns one.
