# Contributing to Dailies

Dailies is a source-driven demo studio. Keep changes deterministic, fixture-first, and inspectable by both people and agents.

## Development

Requirements:

- Node.js 22 or newer
- `ffmpeg` and `ffprobe` for video candidates
- Google Chrome for deterministic media-fixture capture
- macOS `say`, or an explicitly configured local audio provider, when generating narrated candidates

Run the dependency-free gates before submitting a change:

```sh
npm test
npm run check
```

Use `npm run render:candidate -- <scenario> --provider say` when a change affects the rendered experience. Media scenarios automatically use the Chrome renderer because every captured frame must seek and decode its declared source time.

CI enforces the dependency-free parser, compiler, preview, and source-evaluation gates. Chrome capture, ffmpeg output, audio generation, and candidate frame inspection remain required local maintainer checks for media-rendering changes.

## Scenarios and fixtures

- Keep scenario commands as fixture text. Do not add live execution without a separate, fail-closed design and explicit approval.
- Keep media under `assets/` and declare it with repository-relative paths.
- Keep generated timelines, previews, audio, manifests, frame samples, and videos under `artifacts/`.
- Do not commit secrets, private paths, raw private queue data, or generated provider metadata.
- Add tests for parser, compiler, evaluator, and renderer contracts when introducing a new source primitive.

See `docs/artifacts.md` for the committed-versus-generated artifact policy.
