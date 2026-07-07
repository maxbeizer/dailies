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
npm run evaluate:demo -- demos/tsrs/queue.demo.md
npm run check
```

The initial implementation is intentionally offline and dependency-free. It parses one scenario, compiles a timeline JSON artifact, and evaluates the scenario against the first self-review gates.

## Agent harness

Start with `AGENTS.md` for repository instructions. Project-specific skills live under `.github/skills/` when a repeated workflow earns one.
