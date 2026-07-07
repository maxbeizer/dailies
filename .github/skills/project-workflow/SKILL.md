---
name: project-workflow
description: Guides Dailies demo creation and self-review. Use when creating, compiling, rendering, evaluating, or improving Copilot-directed demo scenarios, especially Relay CLI demos with editor, terminal, audio, and video artifacts.
---

# Dailies Project Workflow

Use this skill for Dailies work that benefits from focused guidance beyond `AGENTS.md`: creating demo scenarios, compiling timelines, generating safe audio fixtures, rendering previews, evaluating artifacts, or deciding whether a candidate is ready for human feedback.

## Workflow

1. Read `AGENTS.md` and any relevant local docs.
2. Check `git status --short`.
3. Identify the smallest useful demo slice and the artifact that will prove it moved forward.
4. Use the anchored workflow: deterministic input collection, bounded AI decisions, deterministic validation, then rendering or handoff.
5. Keep live side effects off by default. Scenario commands are fixtures unless a task explicitly approves live execution.
6. Make the change with nearby documentation updates.
7. Run the closest available validation, usually `npm run check` for the initial scenario slice.
8. Improve the harness if the work reveals a durable command, constraint, validation step, or agent gotcha.
9. Ask for human feedback only after a complete candidate passes current self-review gates, or report the specific blocker.

## Anchored Demo Loop

1. **Plan:** write or update a scenario with editor text, terminal commands, expected output, audio cues, and self-review criteria.
2. **Compile:** run `npm run compile:demo -- <scenario>` to produce a timeline artifact.
3. **Preview:** run `npm run render:preview -- <scenario>` to produce a self-contained local HTML preview.
4. **Evaluate:** run `npm run evaluate:demo -- <scenario>` and read the JSON report.
5. **Iterate:** fix the scenario, compiler, renderer, or evaluator based on concrete findings.
6. **Candidate:** run `npm run render:candidate -- <scenario> --provider say` for the complete local loop.
7. **Audio:** use `npm run generate:audio -- <scenario> --provider speechify` only when real provider output is intended.
8. **Candidate gate:** inspect `npm run evaluate:candidate -- <scenario>` output and sampled frames before asking the user to watch.
9. **Review:** inspect source, timeline, preview, evaluation report, visual captures, audio manifest, and video before asking the user to watch.

## Quality Loop

1. Prefer quality over speed for consequential changes.
2. Use critical review before adding new third-party services, persistence, deployment, credential handling, permission changes, or broad architecture.
3. If an agent miss happens, update `AGENTS.md`, this skill, docs, scripts, tests, or guardrails with the smallest durable improvement.
4. Keep the evaluator honest: deterministic checks are a gate, not a claim that the demo feels good.

## Relay and Audio Safety

- Do not touch the user's real TSRS queue by default.
- Do not execute live `relay` commands unless the task explicitly asks for that mode and the command path is allowlisted.
- Do not speak live audio from Dailies. Real voice generation, when requested, should write files through the TSRS non-speaking Speechify wrapper.
- Keep Speechify/network generation opt-in; offline stub fixtures are the default.
- Never commit secrets, API keys, raw private queue content, generated provider metadata, or shareable videos containing private paths.

## ZShot Visual Checks

Use ZShot when browser rendering, visual state, or captured page artifacts would improve confidence. Default command path on jonmagic's Mac: `~/Library/Application Support/ZShot/zshot`.

1. Start with `zshot --agent-help` when unsure.
2. Prefer HTML/MHTML smoke captures when license support for screenshots or PDFs is unavailable.
3. Put temporary outputs under `zshot-artifacts/` or another ignored path.
4. Do not capture secrets or sensitive private pages unless the user explicitly approves the local-only artifact.

## Do Not Use For

- Generic questions that `AGENTS.md` already answers.
- One-off notes that should live in README or docs instead of a skill.
- Live Relay queue operations outside an explicit Dailies demo workflow.
