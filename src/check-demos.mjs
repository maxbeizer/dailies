import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateDemo } from "./evaluate-demo.mjs";
import { renderPreview } from "./render-preview.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function checkDemos() {
  const demos = await findDemoFiles(path.join(PROJECT_ROOT, "demos"));
  if (demos.length === 0) {
    throw new Error("no demo scenarios found under demos/");
  }

  const failures = [];
  for (const demo of demos) {
    await renderPreview(demo);
    const { report, reportPath } = await evaluateDemo(demo);
    const relativeDemo = path.relative(PROJECT_ROOT, demo);
    const relativeReport = path.relative(PROJECT_ROOT, reportPath);
    console.log(`${report.status} ${relativeDemo} -> ${relativeReport}`);
    if (report.status !== "pass") failures.push(relativeDemo);
  }

  if (failures.length > 0) {
    throw new Error(`demo checks failed: ${failures.join(", ")}`);
  }
}

async function findDemoFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findDemoFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".demo.md")) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkDemos().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
