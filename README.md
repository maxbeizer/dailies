# Dailies

**A source-driven, agent-directed studio for making deterministic demo videos.**

Dailies turns readable Markdown scenarios into timelines, browser previews, narrated MP4s, and review artifacts. Instead of editing tracks by hand, you direct scenes, sets, voices, commands, and media fixtures in source that people and agents can inspect together.

## Watch Dailies direct itself

The Director's Cut is a recursive production: Dailies renders a five-act feature reel, places that finished movie inside a System 7-inspired studio, and uses it as source footage for the next Dailies video.

> [!IMPORTANT]
> 🔊 **PRESS PLAY, THEN CLICK THE SPEAKER BUTTON. GitHub starts the narration muted.**

https://github.com/user-attachments/assets/ef9f423f-4677-43db-a9ba-38e5bb6b66c5

This one film demonstrates named sets, multiple Kokoro voices, deterministic video fixtures, synchronized player transport, captions, evaluation, provenance, and the finished output becoming the next production's input.

## What Dailies is

Dailies is designed for demos that should be:

- **Directed in source:** story, timing, narration, commands, and media remain reviewable
- **Agent-friendly:** an agent can draft, render, evaluate, and refine a candidate before asking for human feedback
- **Deterministic:** declared media maps to exact source frames instead of depending on real-time browser playback
- **Fixture-first:** terminal actions and audio are production inputs, not hidden live side effects
- **Composable:** one timeline can move between editor, terminal, control-room, studio-monitor, and full-screen sets
- **Self-reviewing:** manifests, hashes, frame samples, duration rules, and scenario assertions catch stale or incomplete candidates

Dailies is intentionally not a general-purpose nonlinear editor. Its production language stays small enough to understand, diff, regenerate, and automate.

## Quick start

Requirements:

- Node.js 22 or newer
- Google Chrome for video rendering
- `ffmpeg` and `ffprobe` for MP4 candidates and media validation
- macOS `say` or an explicitly configured audio provider for generated narration

```sh
git clone https://github.com/jonmagic/dailies.git
cd dailies

npm test
npm run check
```

The default checks are offline and dependency-free. They parse every scenario, compile its timeline, render a self-contained HTML preview, validate source contracts, and verify committed showcase provenance.

Render an interactive preview:

```sh
npm run render:preview -- demos/dailies/inception.demo.md
open artifacts/dailies/inception.preview.html
```

Render a complete local candidate:

```sh
npm run render:candidate -- demos/tsrs/queue.demo.md --provider say
```

The candidate loop compiles the timeline, renders the preview, evaluates the scenario, generates declared audio fixtures, captures the MP4, samples frames, and evaluates the final video.

## Author a production

A scenario is Markdown with production frontmatter and fenced Dailies blocks:

````markdown
---
title: Product launch
slug: product-launch
set: studio-monitor
theme: macintosh
executionMode: fixture-only
audioProvider: say
timeline: artifacts/product-launch/timeline.json
preview: artifacts/product-launch/preview.html
video: artifacts/product-launch/video.mp4
renderManifest: artifacts/product-launch/render.json
evaluation: artifacts/product-launch/evaluation.json
---

# Product launch

```dailies:audio-cue
line: Director
sayVoice: Samantha
text: Start with the source, then show the finished product.
output: artifacts/product-launch/audio/opening.mp3
mode: declared-fixture
```

```dailies:editor
# The plan

Explain the change.
Show the proof.
End with the result.
```

```dailies:terminal
$ npm run check
status=pass
```

```dailies:media
type: video
source: assets/demo/dailies-seed.mp4
panel: monitor
sourceOffsetMs: 0
durationMs: 8000
fit: contain
audio: muted
transition: fade
fadeMs: 350
caption: The previous Dailies output becomes this production's input.
```
````

Save the scenario as `demos/product-launch.demo.md`, then compile and preview it:

```sh
npm run compile:demo -- demos/product-launch.demo.md
npm run render:preview -- demos/product-launch.demo.md
npm run evaluate:demo -- demos/product-launch.demo.md
```

## Production language

| Block | Purpose |
| --- | --- |
| `dailies:editor` | Types authored source into the editor surface |
| `dailies:terminal` | Stages terminal commands and fixture output |
| `dailies:audio-cue` | Declares a speaker, voice, text, timing, and generated audio fixture |
| `dailies:scene` | Directs a structured control-room scene |
| `dailies:media` | Places a deterministic MP4 source window into a supported panel |
| `dailies:self-review` | Declares artifacts and candidate checks that must pass |

Audio cues immediately before a scene belong to that scene. Their `offsetMs` values are scene-relative, and compilation fails if a cue would migrate into a later scene. Media paths must be repository-relative MP4 files under `assets/`.

## Built-in sets

| Set | Best for |
| --- | --- |
| `editor-terminal` | Source authoring and command-line demos |
| `attention-control-room` | Structured stories with lanes, metrics, dialogue, and activity ledgers |
| `studio-monitor` | Source and commands beside a 16:9 program monitor |
| `full-screen-media` | Declared video as the primary stage |

Studio productions can select `dark`, `cinema`, `light`, or `macintosh` themes and control media fit, fades, captions, backgrounds, and final-state holds from source.

## Deterministic video fixtures

Declared media does not play freely while Chrome captures the screen. Dailies:

1. Validates the repository-relative asset path and requested source window.
2. Uses `ffprobe` to confirm the source can satisfy the declaration.
3. Extracts the exact source window at the capture frame rate with `ffmpeg`.
4. Maps each timeline time to a specific extracted frame.
5. Injects that frame into the browser set before taking the screenshot.
6. Records source, configuration, production, audio, timeline, and output hashes.

The same timeline frame therefore requests the same source frame. Interactive HTML previews still use the browser video element, while final Chrome capture uses extracted frames as the source of truth.

Media audio is currently muted by design. Narration is mixed separately through declared audio cues, keeping source-video playback out of the browser-capture boundary.

## Audio providers

Dailies keeps audio generation behind a fixture provider boundary:

- `say`: local macOS speech for the simplest development path
- `kokoro`: richer local voices through a compatible non-speaking wrapper
- `speechify`: optional networked generation through a compatible wrapper

Scenario frontmatter can pin `audioProvider`. Cue sidecars fingerprint the text, provider, voice, and speed so stale narration cannot be reused after direction changes.

Kokoro and Speechify require compatible wrapper commands. Set `TSRS_KOKORO_HELPER` or `TSRS_SPEECHIFY_HELPER` to their executable paths when they are not available through the default local integration. The Director's Cut pins Kokoro, so regenerating its narration requires that helper; watching, previewing, and validating the committed showcase does not.

Provider wrappers generate files; they never speak directly. Live playback, paid providers, credentials, and external side effects remain opt-in.

## Example productions

### Dailies Director's Cut

[`demos/dailies/inception.demo.md`](demos/dailies/inception.demo.md) is the outer System 7-inspired production shown above. It uses three windows from a Dailies-generated feature reel and distinct Director, Production Designer, and Evaluator voices.

### Dailies feature reel

[`demos/dailies/feature-reel.demo.md`](demos/dailies/feature-reel.demo.md) is the five-act inner film. It demonstrates source compilation, named sets, audio direction, deterministic media, evaluation, and recursive production.

### Recursive seed

[`demos/dailies/seed.demo.md`](demos/dailies/seed.demo.md) preserves the smaller proof that a Dailies output can become a committed media fixture for another Dailies production.

### Relay CLI

Relay is a notification CLI used here to demonstrate editor-and-terminal stories, queued updates, mute controls, pruning stale work, and voice identity. The original Dailies suite includes:

- [`queue.demo.md`](demos/tsrs/queue.demo.md)
- [`live-mode.demo.md`](demos/tsrs/live-mode.demo.md)
- [`prune-before-ready.demo.md`](demos/tsrs/prune-before-ready.demo.md)
- [`line-voices.demo.md`](demos/tsrs/line-voices.demo.md)
- [`provider-boundary.demo.md`](demos/tsrs/provider-boundary.demo.md)

## Commands

| Command | Result |
| --- | --- |
| `npm test` | Run parser, compiler, evaluator, renderer-contract, and cleanup tests |
| `npm run check` | Validate every scenario and committed showcase |
| `npm run clean` | Remove generated artifacts and restore the placeholder |
| `npm run compile:demo -- <scenario>` | Compile scenario source into timeline JSON |
| `npm run render:preview -- <scenario>` | Produce a self-contained interactive HTML preview |
| `npm run generate:audio -- <scenario>` | Generate declared narration fixtures |
| `npm run evaluate:demo -- <scenario>` | Validate source and preview contracts |
| `npm run render:video -- <scenario>` | Capture and mix the MP4 |
| `npm run evaluate:candidate -- <scenario>` | Validate the rendered video and sample frames |
| `npm run render:candidate -- <scenario>` | Run the complete local production loop |

`render:video` uses `DAILIES_RENDERER=auto` by default. It tries local ZShot first and falls back to Chrome DevTools capture. Scenarios containing `dailies:media` always use Chrome so deterministic frame injection remains enforced.

> [!TIP]
> [ZShot](https://zshot-app.com/) is an optional power-up for fast local browser capture, diagnostics, and additional output formats. Dailies still works with its Chrome fallback, and media-fixture productions always use Chrome for deterministic frame injection.

Set `CHROME_PATH` when Chrome is installed outside its standard location. `DAILIES_CHROME_FPS` controls capture cadence before `ffmpeg` produces the 30 fps H.264 output.

## Artifacts and provenance

Authored scenarios and reusable fixtures live under `demos/` and `assets/`. Generated timelines, previews, audio, manifests, sampled frames, and candidate movies live under ignored `artifacts/`.

Reviewed showcase MP4s are committed deliberately. Their neighboring provenance files let `npm run check` verify scenario, timeline, media, production, and output hashes without pretending MP4 bytes are reproducible across every `ffmpeg` version.

See [`docs/artifacts.md`](docs/artifacts.md) for the complete policy and regeneration workflow.

## Current boundaries

- Scenario terminal commands are fixture text; Dailies does not execute them.
- Media inputs are MP4 files under `assets/`.
- Media source audio is muted.
- Chrome is required for deterministic media capture.
- Narrated candidates require an available audio provider.
- The package remains private to prevent accidental npm publication; distribution is repository-first.

These constraints keep the default workflow inspectable, local, and safe while the studio language evolves.

## Contributing

Dailies is licensed under the ISC License. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) for the fixture-first development workflow, [`AGENTS.md`](AGENTS.md) for repository guidance, and [`SECURITY.md`](SECURITY.md) for private vulnerability reporting.
