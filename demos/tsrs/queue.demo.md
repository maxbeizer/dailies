---
title: The queue solved the interruption problem
slug: tsrs-queue
executionMode: fixture-only
timeline: artifacts/tsrs/queue.timeline.json
preview: artifacts/tsrs/queue.preview.html
video: artifacts/tsrs/queue.mp4
renderManifest: artifacts/tsrs/queue.render.json
evaluation: artifacts/tsrs/queue.evaluation.json
---

# The queue solved the interruption problem

This demo shows Relay as a queue and pace-control layer. Agents can leave short updates without taking over the room.

```dailies:editor
# Relay queue demo

Focus mode keeps incoming updates quiet. I can let agents keep working, then ask Relay for one update when I am ready.
```

```dailies:terminal
$ relay focus
focus mode on

$ relay --line "Blog" --message "The draft is ready to review."
queued relay #1 Blog: The draft is ready to review.

$ relay --line "PR review" --message "The reviewer found one bug."
queued relay #2 PR review: The reviewer found one bug.

$ relay list
mode=focus muted=false
#1 [queued] [normal] Blog: The draft is ready to review.
#2 [queued] [normal] PR review: The reviewer found one bug.

$ relay ready
ready to release one relay
```

```dailies:audio-cue
line: Blog
voice: af_bella
text: The draft is ready to review.
output: artifacts/tsrs/audio/blog-draft-ready.mp3
mode: declared-fixture
```

```dailies:self-review
{
  "requiredArtifacts": [
    "artifacts/tsrs/queue.timeline.json",
    "artifacts/tsrs/queue.preview.html"
  ],
  "checks": [
    "editor_surface_present",
    "terminal_surface_present",
    "relay_commands_only",
    "fixture_only_execution",
    "timeline_under_25_seconds",
    "terminal_outputs_instant",
    "audio_cues_declared",
    "no_obvious_secrets_or_private_paths"
  ]
}
```
