import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDemoMarkdown } from "./parse-demo.mjs";
import { compileTimeline, defaultTimelinePath, resolveArtifactOutputPath } from "./compile-timeline.mjs";
import { defaultPreviewPath } from "./render-preview.mjs";
import { renderState } from "./render-state.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SECRET_PATTERNS = [
  { name: "github_token", pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/ },
  { name: "openai_style_token", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "slack_token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { name: "aws_access_key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "private_home_path", pattern: /\/Users\/[A-Za-z0-9._-]+/ },
];

const ALLOWED_COMMANDS = new Set(["relay"]);

export async function evaluateDemo(sourcePath) {
  const absoluteSourcePath = path.resolve(sourcePath);
  const markdown = await readFile(absoluteSourcePath, "utf8");
  const parsed = parseDemoMarkdown(absoluteSourcePath, markdown);
  const timelinePath = resolveArtifactOutputPath(parsed.frontmatter.timeline || defaultTimelinePath(absoluteSourcePath));
  const previewPath = resolveArtifactOutputPath(parsed.frontmatter.preview || defaultPreviewPath(absoluteSourcePath));
  const reportPath = resolveArtifactOutputPath(parsed.frontmatter.evaluation || defaultEvaluationPath(absoluteSourcePath));
  const expectedTimeline = compileTimeline(parsed);
  const checks = [];

  check(checks, "editor_surface_present", parsed.blocks.some((block) => block.type === "editor"), "scenario has a dailies:editor block");
  check(checks, "terminal_surface_present", parsed.blocks.some((block) => block.type === "terminal"), "scenario has a dailies:terminal block");
  check(checks, "self_review_present", parsed.blocks.some((block) => block.type === "self-review"), "scenario declares self-review criteria");
  check(checks, "self_review_json_valid", selfReviewJsonValid(parsed), "self-review block contains valid JSON");
  check(checks, "fixture_only_execution", parsed.frontmatter.executionMode === "fixture-only" && !/\bexec\s*:\s*true\b/i.test(markdown), "scenario is fixture-only and does not request live execution");
  check(checks, "relay_commands_only", relayCommandsOnly(parsed), "terminal command lines use the relay allowlist");
  check(checks, "timeline_under_25_seconds", expectedTimeline.durationMs <= 25000, "compiled timeline stays under 25 seconds");
  check(checks, "terminal_outputs_instant", terminalOutputsInstant(expectedTimeline), "terminal output events render fully as soon as they start");
  check(checks, "audio_cues_do_not_linger", audioCuesDoNotLinger(expectedTimeline), "audio cue overlays disappear after the active cue window");
  check(checks, "audio_cues_declared", audioCuesDeclared(parsed), "audio cue blocks declare line, text, output, and non-live mode");
  check(checks, "no_obvious_secrets_or_private_paths", noSecretPatterns(markdown), "scenario text does not match obvious secret or private-path patterns");
  check(checks, "timeline_artifact_exists", await exists(timelinePath), `timeline artifact exists at ${path.relative(PROJECT_ROOT, timelinePath)}`);
  check(checks, "timeline_has_events", await timelineHasEvents(timelinePath), "timeline artifact contains events");
  check(checks, "timeline_has_no_private_paths", await timelineHasNoPrivatePaths(timelinePath), "timeline artifact does not expose local private paths");
  check(checks, "timeline_matches_scenario", await timelineMatchesScenario(timelinePath, expectedTimeline), "timeline artifact matches the current scenario");
  check(checks, "timeline_has_expected_surfaces", await timelineHasExpectedSurfaces(timelinePath), "timeline artifact includes editor and terminal events");
  check(checks, "preview_artifact_exists", await exists(previewPath), `preview artifact exists at ${path.relative(PROJECT_ROOT, previewPath)}`);
  check(checks, "preview_has_expected_surfaces", await previewHasExpectedSurfaces(previewPath), "preview artifact includes editor and terminal surfaces");
  check(checks, "preview_has_no_private_paths", await textArtifactHasNoPrivatePaths(previewPath), "preview artifact does not expose local private paths");

  const selfReview = parsed.blocks.find((block) => block.type === "self-review")?.data;
  for (const artifact of selfReview?.requiredArtifacts || []) {
    const artifactPath = safeArtifactPath(artifact);
    check(checks, `required_artifact:${artifact}`, await exists(artifactPath), `required artifact exists at ${artifact}`);
  }

  const status = checks.every((item) => item.status === "pass") ? "pass" : "fail";
  const report = {
    version: 1,
    status,
    sourcePath: path.relative(PROJECT_ROOT, absoluteSourcePath),
    timelinePath: path.relative(PROJECT_ROOT, timelinePath),
    previewPath: path.relative(PROJECT_ROOT, previewPath),
    generatedAt: new Date().toISOString(),
    checks,
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return { report, reportPath };
}

function check(checks, name, passed, detail) {
  checks.push({
    name,
    status: passed ? "pass" : "fail",
    detail,
  });
}

function selfReviewJsonValid(parsed) {
  const block = parsed.blocks.find((item) => item.type === "self-review");
  return Boolean(block?.data && !block.data.parseError && Array.isArray(block.data.checks));
}

function relayCommandsOnly(parsed) {
  return terminalCommands(parsed).every((command) => {
    if (containsShellControl(command)) return false;
    const executable = command.trim().split(/\s+/)[0];
    return ALLOWED_COMMANDS.has(executable);
  });
}

function terminalCommands(parsed) {
  return parsed.blocks
    .filter((block) => block.type === "terminal")
    .flatMap((block) => block.content.split(/\r?\n/))
    .filter((line) => line.startsWith("$ "))
    .map((line) => line.slice(2));
}

function audioCuesDeclared(parsed) {
  const cues = parsed.blocks.filter((block) => block.type === "audio-cue");
  if (cues.length === 0) return false;
  return cues.every((cue) => {
    const data = cue.data || {};
    return Boolean(data.line && data.text && data.output && data.mode === "declared-fixture" && isSafeArtifactPath(data.output));
  });
}

function terminalOutputsInstant(timeline) {
  const outputEvents = (timeline.events || []).filter((event) => event.surface === "terminal" && event.action === "show-output");
  if (outputEvents.length === 0) return false;

  return outputEvents.every((event) => {
    const state = renderState(timeline, event.startMs);
    return state.terminalEntries.some((entry) => entry.kind === "output" && entry.text === event.text);
  });
}

function audioCuesDoNotLinger(timeline) {
  const audioEvents = (timeline.events || []).filter((event) => event.surface === "audio" && event.action === "declare-cue");
  return audioEvents.every((event) => {
    const afterCueWindowMs = event.startMs + 3500;
    if (afterCueWindowMs >= (timeline.durationMs || 0)) return true;
    return !renderState(timeline, afterCueWindowMs).audioCue;
  });
}

function noSecretPatterns(markdown) {
  return SECRET_PATTERNS.every(({ pattern }) => !pattern.test(markdown));
}

async function timelineHasEvents(timelinePath) {
  try {
    const raw = await readFile(timelinePath, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data.events) && data.events.length > 0;
  } catch {
    return false;
  }
}

async function timelineMatchesScenario(timelinePath, expectedTimeline) {
  try {
    const raw = await readFile(timelinePath, "utf8");
    const actualTimeline = JSON.parse(raw);
    return JSON.stringify(actualTimeline) === JSON.stringify(expectedTimeline);
  } catch {
    return false;
  }
}

async function timelineHasExpectedSurfaces(timelinePath) {
  try {
    const raw = await readFile(timelinePath, "utf8");
    const timeline = JSON.parse(raw);
    const surfaces = new Set((timeline.events || []).map((event) => event.surface));
    return surfaces.has("editor") && surfaces.has("terminal");
  } catch {
    return false;
  }
}

async function timelineHasNoPrivatePaths(timelinePath) {
  return textArtifactHasNoPrivatePaths(timelinePath);
}

async function previewHasExpectedSurfaces(previewPath) {
  try {
    const raw = await readFile(previewPath, "utf8");
    return raw.includes('data-dailies-preview="true"')
      && raw.includes('data-surface="editor"')
      && raw.includes('data-surface="terminal"')
      && raw.includes("renderDailiesState");
  } catch {
    return false;
  }
}

async function textArtifactHasNoPrivatePaths(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return noSecretPatterns(raw);
  } catch {
    return false;
  }
}

function containsShellControl(command) {
  const withoutPlaceholders = command.replace(/<[a-z0-9-]+>/gi, "PLACEHOLDER");
  return /(?:&&|\|\||[;|`<>]|\$\(|\${)/.test(withoutPlaceholders);
}

function isSafeArtifactPath(outputPath) {
  try {
    safeArtifactPath(outputPath);
    return true;
  } catch {
    return false;
  }
}

function safeArtifactPath(outputPath) {
  return resolveArtifactOutputPath(outputPath);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function defaultEvaluationPath(sourcePath) {
  const relative = path.relative(PROJECT_ROOT, path.resolve(sourcePath));
  const withoutDemoSuffix = relative.replace(/\.demo\.md$/, "");
  if (withoutDemoSuffix.startsWith(`demos${path.sep}`)) {
    return path.join("artifacts", withoutDemoSuffix.slice(`demos${path.sep}`.length) + ".evaluation.json");
  }
  return path.join("artifacts", path.basename(withoutDemoSuffix) + ".evaluation.json");
}

async function main(argv) {
  const source = argv[2];
  if (!source) {
    console.error("Usage: node src/evaluate-demo.mjs <demo.md>");
    return 2;
  }

  const { report, reportPath } = await evaluateDemo(source);
  console.log(reportPath);
  console.log(`status=${report.status}`);
  return report.status === "pass" ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv).then((code) => {
    process.exitCode = code;
  });
}
