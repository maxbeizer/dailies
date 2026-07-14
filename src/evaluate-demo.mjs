import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDemoMarkdown } from "./parse-demo.mjs";
import { compileTimeline, defaultTimelinePath, ledgerCountersMonotonic, resolveArtifactOutputPath, validateSceneData } from "./compile-timeline.mjs";
import { defaultPreviewPath } from "./render-preview.mjs";
import { renderState } from "./render-state.mjs";
import { inspectMediaSources, inspectProductionAssets, mediaEvents } from "./media-fixtures.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SECRET_PATTERNS = [
  { name: "github_token", pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/ },
  { name: "openai_style_token", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "slack_token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { name: "aws_access_key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "private_home_path", pattern: /\/Users\/[A-Za-z0-9._-]+/ },
  { name: "brain_local_reference", pattern: /(?:~\/Brain|\/Brain(?:\/|$)|Daily Projects\/|Weekly Notes\/|Meeting Notes\/|Projects\/)/ },
  { name: "brain_wikilink", pattern: /\[\[[^\]]+\]\]/ },
  { name: "brain_uid", pattern: /\buid:\s*[a-z0-9]{6,}\b/i },
  { name: "session_uuid", pattern: /\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/i },
];

const ALLOWED_AUDIO_PROVIDERS = new Set(["say", "speechify", "kokoro"]);
const ATTENTION_CONTROL_ROOM_SET = "attention-control-room";
const MEDIA_SETS = new Set(["studio-monitor", "full-screen-media"]);

export function demoDurationLimitSeconds(set, frontmatter) {
  if (set === ATTENTION_CONTROL_ROOM_SET) return Number(frontmatter.maxDurationSeconds || 120);
  if (MEDIA_SETS.has(set)) return Number(frontmatter.maxDurationSeconds || 60);
  return 25;
}

export async function evaluateDemo(sourcePath) {
  const absoluteSourcePath = path.resolve(sourcePath);
  const markdown = await readFile(absoluteSourcePath, "utf8");
  const parsed = parseDemoMarkdown(absoluteSourcePath, markdown);
  const timelinePath = resolveArtifactOutputPath(parsed.frontmatter.timeline || defaultTimelinePath(absoluteSourcePath));
  const previewPath = resolveArtifactOutputPath(parsed.frontmatter.preview || defaultPreviewPath(absoluteSourcePath));
  const reportPath = resolveArtifactOutputPath(parsed.frontmatter.evaluation || defaultEvaluationPath(absoluteSourcePath));
  const expectedTimeline = compileTimeline(parsed);
  const checks = [];
  const set = parsed.frontmatter.set || "editor-terminal";
  const maxDurationSeconds = demoDurationLimitSeconds(set, parsed.frontmatter);

  if (set === ATTENTION_CONTROL_ROOM_SET) {
    const minSceneCount = Number(parsed.frontmatter.minSceneCount || 8);
    check(checks, "attention_control_room_set", expectedTimeline.set === ATTENTION_CONTROL_ROOM_SET, "timeline selects the attention control room set");
    check(checks, "scene_blocks_present", parsed.blocks.filter((block) => block.type === "scene").length >= minSceneCount, `scenario has at least ${minSceneCount} dailies:scene blocks`);
    check(checks, "scene_blocks_valid", sceneBlocksValid(parsed), "scene blocks contain valid, renderable JSON");
    check(checks, "scene_narration_aligned", sceneNarrationAligned(expectedTimeline), "each scene begins with an audio cue and all cues stay inside a scene");
    check(checks, "cutaway_scenes_labeled", cutawayScenesLabeled(parsed), "cutaway scenes declare their source and reenactment status");
    check(checks, "reenactment_scenes_labeled", reenactmentScenesLabeled(parsed), "focused reenactment scenes declare their source and status");
    if (expectedTimeline.events.some((event) => event.scene?.layout === "ledger")) {
      check(checks, "ledger_counters_monotonic", ledgerCountersMonotonic(expectedTimeline), "ledger counters never move backwards");
      const minLedgerEntries = Number(parsed.frontmatter.minLedgerEntries || 1);
      check(checks, "ledger_activity_present", ledgerActivityCount(parsed) >= minLedgerEntries, `ledger declares at least ${minLedgerEntries} activity entries`);
    }
    check(checks, "timeline_within_declared_limit", expectedTimeline.durationMs <= maxDurationSeconds * 1000, `compiled timeline stays under ${maxDurationSeconds} seconds`);
  } else if (MEDIA_SETS.has(set)) {
    if (set === "studio-monitor") {
      check(checks, "editor_surface_present", parsed.blocks.some((block) => block.type === "editor"), "scenario has a dailies:editor block");
      check(checks, "terminal_surface_present", parsed.blocks.some((block) => block.type === "terminal"), "scenario has a dailies:terminal block");
    }
    check(checks, "media_blocks_present", parsed.blocks.some((block) => block.type === "media"), "scenario has at least one dailies:media block");
    check(checks, "timeline_within_declared_limit", expectedTimeline.durationMs <= maxDurationSeconds * 1000, `compiled timeline stays under ${maxDurationSeconds} seconds`);
    check(checks, "terminal_outputs_instant", terminalOutputsInstant(expectedTimeline), "terminal output events render fully as soon as they start");
    check(checks, "audio_cues_do_not_linger", audioCuesDoNotLinger(expectedTimeline), "audio cue overlays disappear after the active cue window");
  } else {
    check(checks, "editor_surface_present", parsed.blocks.some((block) => block.type === "editor"), "scenario has a dailies:editor block");
    check(checks, "terminal_surface_present", parsed.blocks.some((block) => block.type === "terminal"), "scenario has a dailies:terminal block");
    check(checks, "timeline_under_25_seconds", expectedTimeline.durationMs <= 25000, "compiled timeline stays under 25 seconds");
    check(checks, "terminal_outputs_instant", terminalOutputsInstant(expectedTimeline), "terminal output events render fully as soon as they start");
    check(checks, "audio_cues_do_not_linger", audioCuesDoNotLinger(expectedTimeline), "audio cue overlays disappear after the active cue window");
  }

  check(checks, "self_review_present", parsed.blocks.some((block) => block.type === "self-review"), "scenario declares self-review criteria");
  check(checks, "self_review_json_valid", selfReviewJsonValid(parsed), "self-review block contains valid JSON");
  check(checks, "fixture_only_execution", parsed.frontmatter.executionMode === "fixture-only" && !/\bexec\s*:\s*true\b/i.test(markdown), "scenario is fixture-only and does not request live execution");
  check(checks, "relay_commands_only", relayCommandsOnly(parsed), "terminal command lines use the fixture command allowlist");
  check(checks, "audio_cues_declared", audioCuesDeclared(parsed), "audio cue blocks declare line, text, output, and non-live mode");
  check(checks, "no_obvious_secrets_or_private_paths", noSecretPatterns(markdown), "scenario text does not match obvious secret or private-path patterns");
  check(checks, "timeline_artifact_exists", await exists(timelinePath), `timeline artifact exists at ${path.relative(PROJECT_ROOT, timelinePath)}`);
  check(checks, "timeline_has_events", await timelineHasEvents(timelinePath), "timeline artifact contains events");
  check(checks, "timeline_has_no_private_paths", await timelineHasNoPrivatePaths(timelinePath), "timeline artifact does not expose local private paths");
  check(checks, "timeline_matches_scenario", await timelineMatchesScenario(timelinePath, expectedTimeline), "timeline artifact matches the current scenario");
  check(checks, "timeline_has_expected_surfaces", await timelineHasExpectedSurfaces(timelinePath, set), `timeline artifact includes the expected ${set} surfaces`);
  check(checks, "preview_artifact_exists", await exists(previewPath), `preview artifact exists at ${path.relative(PROJECT_ROOT, previewPath)}`);
  check(checks, "preview_has_expected_surfaces", await previewHasExpectedSurfaces(previewPath, set), `preview artifact includes the expected ${set} set marker`);
  check(checks, "preview_has_no_private_paths", await textArtifactHasNoPrivatePaths(previewPath), "preview artifact does not expose local private paths");
  const mediaInspection = await inspectMediaSources(expectedTimeline);
  if (mediaInspection.length > 0) {
    check(checks, "media_sources_exist", mediaInspection.every((item) => item.exists), "every declared media source exists under assets/");
    const probeUnavailable = mediaInspection.some((item) => item.probe === "unavailable");
    if (probeUnavailable) {
      skip(checks, "media_source_windows_valid", "ffprobe is unavailable; source-window validation is deferred to candidate evaluation");
    } else {
      check(checks, "media_source_windows_valid", mediaInspection.every((item) => item.windowValid), "every declared source window fits inside its media file");
    }
    const productionAssets = await inspectProductionAssets(expectedTimeline);
    if (productionAssets.length > 0) {
      check(checks, "production_assets_exist", productionAssets.every((item) => item.exists), "every declared production asset exists under assets/");
    }
  }

  const selfReview = parsed.blocks.find((block) => block.type === "self-review")?.data;
  for (const artifact of selfReview?.requiredArtifacts || []) {
    const artifactPath = safeArtifactPath(artifact);
    check(checks, `required_artifact:${artifact}`, await exists(artifactPath), `required artifact exists at ${artifact}`);
  }
  const checksByName = new Map(checks.map((item) => [item.name, item]));
  check(
    checks,
    "self_review_checks_pass",
    (selfReview?.checks || []).every((name) => checksByName.get(name)?.status === "pass"),
    "every requested self-review check was executed and passed",
  );

  const status = checks.some((item) => item.status === "fail") ? "fail" : "pass";
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

function skip(checks, name, detail) {
  checks.push({ name, status: "skip", detail });
}

function selfReviewJsonValid(parsed) {
  const block = parsed.blocks.find((item) => item.type === "self-review");
  return Boolean(block?.data && !block.data.parseError && Array.isArray(block.data.checks));
}

function sceneBlocksValid(parsed) {
  const scenes = parsed.blocks.filter((block) => block.type === "scene");
  try {
    scenes.forEach((block, index) => validateSceneData(block.data, index));
    return scenes.length > 0;
  } catch {
    return false;
  }
}

function sceneNarrationAligned(timeline) {
  const scenes = (timeline.events || []).filter((event) => event.surface === "scene");
  const audioEvents = (timeline.events || []).filter((event) => event.surface === "audio");
  const assigned = new Set();

  if (scenes.length === 0 || audioEvents.length === 0) return false;

  for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
    const scene = scenes[sceneIndex];
    const sceneAudio = audioEvents
      .filter((event) => event.sceneIndex === sceneIndex)
      .sort((left, right) => left.startMs - right.startMs);
    if (sceneAudio.length === 0 || sceneAudio[0].startMs !== scene.startMs) return false;
    sceneAudio.forEach((event) => assigned.add(event));
  }

  return assigned.size === audioEvents.length;
}

function reenactmentScenesLabeled(parsed) {
  return parsed.blocks
    .filter((block) => block.type === "scene" && (block.data?.layout === "cutaway" || (block.data?.layout === "ledger" && block.data?.focus)))
    .every((block) => block.data?.reenactment === true && typeof block.data?.sourceLabel === "string" && block.data.sourceLabel.trim());
}

function cutawayScenesLabeled(parsed) {
  return parsed.blocks
    .filter((block) => block.type === "scene" && block.data?.layout === "cutaway")
    .every((block) => block.data?.reenactment === true && typeof block.data?.sourceLabel === "string" && block.data.sourceLabel.trim());
}

function ledgerActivityCount(parsed) {
  const declaredEntries = parsed.blocks
    .filter((block) => block.type === "scene" && block.data?.layout === "ledger")
    .reduce((count, block) => count + (block.data?.ledger?.length || 0), 0);
  const dialogueEntries = parsed.blocks
    .filter((block) => block.type === "audio-cue" && block.data?.showInLedger === true)
    .length;
  return declaredEntries + dialogueEntries;
}

function relayCommandsOnly(parsed) {
  return terminalCommands(parsed).every(terminalCommandAllowed);
}

export function terminalCommandAllowed(command) {
  if (containsShellControl(command)) return false;
  if (/^relay(?:\s|$)/.test(command.trim())) return true;
  return /^npm run (?:capture:live|compile:demo|render:preview|evaluate:demo|render:video|render:candidate|evaluate:candidate|check)(?:\s+--(?:\s|$).*)?$/.test(command.trim());
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
    const provider = data.provider || parsed.frontmatter.audioProvider || null;
    const speedValid = data.speed === undefined
      || (provider === "kokoro" && Number.isFinite(Number(data.speed)) && Number(data.speed) > 0);
    const ledgerValid = data.showInLedger !== true
      || (typeof data.ledgerTime === "string" && data.ledgerTime.trim()
        && typeof data.ledgerSource === "string" && data.ledgerSource.trim());
    return Boolean(
      data.line
      && data.text
      && data.output
      && data.mode === "declared-fixture"
      && isSafeArtifactPath(data.output)
      && (!provider || ALLOWED_AUDIO_PROVIDERS.has(provider))
      && speedValid
      && ledgerValid
    );
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

async function timelineHasExpectedSurfaces(timelinePath, set) {
  try {
    const raw = await readFile(timelinePath, "utf8");
    const timeline = JSON.parse(raw);
    const surfaces = new Set((timeline.events || []).map((event) => event.surface));
    if (set === ATTENTION_CONTROL_ROOM_SET) {
      return timeline.set === ATTENTION_CONTROL_ROOM_SET && surfaces.has("scene") && surfaces.has("audio");
    }
    if (set === "studio-monitor" || set === "full-screen-media") {
      return timeline.set === set && surfaces.has("media");
    }
    return surfaces.has("editor") && surfaces.has("terminal");
  } catch {
    return false;
  }
}

async function timelineHasNoPrivatePaths(timelinePath) {
  return textArtifactHasNoPrivatePaths(timelinePath);
}

async function previewHasExpectedSurfaces(previewPath, set) {
  try {
    const raw = await readFile(previewPath, "utf8");
    if (set === ATTENTION_CONTROL_ROOM_SET) {
      return raw.includes('data-dailies-preview="true"')
        && raw.includes('data-dailies-set="attention-control-room"')
        && raw.includes('data-lane-id="copilot"')
        && raw.includes('data-lane-id="brain"')
        && raw.includes('data-lane-id="github"')
        && raw.includes('data-lane-id="slack"');
    }
    if (set === "studio-monitor" || set === "full-screen-media") {
      return raw.includes('data-dailies-preview="true"')
        && raw.includes(`data-dailies-set="${set}"`)
        && raw.includes('id="mediaMonitor"')
        && raw.includes("window.__dailiesPrepareFrame");
    }
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
