import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  loadLiveAppCapture,
  validateLiveAppCapture,
} from "../src/live-app-capture.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXAMPLES_ROOT = path.join(PROJECT_ROOT, "examples", "live-app-capture");

test("valid examples define repeatable TextEdit capture takes", async () => {
  const story = await loadExample("textedit-story.capture.json");
  const secondTake = await loadExample("textedit-second-take.capture.json");

  assert.deepEqual(story, {
    version: 1,
    id: "textedit-story",
    platform: "macos",
    app: { bundleId: "com.apple.TextEdit" },
    director: "examples/live-app-capture/textedit-director.applescript",
    output: "assets/captures/textedit-story.mp4",
    durationMs: 7000,
    setup: [{ action: "prepare", timeoutMs: 5000 }],
    actions: [
      { atMs: 1000, action: "showOpening", timeoutMs: 3000 },
      { atMs: 3500, action: "showRevision", timeoutMs: 3000 },
    ],
    teardown: [{ action: "reset", timeoutMs: 5000 }],
  });
  assert.equal(secondTake.teardown[0].action, "reset");
  assert.equal(secondTake.director, story.director);
});

test("invalid examples each demonstrate one rejected boundary", async () => {
  const cases = [
    ["inline-script.capture.json", /unsupported field inlineScript/],
    ["absolute-director.capture.json", /director must be relative/],
    ["traversal-director.capture.json", /director must stay inside the repository/],
    ["output-escape.capture.json", /output must stay under assets\/captures/],
    ["unapproved-app.capture.json", /bundle ID is not allowlisted/],
    ["unordered-actions.capture.json", /actions must be ordered by atMs/],
    ["shell-escape.capture.json", /must not contain do shell script/],
    ["system-events.capture.json", /must not use System Events/],
    ["system-events-alias.capture.json", /must not use System Events/],
    ["system-events-bundle-id.capture.json", /must not use System Events/],
  ];

  for (const [name, expectedError] of cases) {
    await assert.rejects(loadInvalidExample(name), expectedError);
  }
});

test("director paths fail closed when missing or not AppleScript", async () => {
  const valid = JSON.parse(await readFile(path.join(EXAMPLES_ROOT, "textedit-story.capture.json"), "utf8"));

  await assert.rejects(
    validateLiveAppCapture({ ...valid, director: "examples/live-app-capture/missing.applescript" }),
    /director does not exist/,
  );
  await assert.rejects(
    validateLiveAppCapture({ ...valid, director: "examples/live-app-capture/textedit-story.capture.json" }),
    /director must be an AppleScript file/,
  );
});

test("director symlinks cannot escape the repository", async (t) => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "dailies-live-capture-"));
  const externalRoot = await mkdtemp(path.join(os.tmpdir(), "dailies-live-capture-external-"));
  t.after(async () => {
    await Promise.all([
      rm(projectRoot, { recursive: true, force: true }),
      rm(externalRoot, { recursive: true, force: true }),
    ]);
  });

  await mkdir(path.join(projectRoot, "spec"), { recursive: true });
  await mkdir(path.join(projectRoot, "directors"), { recursive: true });
  await writeFile(
    path.join(projectRoot, "spec", "live-app-capture-allowlist.json"),
    JSON.stringify({ version: 1, allowedBundleIds: ["com.apple.TextEdit"] }),
  );
  const externalDirector = path.join(externalRoot, "director.applescript");
  await writeFile(externalDirector, "return");
  await symlink(externalDirector, path.join(projectRoot, "directors", "director.applescript"));

  await assert.rejects(
    validateLiveAppCapture({
      version: 1,
      id: "symlink-escape",
      platform: "macos",
      app: { bundleId: "com.apple.TextEdit" },
      director: "directors/director.applescript",
      output: "assets/captures/symlink-escape.mp4",
      durationMs: 1000,
      setup: [],
      actions: [],
      teardown: [],
    }, { projectRoot }),
    /director must resolve inside the repository/,
  );
});

test("capture output paths cannot escape through symlinks", async (t) => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "dailies-live-capture-output-"));
  const externalRoot = await mkdtemp(path.join(os.tmpdir(), "dailies-live-capture-output-external-"));
  t.after(async () => {
    await Promise.all([
      rm(projectRoot, { recursive: true, force: true }),
      rm(externalRoot, { recursive: true, force: true }),
    ]);
  });

  await mkdir(path.join(projectRoot, "spec"), { recursive: true });
  await mkdir(path.join(projectRoot, "directors"), { recursive: true });
  await mkdir(path.join(projectRoot, "assets"), { recursive: true });
  await writeFile(
    path.join(projectRoot, "spec", "live-app-capture-allowlist.json"),
    JSON.stringify({ version: 1, allowedBundleIds: ["com.apple.TextEdit"] }),
  );
  await writeFile(path.join(projectRoot, "directors", "director.applescript"), "return");
  await symlink(externalRoot, path.join(projectRoot, "assets", "captures"));

  await assert.rejects(
    validateLiveAppCapture({
      version: 1,
      id: "output-symlink-escape",
      platform: "macos",
      app: { bundleId: "com.apple.TextEdit" },
      director: "directors/director.applescript",
      output: "assets/captures/output.mp4",
      durationMs: 1000,
      setup: [],
      actions: [],
      teardown: [],
    }, { projectRoot }),
    /output path must not contain symbolic links/,
  );
});

test("the validator has no AppleScript execution integration", async () => {
  const source = await readFile(path.join(PROJECT_ROOT, "src", "live-app-capture.mjs"), "utf8");

  assert.doesNotMatch(source, /node:child_process/);
  assert.doesNotMatch(source, /\bspawn\b/);
  assert.doesNotMatch(source, /\bexec(File)?\b/);
  assert.doesNotMatch(source, /\bosascript\b/);
});

async function loadExample(name) {
  return loadLiveAppCapture(path.join(EXAMPLES_ROOT, name));
}

async function loadInvalidExample(name) {
  return loadLiveAppCapture(path.join(EXAMPLES_ROOT, "invalid", name));
}
