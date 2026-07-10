import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseDemoMarkdown } from "./parse-demo.mjs";
import { compileTimeline, resolveArtifactOutputPath } from "./compile-timeline.mjs";

export async function readScenarioWithAudioCues(sourcePath) {
  const absoluteSourcePath = path.resolve(sourcePath);
  const markdown = await readFile(absoluteSourcePath, "utf8");
  const parsed = parseDemoMarkdown(absoluteSourcePath, markdown);
  const timeline = compileTimeline(parsed);
  const cues = parsed.blocks
    .filter((block) => block.type === "audio-cue")
    .map((block) => ({
      ...block.data,
      provider: block.data?.provider || parsed.frontmatter.audioProvider || null,
      outputPath: resolveArtifactOutputPath(block.data?.output),
      event: timeline.events.find((event) => event.surface === "audio" && event.cue === block.data),
    }));
  return { parsed, timeline, cues };
}

export async function writeCueTextFile(cue) {
  const textPath = `${cue.outputPath}.txt`;
  await mkdir(path.dirname(textPath), { recursive: true });
  await writeFile(textPath, cue.text || "", "utf8");
  return textPath;
}

export function cueSynthesisMetadata(cue, provider = cue.provider) {
  return {
    version: 1,
    provider: provider || null,
    voice: cue.voice || null,
    sayVoice: cue.sayVoice || null,
    speed: cue.speed === undefined ? null : Number(cue.speed),
    textSha256: sha256Text(cue.text || ""),
  };
}

export function cueSynthesisFingerprint(cue, provider = cue.provider) {
  if (!provider) return null;
  return sha256Text(JSON.stringify(cueSynthesisMetadata(cue, provider)));
}

export async function cueEffectiveProvider(cue) {
  if (cue.provider) return cue.provider;
  const metadata = await readCueFixtureMetadata(cue);
  return metadata?.provider || null;
}

export async function cueFixtureFingerprint(cue) {
  return cueSynthesisFingerprint(cue, await cueEffectiveProvider(cue));
}

export async function writeCueFixtureSidecars(cue, provider) {
  await writeCueTextFile(cue);
  const metadataPath = `${cue.outputPath}.fixture.json`;
  await writeFile(metadataPath, `${JSON.stringify(cueSynthesisMetadata(cue, provider), null, 2)}\n`, "utf8");
  return metadataPath;
}

export async function cueFixtureMatches(cue) {
  try {
    const text = await readFile(`${cue.outputPath}.txt`, "utf8");
    if (text !== (cue.text || "")) return false;
    const actual = await readCueFixtureMetadata(cue);
    if (!actual) return !cue.provider;
    const provider = cue.provider || actual.provider;
    return Boolean(provider) && JSON.stringify(actual) === JSON.stringify(cueSynthesisMetadata(cue, provider));
  } catch {
    return false;
  }
}

async function readCueFixtureMetadata(cue) {
  try {
    return JSON.parse(await readFile(`${cue.outputPath}.fixture.json`, "utf8"));
  } catch {
    return null;
  }
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}
