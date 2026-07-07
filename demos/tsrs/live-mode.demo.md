---
title: Live mode still has a kill switch
slug: tsrs-live-mode
executionMode: fixture-only
timeline: artifacts/tsrs/live-mode.timeline.json
preview: artifacts/tsrs/live-mode.preview.html
video: artifacts/tsrs/live-mode.mp4
renderManifest: artifacts/tsrs/live-mode.render.json
evaluation: artifacts/tsrs/live-mode.evaluation.json
---

# Live mode still has a kill switch

This demo shows Relay switching from quiet queueing to live playback, then using mute as the safety override.

```dailies:editor
# Relay live mode demo

Live mode is for moments when I want agent updates as they happen. Mute is still one command away, so I can stop playback without losing the queue.
```

```dailies:terminal
$ relay live
live mode on

$ relay --line "Deploy" --message "Staging is green."
queued relay #1 Deploy: Staging is green.
```

```dailies:audio-cue
line: Deploy
voice: george
text: Staging is green.
output: artifacts/tsrs/audio/deploy-staging-green.mp3
mode: declared-fixture
```

```dailies:terminal
$ relay --line "Security review" --message "One finding needs a decision."
queued relay #2 Security review: One finding needs a decision.
```

```dailies:audio-cue
line: Security review
voice: george
text: One finding needs a decision.
output: artifacts/tsrs/audio/security-review-decision.mp3
mode: declared-fixture
```

```dailies:terminal
$ relay mute
muted

$ relay --line "Deploy" --message "Production deploy is paused."
queued relay #3 Deploy: Production deploy is paused.

$ relay state
live, muted, active-line=Deploy, inactive-line-combiner=none
```

```dailies:self-review
{
  "requiredArtifacts": [
    "artifacts/tsrs/live-mode.timeline.json",
    "artifacts/tsrs/live-mode.preview.html"
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
