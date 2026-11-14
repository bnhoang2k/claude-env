#!/usr/bin/env node
// One entry point for the capture tools: checks what a tool needs, then runs it.
// usage: node run.mjs <capture|frames|sheet|compare|easing|gl> [tool args]   (each tool prints its own help with --help)
// A missing need prints one `needs <what>: <how>` line and exits 3, never a stack trace.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Which npm packages each tool imports. Keep in step with the imports at the top of each .ts file.
const TOOLS = {
  capture: ["playwright", "pngjs"],
  frames: [],
  sheet: [],
  compare: ["pixelmatch", "pngjs"],
  easing: [],
  gl: [],
};
const FFMPEG = new Set(["capture", "frames", "sheet", "compare"]);

const tool = process.argv[2];
if (!Object.hasOwn(TOOLS, tool)) {
  console.error(`usage: node run.mjs <${Object.keys(TOOLS).join("|")}> [args]   (add --help for a tool's options)`);
  process.exit(2);
}
const needs = [];
// Node strips TypeScript types by default from 22.18 and 23.6; the tools are .ts files with no build step.
if (!process.features?.typescript) {
  needs.push(`needs Node 22.18 or later: this is ${process.versions.node}; install a newer one from https://nodejs.org/ or with your version manager`);
}
// The packages are imported at the top of each tool, so even its --help needs them.
const missing = TOOLS[tool].filter((p) => !existsSync(path.join(HERE, "node_modules", p)));
if (missing.length) needs.push(`needs capture tool packages (${missing.join(", ")}): run npm install in ${HERE}, then npx playwright install chromium there`);
const help = process.argv.includes("--help") || process.argv.length === 3;
if (!help) {
  if (FFMPEG.has(tool) && spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status !== 0 &&
      !existsSync(path.join(HERE, "node_modules", "ffmpeg-static", "ffmpeg"))) {
    needs.push("needs ffmpeg: install FFmpeg from https://ffmpeg.org/download.html (on a Mac with Homebrew: brew install ffmpeg)");
  }
}
if (needs.length) { console.log(needs.join("\n")); process.exit(3); }

// The tools read process.argv.slice(2) as their own arguments, so drop the tool name.
process.argv.splice(2, 1);
const entry = pathToFileURL(path.join(HERE, `${tool}.ts`)).href;
// gl.ts is also imported by capture.ts, so it runs its command line only when it is the entry.
globalThis.__captureEntry = entry;
// A tool's own error (bad flag, missing element, unreadable file) prints one line, not a stack trace.
// CAPTURE_DEBUG=1 shows the stack.
const fail = (e) => {
  if (process.env.CAPTURE_DEBUG) console.error(e);
  else console.error(`${tool}: ${String(e?.message || e).split("\n")[0]}  (CAPTURE_DEBUG=1 for the stack)`);
  process.exit(1);
};
process.on("unhandledRejection", fail);
try { await import(entry); } catch (e) { fail(e); }
