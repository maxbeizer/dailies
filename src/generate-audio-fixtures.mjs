import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readScenarioWithAudioCues, writeCueFixtureSidecars } from "./audio-cues.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SPEECHIFY_COMMAND = "speechify";
const DEFAULT_KOKORO_COMMAND = path.resolve(PROJECT_ROOT, "../tri-state-relay-service/scripts/kokoro-voice-command");
const AUDIO_PROVIDERS = new Set(["say", "speechify", "kokoro"]);

async function generateAudioFixtures(source, options) {
  const { cues } = await readScenarioWithAudioCues(source);
  if (cues.length === 0) {
    throw new Error("scenario declares no audio cues");
  }
  const provider = resolveAudioProvider(cues, options.provider);

  const generated = [];
  for (const cue of cues) {
    if (cue.speed !== undefined && provider !== "kokoro") {
      throw new Error(`audio cue speed requires the kokoro provider: ${cue.output || cue.line || "unknown cue"}`);
    }
    await mkdir(path.dirname(cue.outputPath), { recursive: true });
    const temporaryOutputPath = tempOutputPath(cue.outputPath);
    const textPath = `${temporaryOutputPath}.txt`;
    const temporaryCue = { ...cue, outputPath: temporaryOutputPath };
    await writeFile(textPath, cue.text || "", "utf8");
    try {
      if (provider === "speechify") {
        await generateWithSpeechify(temporaryCue, textPath, options);
      } else if (provider === "kokoro") {
        await generateWithKokoro(temporaryCue, textPath, options);
      } else if (provider === "say") {
        await generateWithSay(temporaryCue, textPath);
      } else {
        throw new Error(`unsupported audio provider: ${provider}`);
      }
      await rename(temporaryOutputPath, cue.outputPath);
      await writeCueFixtureSidecars(cue, provider);
    } finally {
      await rm(textPath, { force: true });
      await rm(temporaryOutputPath, { force: true });
    }
    generated.push(path.relative(PROJECT_ROOT, cue.outputPath));
  }

  return generated;
}

export function resolveAudioProvider(cues, requestedProvider) {
  const declaredProviders = [...new Set(cues.map((cue) => cue.provider).filter(Boolean))];
  if (declaredProviders.length > 1) {
    throw new Error("a scenario must use one declared audio provider");
  }
  const declaredProvider = declaredProviders[0] || null;
  if (requestedProvider && declaredProvider && requestedProvider !== declaredProvider) {
    throw new Error(`scenario requires the ${declaredProvider} audio provider`);
  }
  const provider = requestedProvider || declaredProvider || "say";
  if (!AUDIO_PROVIDERS.has(provider)) {
    throw new Error("audio provider must be say, speechify, or kokoro");
  }
  return provider;
}

function tempOutputPath(outputPath) {
  const extension = path.extname(outputPath);
  const stem = extension ? outputPath.slice(0, -extension.length) : outputPath;
  return `${stem}.tmp-${process.pid}${extension}`;
}

async function generateWithSay(cue, textPath) {
  const tempAiff = `${cue.outputPath}.aiff`;
  const sayArgs = ["-f", textPath, "-o", tempAiff];
  if (cue.sayVoice) {
    sayArgs.unshift("-v", cue.sayVoice);
  }

  try {
    await run("/usr/bin/say", sayArgs);
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

async function generateWithKokoro(cue, textPath, options) {
  const voiceId = cue.voice || "af_heart";
  const outputExtension = path.extname(cue.outputPath).toLowerCase();
  const synthesisPath = outputExtension === ".wav" ? cue.outputPath : `${cue.outputPath}.kokoro.wav`;
  const args = [
    "--text-file",
    textPath,
    "--output-file",
    synthesisPath,
    "--voice-id",
    voiceId,
  ];
  if (cue.speed !== undefined) {
    const speed = Number(cue.speed);
    if (!Number.isFinite(speed) || speed <= 0) {
      throw new Error(`audio cue speed must be a positive number: ${cue.output || cue.line || "unknown cue"}`);
    }
    args.push("--speed", String(speed));
  }

  try {
    await run(options.kokoroCommand, args);
    if (synthesisPath !== cue.outputPath) {
      await run("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        synthesisPath,
        cue.outputPath,
      ]);
    }
  } finally {
    if (synthesisPath !== cue.outputPath) {
      await rm(synthesisPath, { force: true });
    }
  }
}

export function parseArgs(argv) {
  const args = {
    provider: null,
    keychainService: "TSRS_SPEECHIFY_API_KEY",
    speechifyCommand: process.env.TSRS_SPEECHIFY_HELPER || DEFAULT_SPEECHIFY_COMMAND,
    kokoroCommand: process.env.TSRS_KOKORO_HELPER || DEFAULT_KOKORO_COMMAND,
  };
  const positional = [];

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--provider") {
      const provider = argv[index + 1];
      if (!provider || provider.startsWith("--")) {
        throw new Error("--provider requires say, speechify, or kokoro");
      }
      args.provider = provider;
      index += 1;
    } else if (value === "--keychain-service") {
      args.keychainService = argv[++index];
    } else if (value === "--speechify-command") {
      args.speechifyCommand = argv[++index];
    } else if (value === "--kokoro-command") {
      args.kokoroCommand = argv[++index];
    } else {
      positional.push(value);
    }
  }

  if (args.provider && !AUDIO_PROVIDERS.has(args.provider)) {
    throw new Error("--provider must be say, speechify, or kokoro");
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
      console.error("Usage: node src/generate-audio-fixtures.mjs <demo.md> [--provider say|speechify|kokoro]");
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
