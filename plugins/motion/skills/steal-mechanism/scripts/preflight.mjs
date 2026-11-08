// Checks that the tools a steal-mechanism mode needs are installed, before a run spends any agents.
// usage: node preflight.mjs <study|fix|intake>
// Prints one stdout line per need: `ok <tool>` or `needs <exact tool name>: <where to get it>`.
// Exit 0 when every need is found, 3 when any is missing, 2 for a bad argument. Never prints a stack trace.
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KIT_URL, findPublishScripts, hasPublishScripts, kitPath } from "./intake/kit.mjs";

const MODES = ["study", "fix", "intake"];
const mode = process.argv[2];
if (!MODES.includes(mode)) {
  console.error(`usage: node preflight.mjs <${MODES.join("|")}>`);
  process.exit(2);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const lines = [];
let missing = 0;
const ok = (what) => lines.push(`ok ${what}`);
const need = (name, where) => { missing++; lines.push(`needs ${name}: ${where}`); };
const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };

// The kit's engines.node range, or null when package.json is missing, unreadable or names none.
function enginesNode(kit) {
  try {
    const r = JSON.parse(readFileSync(path.join(kit, "package.json"), "utf8"))?.engines?.node;
    return typeof r === "string" && r.trim() ? r.trim() : null;
  } catch { return null; }
}

// Whether `version` (x.y.z) satisfies a simple semver range: sets joined by ||, comparators joined by spaces.
// Handles >=, >, <=, <, =, ^, ~, x-ranges and bare versions. A range it cannot read counts as satisfied: the kit's own
// commands will then report the real problem, and preflight never blocks on its own parsing gap.
function satisfies(version, range) {
  const parse = (s) => {
    const m = /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?/.exec(s);
    if (!m) return null;
    return m.slice(1, 4).map((p) => (p === undefined || /[xX*]/.test(p) ? null : Number(p)));
  };
  const cmp = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; };
  const v = parse(version).map((n) => n ?? 0);
  const fill = (p) => p.map((n) => n ?? 0);
  const ok1 = (c) => {
    const m = /^(>=|<=|>|<|=|\^|~)?\s*(\S+)$/.exec(c);
    const p = m && parse(m[2]);
    if (!p) return null;
    const op = m[1] || "=";
    const lo = fill(p);
    if (op === ">=") return cmp(v, lo) >= 0;
    if (op === ">") return p[2] === null && p[1] === null ? v[0] > p[0] : cmp(v, lo) > 0;
    if (op === "<=") return cmp(v, lo) <= 0;
    if (op === "<") return cmp(v, lo) < 0;
    if (op === "^") {
      const hi = p[0] > 0 ? [p[0] + 1, 0, 0] : p[1] > 0 ? [0, p[1] + 1, 0] : [0, 0, (p[2] ?? 0) + 1];
      return cmp(v, lo) >= 0 && cmp(v, hi) < 0;
    }
    if (op === "~") return cmp(v, lo) >= 0 && cmp(v, p[1] === null ? [p[0] + 1, 0, 0] : [p[0], p[1] + 1, 0]) < 0;
    return p.every((n, i) => n === null || n === v[i]);
  };
  for (const set of range.split("||")) {
    const results = set.trim().split(/\s+/).filter(Boolean).map(ok1);
    if (results.includes(null)) return true;
    if (results.every(Boolean)) return true;
  }
  return false;
}

// ffmpeg: frame extraction and the side-by-side video.
const ff = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
if (!ff.error && ff.status === 0) ok("ffmpeg");
else need("ffmpeg", "install FFmpeg from https://ffmpeg.org/download.html (on a Mac with Homebrew: brew install ffmpeg)");

// A headless-Chrome library the agents can drive, found the way a script in the current folder would find it.
const lib = ["playwright", "puppeteer"].find((name) =>
  spawnSync(process.execPath, ["-e", `import(${JSON.stringify(name)}).then(() => {}, () => process.exit(1))`], { stdio: "ignore" }).status === 0);
if (lib) ok(lib);
else need("Playwright or Puppeteer", "in your project folder run: npm install playwright, then npx playwright install chromium (or npm install puppeteer)");

if (mode === "intake") {
  // The kit: a clone or fork of the public motion-kit.
  const kit = kitPath(process.env);
  if (kit && isDir(kit)) ok(`motion-kit ${kit}`);
  else need("motion-kit checkout", `clone ${KIT_URL} and set MOTION_KIT to it${kit ? ` (no folder at ${kit})` : ""}`);

  // The workflow plugin's publish scripts, for the leak scan.
  const scripts = findPublishScripts(path.join(HERE, "intake"), process.env);
  if (scripts && hasPublishScripts(scripts)) ok(`publish-public scripts ${scripts}`);
  else need("publish-public scripts", "install the workflow plugin, then set PUBLISH_PUBLIC_SCRIPTS to its skills/publish-public/scripts folder (find it with: ls -d ~/.claude/plugins/cache/*/workflow/*/skills/publish-public/scripts)");

  // The kit's commands run with pnpm and plain node, so a fresh clone needs pnpm, its dependencies, and a Node version in its range.
  const pn = spawnSync("pnpm", ["--version"], { stdio: "ignore" });
  if (!pn.error && pn.status === 0) ok("pnpm");
  else need("pnpm", "install it from https://pnpm.io/installation");

  if (kit && isDir(kit)) {
    if (isDir(path.join(kit, "node_modules"))) ok(`motion-kit dependencies ${path.join(kit, "node_modules")}`);
    else need(`pnpm install in ${kit}`, "run pnpm install there");
    const range = enginesNode(kit);
    if (!range) ok(`node ${process.versions.node} (the kit names no Node range)`);
    else if (satisfies(process.versions.node, range)) ok(`node ${process.versions.node} (kit needs ${range})`);
    else need(`Node ${range}`, `install a matching version from https://nodejs.org/ (this is ${process.versions.node})`);
  }
}

console.log(lines.join("\n"));
process.exit(missing ? 3 : 0);
