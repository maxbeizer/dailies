---
title: Dailies directs itself
slug: dailies-inception
set: studio-monitor
theme: cinema
executionMode: fixture-only
maxDurationSeconds: 30
timeline: artifacts/dailies/inception.timeline.json
preview: artifacts/dailies/inception.preview.html
video: artifacts/dailies/inception.mp4
renderManifest: artifacts/dailies/inception.render.json
evaluation: artifacts/dailies/inception.evaluation.json
---

# Dailies directs itself

```dailies:audio-cue
line: Narrator
text: Dailies is a source-driven studio. The agent writes the production, checks it, and renders the film.
output: artifacts/dailies/audio/inception-opening.mp3
mode: declared-fixture
```

```dailies:editor
# Build the studio with the studio

Declare a video fixture:

type: video
source: assets/demo/dailies-seed.mp4
panel: monitor
audio: muted

The source MP4 was rendered by Dailies from another checked scenario.
```

```dailies:terminal
$ npm run check
pass: deterministic source and preview gates

$ npm run render:video -- demos/dailies/inception.demo.md
artifacts/dailies/inception.mp4
```

```dailies:audio-cue
line: Narrator
text: Now the earlier Dailies film becomes the program feed inside this Dailies film.
output: artifacts/dailies/audio/inception-monitor.mp3
mode: declared-fixture
```

```dailies:media
type: video
source: assets/demo/dailies-seed.mp4
panel: monitor
sourceOffsetMs: 0
durationMs: 11000
fit: cover
audio: muted
transition: fade
fadeMs: 500
caption: A Dailies-rendered film, playing inside a Dailies-rendered film.
```

```dailies:self-review
{
  "requiredArtifacts": [
    "artifacts/dailies/inception.timeline.json",
    "artifacts/dailies/inception.preview.html"
  ],
  "checks": [
    "editor_surface_present",
    "terminal_surface_present",
    "relay_commands_only",
    "fixture_only_execution",
    "timeline_under_25_seconds",
    "terminal_outputs_instant",
    "audio_cues_declared",
    "media_sources_exist",
    "no_obvious_secrets_or_private_paths"
  ],
  "candidateChecks": [
    "video_artifact_exists",
    "manifest_matches_current_timeline",
    "manifest_matches_video",
    "manifest_matches_media",
    "media_source_windows_valid",
    "audio_fixtures_match_cue_config",
    "video_is_1280x720",
    "video_has_h264",
    "video_has_audio_stream",
    "sampled_frames_exist"
  ]
}
```
