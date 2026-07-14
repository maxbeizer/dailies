# Live app capture specification

Status: v1 declarations and validation are implemented. AppleScript execution and screen recording are not.

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

The TextEdit director marks the temporary document with that run token and looks up the matching document on later invocations. It never assumes the front document belongs to Dailies, which avoids overwriting or closing an unrelated document that was already open.

## Validation and trust

`src/live-app-capture.mjs` validates declarations and reads director source. It does not execute AppleScript, launch applications, request permissions, or record the screen.

Validation requires:

- contract version 1 on macOS
- a target bundle ID in `spec/live-app-capture-allowlist.json`
- a repository-relative `.applescript` director that exists
- a director whose resolved path remains inside the repository, including through symlinks
- an MP4 output path under `assets/captures/`
- an output path whose existing components are not symbolic links
- positive durations and timeouts
- nonnegative timed actions that occur before the declared duration
- authored action order
- no inline script, `do shell script`, or System Events UI scripting

These checks are defense in depth, not an AppleScript sandbox. A committed director can still tell an allowlisted application to perform consequential work. Human review of the declaration, director, application state, and captured MP4 remains the load-bearing control.

Adding an app to the allowlist or adding a live executor requires explicit human approval. A future executor should also present the exact app, director hash, action list, output path, and generated run token before each run and fail closed on any mismatch. It must repeat output containment checks immediately before opening the file and use a no-follow or exclusive-create strategy rather than trusting earlier validation across a filesystem race.

The validator does not try to parse AppleScript handlers or prove that every declared action exists. That consistency check belongs in the execution slice, where the executor can invoke each action against a disposable rehearsal state before recording. The execution slice must also define whether action timeouts can extend beyond the recording window.

## Capture outputs

Live capture will eventually write an ignored candidate under `artifacts/` first. Only a reviewed take should be promoted to `assets/captures/*.mp4` with a provenance sidecar that follows the existing showcase convention.

The execution command, recorder integration, provenance writer, action rehearsal, timing behavior, and promotion workflow are intentionally deferred. The examples and validator establish the contract those pieces must satisfy.
