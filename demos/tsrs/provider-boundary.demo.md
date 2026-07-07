---
title: Provider voices still fail quiet
slug: tsrs-provider-boundary
executionMode: fixture-only
timeline: artifacts/tsrs/provider-boundary.timeline.json
preview: artifacts/tsrs/provider-boundary.preview.html
video: artifacts/tsrs/provider-boundary.mp4
renderManifest: artifacts/tsrs/provider-boundary.render.json
evaluation: artifacts/tsrs/provider-boundary.evaluation.json
---

# Provider voices still fail quiet

This demo shows the advanced voice boundary: TSRS can hand text to a file-writing voice command, but the app still owns playback and safety checks.

```dailies:editor
# Relay provider boundary demo

The provider path is opt-in. The app stores secrets in Keychain, tracks local usage, and re-checks mute and focus before playing generated audio.
```

```dailies:terminal
$ relay config set --voice-command '<app-bin>/speechify --text-file <text-file> --output-file <output-file> --voice-id <voice-id> --keychain-service TSRS_SPEECHIFY_API_KEY'
# Tri-State Relay Service advanced config.
# Placeholders are inserted as single argv values, not shell-expanded.

[voice]
command = "<app-bin>/speechify --text-file <text-file> --output-file <output-file> --voice-id <voice-id> --keychain-service TSRS_SPEECHIFY_API_KEY"

$ relay status
{"profile":"direct","mode":"focus","muted":false,"spokenUsage":{"characters":0,"relays":0,"days":30}}

$ relay --line "Voice config" --message "Speechify stays opt-in, writes a file, and fails quiet."
queued relay #1 Voice config: Speechify stays opt-in, writes a file, and fails quiet.
```

```dailies:audio-cue
line: Voice config
voice: george
sayVoice: Karen
text: Speechify stays opt-in, writes a file, and fails quiet.
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
