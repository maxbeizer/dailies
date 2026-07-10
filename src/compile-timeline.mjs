import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDemoMarkdown } from "./parse-demo.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function compileTimeline(parsed) {
  let cursorMs = 0;
  const events = [];
  let sceneIndex = 0;
  const hasScenes = parsed.blocks.some((block) => block.type === "scene");
  const pendingSceneAudioEvents = [];

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
      const offsetMs = block.data?.offsetMs ?? 0;
      if (!Number.isInteger(offsetMs) || offsetMs < 0) {
        throw new Error("audio cue offsetMs must be a nonnegative integer");
      }
      const event = {
        surface: "audio",
        action: "declare-cue",
        startMs: cursorMs + offsetMs,
        durationMs: 0,
        cue: block.data,
      };
      events.push(event);
      if (hasScenes) pendingSceneAudioEvents.push(event);
    }

    if (block.type === "scene") {
      const scene = validateSceneData(block.data, sceneIndex);
      const sceneEndMs = cursorMs + scene.durationMs;
      for (const event of pendingSceneAudioEvents) {
        if (event.startMs < cursorMs || event.startMs >= sceneEndMs) {
          throw new Error(`audio cue offsetMs must start within following scene ${scene.id}`);
        }
        event.sceneIndex = sceneIndex;
      }
      pendingSceneAudioEvents.length = 0;
      events.push({
        surface: "scene",
        action: "show-scene",
        startMs: cursorMs,
        durationMs: scene.durationMs,
        scene,
      });
      cursorMs += scene.durationMs;
      sceneIndex += 1;
    }
  }

  if (pendingSceneAudioEvents.length > 0) {
    throw new Error("audio cues in scene timelines must be followed by a scene");
  }

  const timeline = {
    version: 1,
    sourcePath: path.relative(PROJECT_ROOT, parsed.sourcePath),
    title: parsed.frontmatter.title || firstHeading(parsed) || "Untitled demo",
    slug: parsed.frontmatter.slug || slugFromPath(parsed.sourcePath),
    executionMode: parsed.frontmatter.executionMode || "fixture-only",
    durationMs: cursorMs,
    events,
    selfReview: parsed.blocks.find((block) => block.type === "self-review")?.data || null,
  };

  if (parsed.frontmatter.set) {
    timeline.set = parsed.frontmatter.set;
  }

  if (parsed.frontmatter.maxDurationSeconds !== undefined) {
    const maxDurationSeconds = Number(parsed.frontmatter.maxDurationSeconds);
    if (!Number.isFinite(maxDurationSeconds) || maxDurationSeconds <= 0) {
      throw new Error("maxDurationSeconds must be a positive number");
    }
    timeline.maxDurationSeconds = maxDurationSeconds;
  }

  return timeline;
}

export function validateSceneData(data, index = 0) {
  if (!data || data.parseError) {
    throw new Error(`scene ${index + 1} must contain valid JSON`);
  }

  const requiredStrings = ["id", "clock", "headline", "body"];
  for (const key of requiredStrings) {
    if (typeof data[key] !== "string" || !data[key].trim()) {
      throw new Error(`scene ${index + 1} requires ${key}`);
    }
  }

  if (!Number.isInteger(data.durationMs) || data.durationMs < 1000) {
    throw new Error(`scene durationMs must be an integer of at least 1000`);
  }

  if (data.concurrency !== undefined && (!Number.isInteger(data.concurrency) || data.concurrency < 0 || data.concurrency > 5)) {
    throw new Error(`scene ${index + 1} concurrency must be an integer from 0 to 5`);
  }

  if (data.lanes !== undefined && !Array.isArray(data.lanes)) {
    throw new Error(`scene ${index + 1} lanes must be an array`);
  }

  for (const lane of data.lanes || []) {
    if (!lane || typeof lane.id !== "string" || typeof lane.label !== "string") {
      throw new Error(`scene ${index + 1} lanes require id and label`);
    }
    if (lane.items !== undefined && (!Array.isArray(lane.items) || lane.items.some((item) => typeof item !== "string"))) {
      throw new Error(`scene ${index + 1} lane items must be strings`);
    }
  }

  if (data.foreground !== undefined) {
    if (!data.foreground || typeof data.foreground.label !== "string" || typeof data.foreground.action !== "string") {
      throw new Error(`scene ${index + 1} foreground requires label and action`);
    }
  }

  const layout = data.layout || "control-room";
  if (!["control-room", "cutaway"].includes(layout)) {
    throw new Error(`scene ${index + 1} layout must be control-room or cutaway`);
  }

  if (layout === "cutaway") {
    if (data.reenactment !== true) {
      throw new Error(`scene ${index + 1} cutaways must declare reenactment: true`);
    }
    if (typeof data.sourceLabel !== "string" || !data.sourceLabel.trim()) {
      throw new Error(`scene ${index + 1} cutaways require sourceLabel`);
    }
    if (!["copilot", "slack", "deployment"].includes(data.variant)) {
      throw new Error(`scene ${index + 1} cutaway variant must be copilot, slack, or deployment`);
    }
  }

  return {
    kicker: "",
    camera: "wide",
    accent: "human",
    layout,
    concurrency: 0,
    foreground: {
      label: "Human foreground",
      action: data.headline,
    },
    lanes: [],
    metrics: [],
    ...data,
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
  return Math.max(450, Math.ceil(text.length / 38) * 1000);
}

function estimateReadingDuration(text) {
  return Math.max(300, Math.ceil(text.length / 110) * 1000);
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
