---
title: Dailies Director's Cut
slug: dailies-inception
set: studio-monitor
theme: macintosh
executionMode: fixture-only
audioProvider: kokoro
maxDurationSeconds: 70
tailHoldMs: 3000
timeline: artifacts/dailies/inception.timeline.json
preview: artifacts/dailies/inception.preview.html
video: artifacts/dailies/inception.mp4
renderManifest: artifacts/dailies/inception.render.json
evaluation: artifacts/dailies/inception.evaluation.json
---

# Dailies Director's Cut

```dailies:audio-cue
line: Director
voice: bf_emma
sayVoice: Samantha
text: The first cut passed every automated check. It was still boring.
output: artifacts/dailies/audio/directors-cut-01-review.mp3
mode: declared-fixture
```

```dailies:editor
# First cut review

It worked. It passed. It was boring.

New brief: System 7. Exact 16:9 movie window.
Every claimed feature must be visible.
```

```dailies:terminal
$ npm run check
25 checks passed
creative review failed: weak framing, short story, no payoff
$ npm run render:video -- demos/dailies/feature-reel.demo.md
artifacts/dailies/feature-reel.mp4
```

```dailies:audio-cue
line: Production Designer
voice: af_heart
sayVoice: Karen
text: Rebuild the room as a System Seven director's desk, and make every window advance the story.
output: artifacts/dailies/audio/directors-cut-02-brief.mp3
mode: declared-fixture
```

```dailies:media
type: video
source: assets/demo/dailies-feature-reel.mp4
panel: monitor
sourceOffsetMs: 0
durationMs: 9000
fit: contain
audio: muted
transition: fade
fadeMs: 350
caption: ACT I — Readable source becomes an explicit timeline and a named set.
```

```dailies:editor
# The reel does the explaining

The monitor shows set design and audio direction.
The authored source stays visible beside it.
```

```dailies:audio-cue
line: Production Designer
voice: af_heart
sayVoice: Karen
text: Here the set changes without changing the workflow. Speakers, voices, offsets, and fixture fingerprints stay declared, while candidate evaluation proves that every layer still agrees.
output: artifacts/dailies/audio/directors-cut-03-inspection.mp3
mode: declared-fixture
```

```dailies:media
type: video
source: assets/demo/dailies-feature-reel.mp4
panel: monitor
sourceOffsetMs: 9000
durationMs: 10000
fit: contain
audio: muted
transition: fade
fadeMs: 350
caption: ACT II — Sets, speakers, voices, offsets, and fixture fingerprints stay inspectable.
```

```dailies:terminal
$ npm run evaluate:candidate -- demos/dailies/feature-reel.demo.md
status=pass
timeline=current audio=current media=current
sampled_frames=3 provenance=recorded
```

```dailies:audio-cue
line: Evaluator
voice: am_puck
sayVoice: Daniel
text: The movie in this window was rendered by Dailies, checked by Dailies, and committed as input to this production. Every frame seeks the same source time, so the finished output can safely become the next input.
output: artifacts/dailies/audio/directors-cut-04-recursion.mp3
mode: declared-fixture
```

```dailies:media
type: video
source: assets/demo/dailies-feature-reel.mp4
panel: monitor
sourceOffsetMs: 19000
durationMs: 14000
fit: contain
audio: muted
transition: fade
fadeMs: 350
caption: ACT III — Seek, decode, evaluate, hash, then turn the finished movie into the next fixture.
```

```dailies:audio-cue
line: Director
voice: bf_emma
sayVoice: Samantha
text: The output becomes the next input. The proof stays visible beside the film, and Dailies directs the next version of itself.
output: artifacts/dailies/audio/directors-cut-05-payoff.mp3
mode: declared-fixture
```

```dailies:editor
# The recursive payoff

The output becomes the next input.
The proof is visible beside the film.

Dailies does not just record a demo.
It directs the next version of itself.
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
