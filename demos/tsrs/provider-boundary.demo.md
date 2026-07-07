---
title: Kokoro voices still fail quiet
slug: tsrs-provider-boundary
executionMode: fixture-only
timeline: artifacts/tsrs/provider-boundary.timeline.json
preview: artifacts/tsrs/provider-boundary.preview.html
video: artifacts/tsrs/provider-boundary.mp4
renderManifest: artifacts/tsrs/provider-boundary.render.json
evaluation: artifacts/tsrs/provider-boundary.evaluation.json
---

# Kokoro voices still fail quiet

This demo shows the advanced voice boundary: TSRS can hand text to a local Kokoro helper, but the app still owns playback and safety checks.

```dailies:editor
# Relay provider boundary demo

Kokoro stays explicit. The app tracks local usage, keeps the Python and model install outside the app bundle, and re-checks mute and focus before playing generated audio.
```

```dailies:terminal
$ relay config show
# Tri-State Relay Service advanced config.
# Placeholders are inserted as single argv values, not shell-expanded.

[voice]
provider = "kokoro"
command = "<app-bin>/kokoro --venv ~/.local/share/tsrs-kokoro/venv --text-file <text-file> --output-file <output-file> --voice-id <voice-id>"

[kokoro]
default_voice_id = "af_heart"
auto_assign_line_voices = true
catalog_command = "<app-bin>/kokoro voices --language a"
assignment_strategy = "stable-hash"

[kokoro.line_voices]
Brain = "af_heart"
"Tri-State Relay Service" = "am_puck"

$ relay status
{"profile":"direct","mode":"focus","muted":false,"voiceProvider":"kokoro","voiceProviderDefaultVoiceId":"af_heart","spokenUsage":{"characters":0,"relays":0,"days":30}}

$ relay --line "Voice config" --message "Kokoro stays opt-in, writes a file, and fails quiet."
queued relay #1 Voice config: Kokoro stays opt-in, writes a file, and fails quiet.
```

```dailies:audio-cue
line: Voice config
voice: af_heart
sayVoice: Karen
text: Kokoro stays opt-in, writes a file, and fails quiet.
output: artifacts/tsrs/audio/voice-config-fails-quiet.mp3
mode: declared-fixture
```

```dailies:self-review
{
  "requiredArtifacts": [
    "artifacts/tsrs/provider-boundary.timeline.json",
    "artifacts/tsrs/provider-boundary.preview.html"
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
