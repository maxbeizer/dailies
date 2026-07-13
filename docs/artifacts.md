# Artifact policy

Dailies separates authored production inputs from generated review outputs.

## Commit

- Scenario sources under `demos/`
- Reusable visual and media fixtures under `assets/`
- Source code, tests, scripts, and documentation
- Deliberate public sample media, such as `assets/demo/dailies-seed.mp4`
- Deliberate rendered showcases, such as `assets/demo/dailies-inception.mp4`
- Empty `.gitkeep` placeholders

Committed media fixtures are immutable inputs for normal checks. Their byte hashes are recorded in render manifests so a candidate becomes stale when a fixture changes.

Each committed showcase has a neighboring `*.provenance.json` sidecar. `npm run check` verifies the scenario hash, compiled timeline hash, input-media hashes, and committed output-video hash without attempting nondeterministic cross-platform MP4 regeneration.

## Do not commit by default

Everything under `artifacts/` is generated and ignored:

- compiled timelines
- HTML previews
- evaluation reports
- generated audio and sidecars
- render manifests
- sampled frames
- candidate MP4 files

Run `npm run clean` to remove generated artifacts and restore `artifacts/.gitkeep`.

## Regenerating the recursive demo fixture

`assets/demo/dailies-seed.mp4` is intentionally a Dailies-produced film used as input to `demos/dailies/inception.demo.md`.

```sh
DAILIES_RENDERER=chrome npm run render:candidate -- demos/dailies/seed.demo.md --provider say
cp artifacts/dailies/seed.mp4 assets/demo/dailies-seed.mp4
DAILIES_RENDERER=chrome npm run render:candidate -- demos/dailies/inception.demo.md --provider say
cp artifacts/dailies/inception.mp4 assets/demo/dailies-inception.mp4
npm run refresh:showcases
```

Regeneration is a maintainer action. Different `ffmpeg` versions may produce different MP4 bytes, so update and review the committed fixture deliberately rather than regenerating it in CI.
