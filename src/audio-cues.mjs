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
      outputPath: resolveArtifactOutputPath(block.data?.output),
      event: timeline.events.find((event) => event.surface === "audio" && event.cue?.output === block.data?.output),
    }));
  return { parsed, timeline, cues };
}

export async function writeCueTextFile(cue) {
  const textPath = `${cue.outputPath}.txt`;
  await mkdir(path.dirname(textPath), { recursive: true });
  await writeFile(textPath, cue.text || "", "utf8");
  return textPath;
}
