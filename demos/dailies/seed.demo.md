---
title: The film that becomes a fixture
slug: dailies-seed
executionMode: fixture-only
timeline: artifacts/dailies/seed.timeline.json
preview: artifacts/dailies/seed.preview.html
video: artifacts/dailies/seed.mp4
renderManifest: artifacts/dailies/seed.render.json
evaluation: artifacts/dailies/seed.evaluation.json
---

# The film that becomes a fixture

```dailies:audio-cue
line: Narrator
text: Dailies turns source into a checked film. This film will become an input to the next one.
output: artifacts/dailies/audio/seed-narration.mp3
mode: declared-fixture
```

```dailies:editor
# A recursive production

Write the scenario. Compile its timeline. Check the fixtures. Render the candidate.

Then use the resulting MP4 as declared media in another Dailies production.
```

```dailies:terminal
$ npm run check
pass: every source, timeline, preview, and fixture is current

$ npm run render:video -- demos/dailies/inception.demo.md
artifacts/dailies/inception.mp4
```

```dailies:self-review
{
  "requiredArtifacts": [
    "artifacts/dailies/seed.timeline.json",
    "artifacts/dailies/seed.preview.html"
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
  ],
  "candidateChecks": [
    "video_artifact_exists",
    "manifest_matches_current_timeline",
    "manifest_matches_video",
    "audio_fixtures_match_cue_config",
    "video_is_1280x720",
    "video_has_h264",
    "video_has_audio_stream",
    "sampled_frames_exist"
  ]
}
```
