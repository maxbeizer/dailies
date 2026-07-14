---
title: Directing a running Mac app
slug: dailies-live-app-capture
set: studio-monitor
theme: light
executionMode: fixture-only
audioProvider: say
maxDurationSeconds: 25
timeline: artifacts/dailies/live-app-capture.timeline.json
preview: artifacts/dailies/live-app-capture.preview.html
video: artifacts/dailies/live-app-capture.mp4
renderManifest: artifacts/dailies/live-app-capture.render.json
evaluation: artifacts/dailies/live-app-capture.evaluation.json
---

# Directing a running Mac app

```dailies:audio-cue
line: Director
sayVoice: Samantha
text: Dailies directs a real TextEdit window, captures the take, then uses that recording as deterministic studio footage.
output: artifacts/dailies/audio/live-app-capture.mp3
mode: declared-fixture
```

```dailies:editor
# Live app capture

Target: com.apple.TextEdit
Director: textedit-director.applescript
Take: 7 seconds at 10 frames per second

1. Prepare a temporary document
2. Change the running app at 1.0 seconds
3. Change it again at 3.5 seconds
4. Close only the document owned by this take
```

```dailies:terminal
$ npm run capture:live -- examples/live-app-capture/textedit-story.capture.json --approve
pass artifacts/live-capture/textedit-story/textedit-story.mp4

$ npm run render:candidate -- demos/dailies/live-app-capture.demo.md
source=reviewed live take
render=deterministic media fixture
```

```dailies:media
type: video
source: assets/captures/textedit-story.mp4
panel: monitor
sourceOffsetMs: 0
durationMs: 7000
fit: contain
audio: muted
transition: fade
fadeMs: 300
caption: AppleScript changes a token-owned TextEdit document while Dailies captures only its declared rectangle.
```

```dailies:self-review
{
  "requiredArtifacts": [
    "artifacts/dailies/live-app-capture.timeline.json",
    "artifacts/dailies/live-app-capture.preview.html"
  ],
  "checks": [
    "editor_surface_present",
    "terminal_surface_present",
    "media_blocks_present",
    "timeline_within_declared_limit",
    "terminal_outputs_instant",
    "relay_commands_only",
    "fixture_only_execution",
    "audio_cues_declared",
    "media_sources_exist",
    "no_obvious_secrets_or_private_paths"
  ],
  "candidateChecks": [
    "video_artifact_exists",
    "manifest_matches_current_timeline",
    "manifest_matches_video",
    "manifest_matches_media",
    "manifest_matches_production",
    "media_source_windows_valid",
    "audio_fixtures_match_cue_config",
    "video_is_1280x720",
    "video_has_h264",
    "video_has_audio_stream",
    "sampled_frames_exist"
  ]
}
```
