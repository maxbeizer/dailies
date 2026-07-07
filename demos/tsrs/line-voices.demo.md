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

# A voice is part of the interface

This demo shows voice identity as part of how TSRS lines are recognized.

```dailies:editor
# Relay line voice demo

Each TSRS line is a workstream. When the Brain, TSRS, and Blog lines have different voices, I can recognize the work before I parse the label.
```

```dailies:terminal
$ relay live
live mode on

$ relay --line "Brain" --message "Weekly prep is ready."
queued relay #1 Brain: Weekly prep is ready.
```

```dailies:audio-cue
line: Brain
voice: af_heart
sayVoice: Samantha
text: Weekly prep is ready.
output: artifacts/tsrs/audio/brain-weekly-prep-ready.mp3
mode: declared-fixture
```

```dailies:terminal
$ relay --line "Tri-State Relay Service" --message "Kokoro voices are wired in."
queued relay #2 Tri-State Relay Service: Kokoro voices are wired in.
```

```dailies:audio-cue
line: Tri-State Relay Service
voice: am_puck
sayVoice: Daniel
text: Kokoro voices are wired in.
output: artifacts/tsrs/audio/tsrs-kokoro-voices-wired.mp3
mode: declared-fixture
```

```dailies:terminal
$ relay --line "Blog" --message "The voice post has a draft."
queued relay #3 Blog: The voice post has a draft.
```

```dailies:audio-cue
line: Blog
voice: bf_emma
sayVoice: Moira
text: The voice post has a draft.
output: artifacts/tsrs/audio/blog-voice-post-draft.mp3
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
