import { mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readScenarioWithAudioCues, writeCueTextFile } from "./audio-cues.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SPEECHIFY_COMMAND = "speechify";

async function generateAudioFixtures(source, options) {
  const { cues } = await readScenarioWithAudioCues(source);
  if (cues.length === 0) {
    throw new Error("scenario declares no audio cues");
  }

  const generated = [];
  for (const cue of cues) {
    await mkdir(path.dirname(cue.outputPath), { recursive: true });
    const textPath = await writeCueTextFile(cue);
    if (options.provider === "speechify") {
      await generateWithSpeechify(cue, textPath, options);
    } else {
      await generateWithSay(cue, textPath);
    }
    generated.push(path.relative(PROJECT_ROOT, cue.outputPath));
  }

  return generated;
}

async function generateWithSay(cue, textPath) {
  const tempAiff = `${cue.outputPath}.aiff`;
  try {
    await run("/usr/bin/say", ["-f", textPath, "-o", tempAiff]);
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      tempAiff,
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "128k",
      cue.outputPath,
    ]);
  } finally {
    await rm(tempAiff, { force: true });
  }
}

async function generateWithSpeechify(cue, textPath, options) {
  await run(options.speechifyCommand, [
    "--text-file",
    textPath,
    "--output-file",
    cue.outputPath,
    "--voice-id",
    cue.voice || "george",
    "--keychain-service",
    options.keychainService || "TSRS_SPEECHIFY_API_KEY",
  ]);
}

function parseArgs(argv) {
  const args = {
    provider: "say",
    keychainService: "TSRS_SPEECHIFY_API_KEY",
    speechifyCommand: process.env.TSRS_SPEECHIFY_HELPER || DEFAULT_SPEECHIFY_COMMAND,
  };
  const positional = [];

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--provider") {
      args.provider = argv[++index];
    } else if (value === "--keychain-service") {
      args.keychainService = argv[++index];
    } else if (value === "--speechify-command") {
      args.speechifyCommand = argv[++index];
    } else {
      positional.push(value);
    }
  }

  if (!["say", "speechify"].includes(args.provider)) {
    throw new Error("--provider must be say or speechify");
  }

  return { source: positional[0], options: args };
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with ${code}`));
      }
    });
  });
}

async function main(argv) {
  try {
    const { source, options } = parseArgs(argv);
    if (!source) {
      console.error("Usage: node src/generate-audio-fixtures.mjs <demo.md> [--provider say|speechify]");
      return 2;
    }
    const generated = await generateAudioFixtures(source, options);
    for (const file of generated) console.log(file);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv).then((code) => {
    process.exitCode = code;
  });
}
