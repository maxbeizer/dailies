---
title: Triage GitHub notifications safely
slug: gh-hush-preview
set: editor-terminal
executionMode: fixture-only
audioProvider: say
timeline: artifacts/gh-hush/preview.timeline.json
preview: artifacts/gh-hush/preview.preview.html
video: artifacts/gh-hush/preview.mp4
renderManifest: artifacts/gh-hush/preview.render.json
evaluation: artifacts/gh-hush/preview.evaluation.json
---

# Triage GitHub notifications safely

```dailies:audio-cue
line: Narrator
sayVoice: Samantha
text: GitHub notifications add up quickly, but bulk cleanup can hide something important.
output: artifacts/gh-hush/audio/opening.mp3
mode: declared-fixture
```

```dailies:editor
# Keep what matters

- personal mentions and assignments
- individual review requests
- work I authored
- external organization notifications
- configured team mentions
```

```dailies:audio-cue
line: Narrator
sayVoice: Samantha
text: Gh-hush previews every decision and shows the policy evidence that matched.
output: artifacts/gh-hush/audio/preview.mp3
mode: declared-fixture
```

```dailies:terminal
$ gh hush --dry-run

gh-hush preview
No GitHub mutations were made while generating this preview.

1. [KEEP] Fix the frobnicator
   Repository: example/widgets
   Notification reason: mention
   Proposed action: keep
   Matching rules:
   - personally_mentioned: reason=mention

2. [KEEP] Review the parser
   Repository: example/widgets
   Notification reason: review_requested
   Proposed action: keep
   Matching rules:
   - individually_review_requested: current individual review request

3. [UNSUBSCRIBE_AND_MARK_DONE] Routine dependency update
   Repository: example/widgets
   Notification reason: subscribed
   Proposed action: unsubscribe_and_mark_done
   Matching rules:
   - all_other_notifications: eligible subject matched catch-all policy

Summary: 2 keep, 1 propose unsubscribe_and_mark_done, 3 total
```

```dailies:audio-cue
line: Narrator
sayVoice: Samantha
text: Apply requires confirmation and revalidation. Failed unsubscribes are never marked Done.
output: artifacts/gh-hush/audio/safety.mp3
mode: declared-fixture
```

```dailies:editor
# Safe by default

1. Preview and explain every decision
2. Require explicit confirmation
3. Revalidate before mutation
4. Never mark Done if unsubscribe fails
```

```dailies:audio-cue
line: Narrator
sayVoice: Samantha
text: After approval, the result stays concise and reports every safety outcome and the elapsed time.
output: artifacts/gh-hush/audio/result.mp3
mode: declared-fixture
```

```dailies:terminal
Application summary
  targets:      1 notification
  revalidated:  1 eligible, 0 skipped, 0 failed
  unsubscribed: 1 succeeded, 0 failed
  marked Done:  1 succeeded, 0 failed
  elapsed:      840ms
total runtime: 1.2s (excludes interactive confirmation wait)
```

```dailies:self-review
{
  "requiredArtifacts": [
    "artifacts/gh-hush/preview.timeline.json",
    "artifacts/gh-hush/preview.preview.html"
  ],
  "checks": [
    "editor_surface_present",
    "terminal_surface_present",
    "fixture_only_execution",
    "audio_cues_declared",
    "no_obvious_secrets_or_private_paths"
  ]
}
```
