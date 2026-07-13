import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function cleanArtifacts(projectRoot = PROJECT_ROOT) {
  const artifactsPath = path.join(path.resolve(projectRoot), "artifacts");
  if (path.basename(artifactsPath) !== "artifacts" || path.dirname(artifactsPath) !== path.resolve(projectRoot)) {
    throw new Error("cleanup target must be the repository artifacts/ directory");
  }
  await rm(artifactsPath, { recursive: true, force: true });
  await mkdir(artifactsPath, { recursive: true });
  await writeFile(path.join(artifactsPath, ".gitkeep"), "");
  return artifactsPath;
}

async function main() {
  const artifactsPath = await cleanArtifacts();
  console.log(`cleaned ${path.relative(PROJECT_ROOT, artifactsPath)}/`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
