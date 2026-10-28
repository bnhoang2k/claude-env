// Checks the tools an anatomy-reveal build needs, before any time is spent on a render.
// usage: node preflight.mjs
// Prints one stdout line per need: `ok <tool>` or `needs <exact tool name>: <where to get it>`.
// Exit 0 when every need is found, 3 when any is missing. Never prints a stack trace.
// It imports only node: modules and chrome-path.mjs, so it runs before `npm install`.
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { chromePath } from "./chrome-path.mjs";

const lines = [];
let missing = 0;
const ok = (what) => lines.push(`ok ${what}`);
const need = (name, where) => { missing++; lines.push(`needs ${name}: ${where}`); };

// Runs `cmd args` and returns its stdout, or null when the command is missing or fails.
function out(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 30000, windowsHide: true, shell: process.platform === "win32" });
  return r.error || r.status !== 0 ? null : r.stdout;
}

// Node 20 or newer: the skill's own compatibility line.
const major = Number(process.versions.node.split(".")[0]);
if (major >= 20) ok(`node ${process.versions.node}`);
else need("Node 20 or newer", `install it from https://nodejs.org/ (this is ${process.versions.node})`);

// npm installs puppeteer-core into each new project.
const npm = out("npm", ["--version"]);
if (npm !== null) ok(`npm ${npm.trim()}`);
else need("npm", "npm comes with Node; install Node from https://nodejs.org/");

// A browser to drive. CHROME_PATH wins; chromePath() throws when nothing is found.
const WHERE_BROWSER = "install Google Chrome from https://www.google.com/chrome/, or set CHROME_PATH to the browser executable";
const isFile = (p) => existsSync(p) && statSync(p).isFile();
let browser = null;
try { browser = chromePath(); } catch { /* none found: reported below */ }
if (browser && isFile(browser)) ok(`browser ${browser}`);
else if (browser) need("Google Chrome, Chromium or Edge", `CHROME_PATH is set to ${browser}, which is not a file; fix it or unset it`);
else need("Google Chrome, Chromium or Edge", WHERE_BROWSER);

// ffmpeg encodes the film. FFMPEG overrides the command, as in motion/encode.mjs.
const ffmpegCmd = process.env.FFMPEG || "ffmpeg";
if (out(ffmpegCmd, ["-version"]) !== null) ok(`ffmpeg ${ffmpegCmd}`);
else need("ffmpeg", "install FFmpeg from https://ffmpeg.org/download.html (on a Mac with Homebrew: brew install ffmpeg), or set FFMPEG to its path");

// ImageMagick 7 averages the motion-blur frames. Version 6 has no `magick` command.
const magickCmd = process.env.MAGICK || "magick";
const magick = out(magickCmd, ["-version"]);
const version = magick && /ImageMagick\s+(\d+)\.\S+/.exec(magick);
if (version && Number(version[1]) >= 7) ok(`ImageMagick ${version[0].split(/\s+/)[1]} (${magickCmd})`);
else if (version) need("ImageMagick 7, the `magick` command", `this is ImageMagick ${version[1]}; install version 7 from https://imagemagick.org/script/download.php (on a Mac with Homebrew: brew install imagemagick)`);
else need("ImageMagick 7, the `magick` command", "install it from https://imagemagick.org/script/download.php (on a Mac with Homebrew: brew install imagemagick), or set MAGICK to its path");

console.log(lines.join("\n"));
process.exit(missing ? 3 : 0);
