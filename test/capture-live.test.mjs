import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  captureFrameCount,
  captureFramePath,
  parseCaptureLiveArgs,
  prepareArtifactDirectory,
  screencaptureArguments,
  validateCapturedVideo,
} from "../src/capture-live.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("live capture requires an explicit approval flag", () => {
  assert.throws(
    () => parseCaptureLiveArgs(["examples/live-app-capture/textedit-story.capture.json"]),
    /requires --approve/,
  );
  assert.deepEqual(
    parseCaptureLiveArgs(["examples/live-app-capture/textedit-story.capture.json", "--approve"]),
    {
      source: "examples/live-app-capture/textedit-story.capture.json",
      approved: true,
    },
  );
});

test("the TextEdit example keeps local handlers outside the app tell target", async () => {
  const source = await readFile(
    path.join(PROJECT_ROOT, "examples", "live-app-capture", "textedit-director.applescript"),
    "utf8",
  );

  assert.doesNotMatch(source, /return & captureMarker\(/);
  assert.match(source, /captureDocumentName\(runToken\)/);
  assert.match(source, /set name of front window to "Dailies Live Capture"/);
  assert.doesNotMatch(source, /dailies-live-capture:/);
  assert.doesNotMatch(source, /resetStaleCaptures/);
  assert.match(source, /count of documents\) is 0 and \(count of windows\) > 0/);
});

test("encoded capture metadata must match the declared take", () => {
  assert.doesNotThrow(() => validateCapturedVideo({
    width: 1600,
    height: 1100,
    frameCount: 70,
    durationMs: 7000,
  }, {
    frameCount: 70,
    durationMs: 7000,
    width: 1600,
    height: 1100,
  }));
  assert.throws(() => validateCapturedVideo({
    width: 1600,
    height: 1100,
    frameCount: 69,
    durationMs: 7000,
  }, {
    frameCount: 70,
    durationMs: 7000,
    width: 1600,
    height: 1100,
  }), /frame count/);
  assert.throws(() => validateCapturedVideo({
    width: 800,
    height: 1100,
    frameCount: 70,
    durationMs: 7000,
  }, {
    frameCount: 70,
    durationMs: 7000,
    width: 1600,
    height: 1100,
  }), /dimensions/);
});

test("live capture rejects unknown or missing arguments", () => {
  assert.throws(() => parseCaptureLiveArgs([]), /capture declaration is required/);
  assert.throws(
    () => parseCaptureLiveArgs(["capture.json", "--approve", "--surprise"]),
    /unexpected argument/,
  );
});

test("frame-stepped capture targets only the declared rectangle", () => {
  const region = { x: 120, y: 120, width: 800, height: 550 };

  assert.deepEqual(screencaptureArguments(region, "/tmp/frame-00001.png"), [
    "-x",
    "-R120,120,800,550",
    "/tmp/frame-00001.png",
  ]);
  assert.equal(captureFrameCount(7000, 10), 70);
  assert.equal(captureFramePath("/tmp/frames", 0), "/tmp/frames/frame-00001.png");
  assert.equal(captureFramePath("/tmp/frames", 69), "/tmp/frames/frame-00070.png");
});

test("artifact cleanup rejects symlinked path components", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "dailies-capture-"));
  const projectRoot = path.join(temporaryRoot, "project");
  const outsideRoot = path.join(temporaryRoot, "outside");
  await Promise.all([mkdir(projectRoot), mkdir(outsideRoot)]);
  await symlink(outsideRoot, path.join(projectRoot, "artifacts"));

  try {
    await assert.rejects(
      prepareArtifactDirectory(
        path.join(projectRoot, "artifacts", "live-capture", "example"),
        projectRoot,
      ),
      /must not contain symbolic links/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
