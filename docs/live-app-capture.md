# Live app capture specification

Status: the v1 TextEdit example can be validated, explicitly executed, reviewed, and used as a deterministic Dailies media fixture.

Dailies normally builds a movie from deterministic source and fixtures. Live app capture introduces a deliberately separate step for stories that need a real macOS application to change while it is recorded.

The boundary is:

1. A reviewed capture declaration and AppleScript director produce a bounded MP4 take.
2. A human reviews that take and deliberately keeps it under `assets/captures/`.
3. An ordinary `dailies:media` block uses the MP4 as a deterministic fixture.

Scenario compilation, `npm run check`, preview rendering, and candidate rendering never execute AppleScript.

## The examples define v1

The contract started with examples under [`examples/live-app-capture/`](../examples/live-app-capture/):

| Example | Decision it drives |
| --- | --- |
| `textedit-story.capture.json` | One allowlisted app, one director, bounded setup/actions/teardown, and one MP4 output |
| `textedit-second-take.capture.json` | The same reviewed director can reset the app and produce another take |
| `invalid/inline-script.capture.json` | AppleScript stays in a reviewable repository file, never inline JSON |
| `invalid/absolute-director.capture.json` | Directors cannot reach outside the repository |
| `invalid/traversal-director.capture.json` | Relative traversal fails closed |
| `invalid/output-escape.capture.json` | Capture fixtures can only be promoted under `assets/captures/` |
| `invalid/unapproved-app.capture.json` | Every target app must be added to the committed allowlist |
| `invalid/unordered-actions.capture.json` | Timed actions remain readable and execute in declared order |
| `invalid/shell-escape.capture.json` | v1 rejects `do shell script` |
| `invalid/system-events*.capture.json` | v1 rejects named, abbreviated, and bundle-ID System Events targets |

The valid examples use TextEdit because its native AppleScript dictionary can create, change, and close a temporary unsaved document without network access or Accessibility permission.

## Declaration

```json
{
  "version": 1,
  "id": "textedit-story",
  "platform": "macos",
  "app": {
    "bundleId": "com.apple.TextEdit"
  },
  "director": "examples/live-app-capture/textedit-director.applescript",
  "output": "assets/captures/textedit-story.mp4",
  "durationMs": 7000,
  "capture": {
    "region": {
      "x": 120,
      "y": 120,
      "width": 800,
      "height": 550
    },
    "framesPerSecond": 10
  },
  "setup": [
    {
      "action": "prepare",
      "timeoutMs": 5000
    }
  ],
  "actions": [
    {
      "atMs": 1000,
      "action": "showOpening",
      "timeoutMs": 3000
    },
    {
      "atMs": 3500,
      "action": "showRevision",
      "timeoutMs": 3000
    }
  ],
  "teardown": [
    {
      "action": "reset",
      "timeoutMs": 5000
    }
  ]
}
```

`setup` runs before recording begins. `actions` run during the take at offsets relative to its start. `teardown` runs after recording stops or after a failed attempt. Actions must have strictly increasing `atMs` values; Dailies will not silently reorder authored direction or resolve timestamp ties.

The director receives an action name and a unique run token for each invocation. The executor must generate a new unpredictable token for every capture attempt and pass the same token to setup, timed actions, and teardown. The same committed file handles every phase so the complete behavior is reviewable together.

The TextEdit director gives the temporary document a unique name derived from that run token and shows a clean `Dailies Live Capture` window title. Later invocations find the exact document by its unique name. It never assumes the front document belongs to Dailies or broadly cleans similarly named documents, which avoids overwriting or closing unrelated work.

## Run the example

Live execution is a separate, explicit command:

```sh
npm run capture:live -- examples/live-app-capture/textedit-story.capture.json --approve
```

The command refuses to run without `--approve` or outside macOS. It:

1. Validates the declaration, allowlist, director, capture region, and output boundary.
2. Generates a unique run token.
3. Copies the director into an ignored read-only snapshot and validates that exact snapshot again.
4. Runs declared setup through `osascript` using only the snapshot.
5. Captures only the declared rectangle with native `screencapture` still frames.
6. Applies actions at their declared output-frame times.
7. Verifies every expected frame, encodes H.264 with `ffmpeg`, and checks the resulting frame count, duration, and dimensions.
8. Runs teardown even after a failed take.
9. Writes the candidate and JSON report under `artifacts/live-capture/<id>/`.

Frame-stepped region capture is deliberate. It avoids recording the full display and keeps authored action times aligned with the encoded movie even when individual screenshots take longer than real time. Region coordinates and dimensions use macOS screen points; the run report records the actual output pixel dimensions because Retina scaling can produce more pixels than declared points.

## Validation and trust

`src/live-app-capture.mjs` validates declarations and reads director source. It does not execute AppleScript, launch applications, request permissions, or record the screen.

Validation requires:

- contract version 1 on macOS
- a target bundle ID in `spec/live-app-capture-allowlist.json`
- a repository-relative `.applescript` director that exists
- a director whose resolved path remains inside the repository, including through symlinks
- an MP4 output path under `assets/captures/`
- an output path whose existing components are not symbolic links
- a capture rectangle with nonnegative coordinates, positive dimensions, and a positive frame rate
- positive durations and timeouts
- nonnegative timed actions that occur before the declared duration
- authored action order
- no inline script, `do shell script`, or System Events UI scripting

These checks are defense in depth, not an AppleScript sandbox. A committed director can still tell an allowlisted application to perform consequential work. Human review of the declaration, director, application state, and captured MP4 remains the load-bearing control.

Adding an app to the allowlist requires explicit human approval. The executor requires `--approve`, records declaration and director hashes in its ignored run report, verifies every expected frame exists, and fails closed when setup, capture, an action, encoding, or teardown fails.

A `pass` report means the declared actions executed and an MP4 with the expected frame count was encoded. It cannot prove the app looked right or that another window did not overlap the declared rectangle. Human review of the take remains required before promotion.

The validator does not try to parse AppleScript handlers or prove that every declared action exists. The executor discovers a missing action when `osascript` invokes it and marks the take failed.

## Capture outputs

Live capture writes an ignored candidate under `artifacts/` first. Only a reviewed take should be promoted to `assets/captures/*.mp4` with a provenance sidecar.

The reviewed TextEdit take is committed as:

- `assets/captures/textedit-story.mp4`
- `assets/captures/textedit-story.provenance.json`

[`demos/dailies/live-app-capture.demo.md`](../demos/dailies/live-app-capture.demo.md) uses that MP4 in the `studio-monitor` set. Normal Dailies rendering reads only the committed media fixture and never reruns AppleScript.

Automatic promotion and generalized app-specific setup remain deferred. Review the candidate before copying it into `assets/captures/`.
