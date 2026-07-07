import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function parseDemoMarkdown(sourcePath, markdown) {
  const { frontmatter, body } = extractFrontmatter(markdown);
  const blocks = extractFencedBlocks(body);
  const headings = body
    .split(/\r?\n/)
    .filter((line) => /^#{1,6}\s+/.test(line))
    .map((line) => {
      const [, hashes, text] = /^(#{1,6})\s+(.*)$/.exec(line);
      return { level: hashes.length, text: text.trim() };
    });

  return {
    sourcePath,
    frontmatter,
    headings,
    blocks,
  };
}

export function extractFrontmatter(markdown) {
  if (!markdown.startsWith("---\n")) {
    return { frontmatter: {}, body: markdown };
  }

  const end = markdown.indexOf("\n---\n", 4);
  if (end === -1) {
    return { frontmatter: {}, body: markdown };
  }

  const raw = markdown.slice(4, end);
  return {
    frontmatter: parseKeyValueBlock(raw),
    body: markdown.slice(end + 5),
  };
}

export function extractFencedBlocks(markdown) {
  const blocks = [];
  const fencePattern = /^```([^\n]*)\n([\s\S]*?)^```$/gm;
  let match;

  while ((match = fencePattern.exec(markdown)) !== null) {
    const info = match[1].trim();
    const content = trimTrailingNewline(match[2]);
    const type = normalizeFenceType(info);
    blocks.push({
      type,
      info,
      content,
      data: parseBlockData(type, content),
      startOffset: match.index,
      endOffset: fencePattern.lastIndex,
    });
  }

  return blocks;
}

export function parseKeyValueBlock(raw) {
  const data = {};

  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    data[key] = parseScalar(value);
  }

  return data;
}

function normalizeFenceType(info) {
  const first = info.split(/\s+/)[0] || "";
  if (first.startsWith("dailies:")) return first.slice("dailies:".length);
  return first || "text";
}

function parseBlockData(type, content) {
  if (type === "audio-cue") return parseKeyValueBlock(content);
  if (type === "self-review") return parseJsonBlock(content);
  return null;
}

function parseJsonBlock(content) {
  try {
    return JSON.parse(content);
  } catch (error) {
    return { parseError: error.message };
  }
}

function parseScalar(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function trimTrailingNewline(value) {
  return value.replace(/\r?\n$/, "");
}

async function main(argv) {
  const source = argv[2];
  if (!source) {
    console.error("Usage: node src/parse-demo.mjs <demo.md>");
    return 2;
  }

  const sourcePath = path.resolve(source);
  const markdown = await readFile(sourcePath, "utf8");
  const parsed = parseDemoMarkdown(sourcePath, markdown);
  console.log(JSON.stringify(parsed, null, 2));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv).then((code) => {
    process.exitCode = code;
  });
}
