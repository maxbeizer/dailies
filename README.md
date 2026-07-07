# Dailies

Create Copilot-directed demo dailies from scenario sources, rendered editor and terminal performances, Relay CLI actions, generated audio fixtures, browser-friendly video exports, and self-review artifacts that let the agent decide when a candidate is ready for human feedback.

Dailies treats Copilot like the director/operator of a demo. The agent can draft the scenario, compile a timeline, inspect the generated artifacts, evaluate what is missing, and keep iterating before asking for a human watch-through.

## First use case

The first demo target is Relay CLI in action:

1. An editor surface shows the user writing Markdown narration for the scenario.
2. A terminal surface shows the same user typing and running `relay` commands.
3. Audio cues are declared as fixtures and can later be generated through the non-speaking TSRS Speechify wrapper.
4. The agent reviews source, timeline, audio declarations, generated artifacts, and evaluation reports before asking for feedback.

## Commands

```sh
npm run compile:demo -- demos/tsrs/queue.demo.md
npm run generate:audio -- demos/tsrs/queue.demo.md --provider say
npm run render:preview -- demos/tsrs/queue.demo.md
npm run evaluate:demo -- demos/tsrs/queue.demo.md
npm run check
npm run render:video -- demos/tsrs/queue.demo.md
npm run evaluate:candidate -- demos/tsrs/queue.demo.md
npm run render:candidate -- demos/tsrs/queue.demo.md --provider say
```

The default check is intentionally offline and dependency-free. It parses one scenario, compiles a timeline JSON artifact, renders a self-contained HTML preview, and evaluates the scenario against the first self-review gates. `render:video` is opt-in because it depends on local ZShot availability.

`render:candidate` is the full local candidate loop: compile, preview, evaluate the demo source, generate audio fixtures, render MP4, and run the candidate gate.

Generated artifacts for the first demo:

- `artifacts/tsrs/queue.timeline.json`
- `artifacts/tsrs/queue.preview.html`
- `artifacts/tsrs/queue.evaluation.json`
- `artifacts/tsrs/queue.mp4` when `npm run render:video` succeeds
- `artifacts/tsrs/frames/*.webp` compact candidate-review frame samples

Use `--provider speechify` with `generate:audio` only when real Speechify fixture generation is intended and local credentials are already configured. Set `TSRS_SPEECHIFY_HELPER` to the non-speaking TSRS wrapper path, or put a compatible `speechify` command on `PATH`. The default development path can use the local macOS `say` voice so the video has an audio cue without touching a paid/network provider.

## Agent harness

Start with `AGENTS.md` for repository instructions. Project-specific skills live under `.github/skills/` when a repeated workflow earns one.
