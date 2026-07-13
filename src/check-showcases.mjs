import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileTimeline } from "./compile-timeline.mjs";
import { mediaManifestEntries, productionManifest } from "./media-fixtures.mjs";
import { parseDemoMarkdown } from "./parse-demo.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOWCASES = [
  {
    scenario: "demos/dailies/seed.demo.md",
    video: "assets/demo/dailies-seed.mp4",
    provenance: "assets/demo/dailies-seed.provenance.json",
  },
  {
    scenario: "demos/dailies/inception.demo.md",
    video: "assets/demo/dailies-inception.mp4",
    provenance: "assets/demo/dailies-inception.provenance.json",
  },
];

export async function checkShowcases(options = {}) {
  const failures = [];
  for (const showcase of SHOWCASES) {
    const expected = await buildProvenance(showcase);
    const provenancePath = path.join(PROJECT_ROOT, showcase.provenance);
    if (options.write) {
      await mkdir(path.dirname(provenancePath), { recursive: true });
      await writeFile(provenancePath, `${JSON.stringify(expected, null, 2)}\n`);
      console.log(`wrote ${showcase.provenance}`);
      continue;
    }

    let actual;
    try {
      actual = JSON.parse(await readFile(provenancePath, "utf8"));
    } catch {
      failures.push(`${showcase.provenance} is missing or invalid`);
      continue;
    }
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(`${showcase.provenance} is stale`);
    } else {
      console.log(`pass ${showcase.provenance}`);
    }
  }
  if (failures.length > 0) throw new Error(failures.join("; "));
}

async function buildProvenance(showcase) {
  const scenarioPath = path.join(PROJECT_ROOT, showcase.scenario);
  const videoPath = path.join(PROJECT_ROOT, showcase.video);
  const markdown = await readFile(scenarioPath, "utf8");
  const timeline = compileTimeline(parseDemoMarkdown(scenarioPath, markdown));
  return {
    version: 1,
    scenario: showcase.scenario,
    video: showcase.video,
    scenarioSha256: sha256(markdown),
    timelineSha256: sha256(JSON.stringify(timeline)),
    videoSha256: sha256(await readFile(videoPath)),
    media: await mediaManifestEntries(timeline),
    production: await productionManifest(timeline),
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkShowcases({ write: process.argv.includes("--write") }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
