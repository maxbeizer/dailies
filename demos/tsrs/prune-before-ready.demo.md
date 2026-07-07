---
title: Prune the queue before listening
slug: tsrs-prune-before-ready
executionMode: fixture-only
timeline: artifacts/tsrs/prune-before-ready.timeline.json
preview: artifacts/tsrs/prune-before-ready.preview.html
video: artifacts/tsrs/prune-before-ready.mp4
renderManifest: artifacts/tsrs/prune-before-ready.render.json
evaluation: artifacts/tsrs/prune-before-ready.evaluation.json
---

# Prune the queue before listening

This demo shows Relay letting the user remove stale or noisy updates before releasing one useful update.

```dailies:editor
# Relay queue pruning demo

Before I listen, I can prune stale updates. Relay keeps the queue visible and lets me skip or clear work by line.
```

```dailies:terminal
$ relay --line "Build" --message "Unit tests passed."
queued relay #1 Build: Unit tests passed.

$ relay --line "Build" --message "Lint passed."
queued relay #2 Build: Lint passed.

$ relay --line "Docs" --message "README needs one more example."
queued relay #3 Docs: README needs one more example.

$ relay skip-next --line "Build"
skipped relay #1

$ relay clear-line --line "Docs"
cleared 1 queued relays from Docs

$ relay ready
ready to release one relay
```

```dailies:audio-cue
line: Build
voice: george
text: Lint passed.
output: artifacts/tsrs/audio/build-lint-passed.mp3
mode: declared-fixture
```

```dailies:self-review
{
  "requiredArtifacts": [
    "artifacts/tsrs/prune-before-ready.timeline.json",
    "artifacts/tsrs/prune-before-ready.preview.html"
  ],
  "checks": [
    "editor_surface_present",
    "terminal_surface_present",
    "relay_commands_only",
    "fixture_only_execution",
    "timeline_under_25_seconds",
    "terminal_outputs_instant",
    "audio_cues_do_not_linger",
    "audio_cues_declared",
    "no_obvious_secrets_or_private_paths"
  ]
}
```
