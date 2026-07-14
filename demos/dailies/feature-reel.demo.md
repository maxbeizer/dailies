---
title: Dailies feature reel
slug: dailies-feature-reel
set: attention-control-room
executionMode: fixture-only
audioProvider: say
minSceneCount: 5
maxDurationSeconds: 45
timeline: artifacts/dailies/feature-reel.timeline.json
preview: artifacts/dailies/feature-reel.preview.html
video: artifacts/dailies/feature-reel.mp4
renderManifest: artifacts/dailies/feature-reel.render.json
evaluation: artifacts/dailies/feature-reel.evaluation.json
---

# Dailies feature reel

```dailies:audio-cue
line: Director
sayVoice: Samantha
text: Start with source that explains the film before a camera ever rolls.
output: artifacts/dailies/audio/reel-01-source.mp3
mode: declared-fixture
```

```dailies:scene
{
  "id": "source-to-timeline",
  "durationMs": 7000,
  "clock": "ACT 1",
  "kicker": "Source",
  "headline": "The production begins as readable, reviewable source.",
  "body": "Scenes, narration, commands, and fixtures compile into one explicit timeline.",
  "camera": "push",
  "accent": "human",
  "concurrency": 2,
  "foreground": {
    "label": "Scenario",
    "action": "Compile authored blocks into timed events"
  },
  "lanes": [
    {
      "id": "copilot",
      "label": "Direction",
      "status": "authored",
      "active": true,
      "items": ["Story beats", "Pacing", "Captions"]
    },
    {
      "id": "brain",
      "label": "Timeline",
      "status": "deterministic",
      "active": true,
      "items": ["00:00 source", "00:07 set", "00:14 audio"]
    }
  ],
  "metrics": [
    { "label": "source blocks", "value": "12" },
    { "label": "hidden tracks", "value": "0" }
  ]
}
```

```dailies:audio-cue
line: Production Designer
sayVoice: Karen
text: Change the set, not the workflow. The same timeline can stage a completely different room.
output: artifacts/dailies/audio/reel-02-set.mp3
mode: declared-fixture
```

```dailies:scene
{
  "id": "named-sets",
  "durationMs": 7000,
  "clock": "ACT 2",
  "kicker": "Set design",
  "headline": "Named sets turn the timeline into a reusable production language.",
  "body": "Editor, terminal, control room, studio monitor, and full-screen media remain source-selectable.",
  "camera": "orbit",
  "accent": "copilot",
  "concurrency": 5,
  "foreground": {
    "label": "Set registry",
    "action": "Select attention-control-room"
  },
  "lanes": [
    {
      "id": "github",
      "label": "Sets",
      "status": "5 registered",
      "active": true,
      "items": ["editor-terminal", "studio-monitor", "full-screen-media"]
    },
    {
      "id": "slack",
      "label": "Creative review",
      "status": "live",
      "active": true,
      "items": ["Framing", "Hierarchy", "Story"]
    }
  ],
  "metrics": [
    { "label": "set changes", "value": "source-only" },
    { "label": "GUI tracks", "value": "none" }
  ]
}
```

```dailies:audio-cue
line: Sound
sayVoice: Moira
text: Lines, voices, and offsets stay declared beside the scene, so direction remains inspectable.
output: artifacts/dailies/audio/reel-03-audio.mp3
mode: declared-fixture
```

```dailies:scene
{
  "id": "audio-direction",
  "durationMs": 7000,
  "clock": "ACT 3",
  "kicker": "Audio direction",
  "headline": "Narration is fixture data, not an invisible editing session.",
  "body": "Every line names its speaker, provider, voice, timing, output, and current fingerprint.",
  "camera": "close",
  "accent": "human",
  "concurrency": 3,
  "foreground": {
    "label": "Declared cue",
    "action": "Sound / Moira / offset 00:14.000"
  },
  "lanes": [
    {
      "id": "copilot",
      "label": "Dialogue",
      "status": "aligned",
      "active": true,
      "items": ["Director", "Production Designer", "Sound"]
    },
    {
      "id": "brain",
      "label": "Fingerprints",
      "status": "current",
      "active": true,
      "items": ["Text hash", "Voice", "Provider"]
    }
  ],
  "metrics": [
    { "label": "live speech", "value": "off" },
    { "label": "declared cues", "value": "5" }
  ]
}
```

```dailies:audio-cue
line: Camera
sayVoice: Daniel
text: At every output frame, declared video seeks to the exact source time before the screenshot.
output: artifacts/dailies/audio/reel-04-media.mp3
mode: declared-fixture
```

```dailies:scene
{
  "id": "deterministic-media",
  "durationMs": 7000,
  "clock": "ACT 4",
  "kicker": "Media fixtures",
  "headline": "A video clip becomes deterministic input instead of real-time playback.",
  "body": "Seek. Decode. Draw to canvas. Capture. The same timeline frame asks for the same source frame.",
  "camera": "overhead",
  "accent": "copilot",
  "concurrency": 4,
  "foreground": {
    "label": "Frame 327",
    "action": "Seek source to 00:08.400 before capture"
  },
  "lanes": [
    {
      "id": "github",
      "label": "Media",
      "status": "decoded",
      "active": true,
      "items": ["Safe asset path", "Source window", "Fit + fade"]
    },
    {
      "id": "slack",
      "label": "Program monitor",
      "status": "frame ready",
      "active": true,
      "items": ["16:9 aperture", "Caption", "Muted source"]
    }
  ],
  "metrics": [
    { "label": "source time", "value": "00:08.400" },
    { "label": "frame drift", "value": "0 ms" }
  ]
}
```

```dailies:audio-cue
line: Evaluator
sayVoice: Daniel
text: The candidate closes its own loop, and this finished film can become the next production's fixture.
output: artifacts/dailies/audio/reel-05-evaluate.mp3
mode: declared-fixture
```

```dailies:scene
{
  "id": "evaluation-loop",
  "durationMs": 7000,
  "clock": "FINAL",
  "kicker": "Self review",
  "headline": "Source, timeline, audio, media, preview, and movie agree.",
  "body": "Hashes prove freshness. Sampled frames prove output. The finished MP4 becomes reusable production input.",
  "camera": "pull",
  "accent": "human",
  "concurrency": 1,
  "foreground": {
    "label": "Candidate",
    "action": "PASS - ready to become a fixture"
  },
  "lanes": [
    {
      "id": "copilot",
      "label": "Evaluation",
      "status": "pass",
      "active": true,
      "items": ["Timeline current", "Media current", "Frames sampled"]
    },
    {
      "id": "brain",
      "label": "Next production",
      "status": "ready",
      "active": true,
      "items": ["Commit fixture", "Record provenance", "Re-enter the loop"]
    }
  ],
  "metrics": [
    { "label": "candidate checks", "value": "PASS" },
    { "label": "next input", "value": "this film" }
  ]
}
```

```dailies:self-review
{
  "requiredArtifacts": [
    "artifacts/dailies/feature-reel.timeline.json",
    "artifacts/dailies/feature-reel.preview.html"
  ],
  "checks": [
    "attention_control_room_set",
    "scene_blocks_present",
    "scene_blocks_valid",
    "scene_narration_aligned",
    "timeline_within_declared_limit",
    "audio_cues_declared",
    "fixture_only_execution",
    "no_obvious_secrets_or_private_paths"
  ],
  "candidateChecks": [
    "video_artifact_exists",
    "manifest_matches_current_timeline",
    "manifest_matches_video",
    "audio_fixtures_match_cue_config",
    "audio_cues_stay_within_scenes",
    "video_is_1280x720",
    "video_has_h264",
    "video_has_audio_stream",
    "sampled_frames_exist"
  ]
}
```
