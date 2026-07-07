---
title: Different lines can sound different
slug: tsrs-line-voices
executionMode: fixture-only
timeline: artifacts/tsrs/line-voices.timeline.json
preview: artifacts/tsrs/line-voices.preview.html
video: artifacts/tsrs/line-voices.mp4
renderManifest: artifacts/tsrs/line-voices.render.json
evaluation: artifacts/tsrs/line-voices.evaluation.json
---

# Different lines can sound different

This demo shows line identity moving from text labels into recognizable voices.

```dailies:editor
# Relay line voice demo

When every line sounds the same, my ear has to route the update after the words land. Per-line voices let the Blog, Brain, and PR review lines carry identity before I think about it.
```

```dailies:terminal
$ relay live
live mode on

$ relay --line "Brain" --message "Weekly prep is ready."
queued relay #1 Brain: Weekly prep is ready.
```

```dailies:audio-cue
line: Brain
voice: george
sayVoice: Samantha
text: Weekly prep is ready.
output: artifacts/tsrs/audio/brain-weekly-prep-ready.mp3
mode: declared-fixture
```

```dailies:terminal
$ relay --line "Blog" --message "The voice post has a draft."
queued relay #2 Blog: The voice post has a draft.
```

```dailies:audio-cue
line: Blog
voice: henry
sayVoice: Daniel
text: The voice post has a draft.
output: artifacts/tsrs/audio/blog-voice-post-draft.mp3
mode: declared-fixture
```

```dailies:terminal
$ relay --line "PR review" --message "One test failure needs attention."
queued relay #3 PR review: One test failure needs attention.
```

```dailies:audio-cue
line: PR review
voice: oliver
sayVoice: Fred
text: One test failure needs attention.
output: artifacts/tsrs/audio/pr-review-test-failure.mp3
mode: declared-fixture
```

```dailies:self-review
{
  "requiredArtifacts": [
    "artifacts/tsrs/line-voices.timeline.json",
    "artifacts/tsrs/line-voices.preview.html"
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
