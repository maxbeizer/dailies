import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { cleanArtifacts } from "../src/clean-artifacts.mjs";

test("cleanup removes generated artifacts and restores the tracked placeholder", async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "dailies-clean-"));
  try {
    await mkdir(path.join(projectRoot, "artifacts", "nested"), { recursive: true });
    await writeFile(path.join(projectRoot, "artifacts", "nested", "candidate.mp4"), "generated");

    await cleanArtifacts(projectRoot);

    await access(path.join(projectRoot, "artifacts", ".gitkeep"));
    await assert.rejects(() => readFile(path.join(projectRoot, "artifacts", "nested", "candidate.mp4")));
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
