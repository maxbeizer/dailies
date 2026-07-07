# Dailies Agent Guide

These instructions apply to the whole repository unless a deeper `AGENTS.md` overrides them. The closest `AGENTS.md` wins.

## Mission

Create Copilot-directed demo dailies from scenario sources, rendered editor and terminal performances, Relay CLI actions, generated audio fixtures, browser-friendly video exports, and self-review artifacts that let the agent decide when a candidate is ready for human feedback.

## Start Here

1. Read `README.md` and the nearest `AGENTS.md` before making changes.
2. Check `git status --short` before editing.
3. Preserve user edits. Never reset, checkout, or overwrite dirty files unless explicitly asked.
4. Prefer project skills in `.github/skills/` for reusable workflows and domain guidance.

## Non-negotiables

1. Do not estimate timelines unless the user explicitly asks.
2. Use red-green-refactor wherever practical.
3. Keep docs close to behavior and update them in the same slice.
4. Ask before destructive or irreversible changes, adding secrets, widening privileges, publishing, purchasing, or making external side effects.
5. Prefer quality over speed. Use critical review for changes with meaningful security, privacy, data-handling, architecture, production, or product-risk consequences.
6. Default to fixture-only demos. Do not execute live `relay` commands, touch the real TSRS queue, speak audio, or call paid/network voice providers unless an explicit task asks for that mode.
7. Agents should inspect their own inputs and outputs before interrupting the user. Ask for human feedback only after a complete candidate demo has passed the available self-review gates.

## Development Harness

Tooling: Plain JavaScript/HTML first; optional ffmpeg for MP4 conversion; TSRS/Speechify helpers for local audio fixtures; Remotion only after dependency audit.

Current commands:

```sh
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

There are no third-party npm dependencies yet. Do not run `npm install` unless package manifests change or validation fails because an existing dependency is missing. `npm run check` discovers every `demos/**/*.demo.md` scenario and runs the offline preview/evaluation gate for each one. `render:video` uses the local ZShot CLI when available and is intentionally outside the default offline gate. `generate:audio --provider say` uses local macOS speech plus ffmpeg conversion; `--provider kokoro` uses the optional local TSRS Kokoro helper when its venv is installed; `--provider speechify` is opt-in because it is networked, credentialed, and potentially paid. `render:candidate` runs the complete local candidate loop.

## ZShot Visual Harness

Use ZShot for browser-backed captures when visual output, rendered HTML, page state, diagnostics, or agent-readable snapshots would improve confidence. On jonmagic's Mac, the bundled CLI is usually available at `~/Library/Application Support/ZShot/zshot`; discover capabilities with `zshot --agent-help`, `zshot --help`, and `zshot --help all`.

Recommended default checks:

1. Capture rendered HTML for low-friction smoke checks: `zshot -t html -f zshot-artifacts/<name>.html <url>`.
2. Use screenshots, PDF, HAR, WARC, Markdown, AXTree, trace, or pprof only when the local license supports the output type.
3. Keep generated ZShot artifacts out of commits unless they are intentional fixtures or documentation assets.
4. Do not send secrets, private app data, or sensitive URLs through third-party services for capture.

## Architecture and Boundaries

Dailies is an agentic demo workbench, not just a terminal recorder. The first Relay use case has two rendered surfaces: an editor-like surface where the user writes Markdown narration and a terminal-like surface where the same user types and runs `relay` commands. Future renderers can cut between those surfaces or show both at the same time.

Demo timing should feel like a real operator: editor text and terminal commands type quickly enough to stay engaging, while CLI output appears instantly after each command instead of being typed character by character.

Rendered editor and terminal surfaces should keep chrome thin and quiet. Prioritize scenario content over labels, window decoration, and status text. Avoid outer branding/header chrome unless the scenario specifically needs it. Keep the outer stage padding consistent, place the progress bar close to the surface bottoms, and keep macOS-style window controls consistently on the left.

Keep the core workflow anchored:

1. **Deterministic prefix:** parse scenario files, compile timelines, collect declared artifacts, and scope command/audio inputs.
2. **AI decision step:** propose narration, command sequences, pacing, visual edits, and whether a candidate appears ready.
3. **Validation step:** run deterministic checks over scenario text, commands, artifacts, frame captures, audio manifests, and video files.
4. **Deterministic suffix:** render, write artifacts, synthesize approved audio fixtures, or ask for human review only after validation passes.

Initial source layout:

- `demos/`: source scenarios and fixture declarations.
- `src/`: dependency-free parser, compiler, and evaluator modules.
- `scripts/`: thin command wrappers for repeatable agent use.
- `artifacts/`: ignored generated timelines, evaluation reports, audio, frames, and videos.

TSRS audio boundary:

- Prefer the non-speaking TSRS Speechify wrapper for real audio fixtures when explicitly requested: `<app-bin>/speechify --text-file <text-file> --output-file <output-file> --voice-id <voice-id> --keychain-service TSRS_SPEECHIFY_API_KEY`.
- Prefer the non-speaking TSRS Kokoro wrapper for local richer voice fixtures when the optional venv is installed: `<app-bin>/kokoro --venv ~/.local/share/tsrs-kokoro/venv --text-file <text-file> --output-file <output-file> --voice-id <voice-id>`.
- The wrapper writes an audio file and never speaks directly. That makes it suitable for fixture generation, not live demo playback.
- Configure Kokoro through `TSRS_KOKORO_HELPER` or the sibling TSRS helper path; do not hard-code user-local absolute helper paths in source or artifacts.
- Configure Speechify through `TSRS_SPEECHIFY_HELPER` or a compatible `speechify` command on `PATH`; do not hard-code user-local absolute helper paths in source or artifacts.
- Keep real Speechify generation opt-in because it is networked, credentialed, and potentially paid. The default evaluator must work offline.
- Never store API keys, provider secrets, raw private Relay queue content, or generated provider metadata in this repo.

Relay command boundary:

- Scenario terminal commands are fixture text by default.
- Any future live execution path must use a temp database or explicit dry-run mode and must fail closed unless an allowlist and human approval are present.
- Do not speak arbitrary terminal output, logs, secrets, file contents, or private data.

## Agent Workflow

- Make focused, reviewable slices.
- Use direct tools for bounded search, reads, and small edits.
- Add or update project skills only when repeated workflows justify a routing-friendly skill.
- Use red-green-refactor where practical: write or identify the failing expectation first, make the smallest working change, then clean up while preserving behavior.
- Rubber-duck high-stakes or ambiguous work before treating the direction as settled, especially around security, privacy, data handling, external services, persistence, deployment, permissions, or broad architecture.
- If an agent miss happens, improve the durable harness with the smallest useful artifact: instructions, docs, scripts, tests, or guardrails.
- Leave the repo easier for the next agent: capture newly discovered commands, constraints, validation steps, and project-specific gotchas in the closest durable file.

## Self-Review Before Human Feedback

A demo candidate is not ready for human feedback just because it rendered. The agent should first verify:

1. Scenario source parses without warnings.
2. Timeline artifact exists and contains editor and terminal events.
3. Terminal commands are fixture-only and match the scenario.
4. Audio cues are declared without requiring live speech or network synthesis by default.
5. Secret/private-path scans pass across editor text, terminal text, captions, and audio cue text.
6. Generated artifacts listed by the scenario exist, except outputs intentionally deferred by the current slice.
7. Preview HTML exists, contains both surfaces, and does not expose private local paths.
8. Video output exists before claiming there is a full candidate demo.
9. Candidate frame samples use compact WebP by default; do not generate full-size PNGs unless lossless inspection is specifically needed.

Deterministic checks can prove structure and obvious safety constraints. They cannot prove a video feels good, pacing is right, or audio is emotionally effective. Treat those as candidate-review findings, not automatic truth.

## Task Exit Criteria

1. Closest available validation passes.
2. Behavior is verified automatically or manually.
3. Documentation is updated when commands, behavior, workflow, or constraints change.
4. Completed local milestones are committed with a semantic commit once validation passes.
5. Handoff names changed files and remaining risks.

## Ask First

Ask before:

- touching broad or unrelated areas of the repo
- introducing a new framework, background worker, MCP server, queue, or sub-agent layer
- changing persistence, permissions, authentication, authorization, billing, or deployment behavior
- pushing to a remote if one is added and the user has not asked for publish/share behavior
