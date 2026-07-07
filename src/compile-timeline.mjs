import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDemoMarkdown } from "./parse-demo.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function compileTimeline(parsed) {
  let cursorMs = 0;
  const events = [];

  for (const block of parsed.blocks) {
    if (block.type === "editor") {
      const durationMs = estimateTypingDuration(block.content);
      events.push({
        surface: "editor",
        action: "type",
        startMs: cursorMs,
        durationMs,
        text: block.content,
      });
      cursorMs += durationMs + 600;
    }

    if (block.type === "terminal") {
      for (const part of parseTerminalParts(block.content)) {
        const durationMs = part.kind === "command" ? estimateTypingDuration(part.text) : estimateReadingDuration(part.text);
        events.push({
          surface: "terminal",
          action: part.kind === "command" ? "type-command" : "show-output",
          startMs: cursorMs,
          durationMs,
          text: part.text,
        });
        cursorMs += durationMs + 300;
      }
    }

    if (block.type === "audio-cue") {
      events.push({
        surface: "audio",
        action: "declare-cue",
        startMs: cursorMs,
        durationMs: 0,
        cue: block.data,
      });
    }
  }

  return {
    version: 1,
    sourcePath: path.relative(PROJECT_ROOT, parsed.sourcePath),
    title: parsed.frontmatter.title || firstHeading(parsed) || "Untitled demo",
    slug: parsed.frontmatter.slug || slugFromPath(parsed.sourcePath),
    executionMode: parsed.frontmatter.executionMode || "fixture-only",
    durationMs: cursorMs,
    events,
    selfReview: parsed.blocks.find((block) => block.type === "self-review")?.data || null,
  };
}

export function defaultTimelinePath(sourcePath) {
  const relative = path.relative(PROJECT_ROOT, path.resolve(sourcePath));
  const withoutDemoSuffix = relative.replace(/\.demo\.md$/, "");
  if (withoutDemoSuffix.startsWith(`demos${path.sep}`)) {
    return path.join("artifacts", withoutDemoSuffix.slice(`demos${path.sep}`.length) + ".timeline.json");
  }
  return path.join("artifacts", path.basename(withoutDemoSuffix) + ".timeline.json");
}

export function resolveArtifactOutputPath(outputPath) {
  if (!outputPath) {
    throw new Error("output path is required");
  }

  if (path.isAbsolute(outputPath)) {
    throw new Error(`artifact output path must be relative: ${outputPath}`);
  }

  const resolved = path.resolve(PROJECT_ROOT, outputPath);
  const artifactsRoot = path.join(PROJECT_ROOT, "artifacts");
  const relative = path.relative(artifactsRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative) || relative === "") {
    throw new Error(`artifact output path must stay under artifacts/: ${outputPath}`);
  }

  return resolved;
}

function parseTerminalParts(content) {
  const parts = [];
  let output = [];

  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith("$ ")) {
      flushOutput(parts, output);
      output = [];
      parts.push({ kind: "command", text: line.slice(2) });
    } else {
      output.push(line);
    }
  }

  flushOutput(parts, output);
  return parts;
}

function flushOutput(parts, output) {
  const text = output.join("\n").trim();
  if (text) parts.push({ kind: "output", text });
}

function estimateTypingDuration(text) {
  return Math.max(900, Math.ceil(text.length / 18) * 1000);
}

function estimateReadingDuration(text) {
  return Math.max(700, Math.ceil(text.length / 45) * 1000);
}

function firstHeading(parsed) {
  return parsed.headings[0]?.text;
}

function slugFromPath(sourcePath) {
  return path.basename(sourcePath).replace(/\.demo\.md$/, "");
}

async function main(argv) {
  const source = argv[2];
  if (!source) {
    console.error("Usage: node src/compile-timeline.mjs <demo.md> [output.json]");
    return 2;
  }

  const sourcePath = path.resolve(source);
  const markdown = await readFile(sourcePath, "utf8");
  const parsed = parseDemoMarkdown(sourcePath, markdown);
  const timeline = compileTimeline(parsed);
  const outputPath = resolveArtifactOutputPath(argv[3] || parsed.frontmatter.timeline || defaultTimelinePath(sourcePath));

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(timeline, null, 2)}\n`);
  console.log(outputPath);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv).then((code) => {
    process.exitCode = code;
  });
}
