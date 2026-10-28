// Resolves the launch arguments of workflows/run.js. The Workflow tool's script runtime has no
// filesystem, no process.env and no known import support, so this file runs first, in Node, and the
// launcher passes its output to the workflow as `args`:
//   node "${CLAUDE_PLUGIN_ROOT}/skills/steal-mechanism/workflows/args.mjs" '<json: mode, slugs, ...>'
// The command line fills `root` from this file's own location and reads HOME, STEAL_BAR_HOME,
// MOTION_KIT, STEAL_TOOLS and the current folder from the real environment.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const strip = (p) => p.replace(/\/+$/, "");
const MODES = ["study", "fix", "intake"];

// -> { mode, barHome, kit|null, root, captures }
// captures: args.captures, else $STEAL_CAPTURES, else ~/.claude/taste/captures (null when HOME is unset;
// launchArgs then fails).
export function resolveArgs(args, env = {}, cwd = "") {
  const a = args || {};
  const mode = a.mode || "study";
  if (!MODES.includes(mode)) throw new Error(`args.mode must be "study", "fix" or "intake", got "${mode}"`);
  if (typeof a.root !== "string" || !a.root) {
    throw new Error("args.root is required: the steal-mechanism skill folder, ${CLAUDE_PLUGIN_ROOT}/skills/steal-mechanism");
  }
  let barHome = a.barHome || env.STEAL_BAR_HOME || "";
  if (!barHome) {
    if (!cwd) throw new Error("no bar home: set args.barHome or STEAL_BAR_HOME, or pass the current folder as cwd");
    barHome = strip(cwd) + "/.steal-mechanism/bars";
  }
  const kitRaw = a.kit || env.MOTION_KIT || "";
  if (mode === "intake" && !kitRaw) throw new Error("intake needs a motion-kit checkout: set MOTION_KIT");
  const cap = a.captures || env.STEAL_CAPTURES || (env.HOME ? capturesHome(env) : "");
  return { mode, barHome: strip(barHome), kit: kitRaw ? strip(kitRaw) : null, root: strip(a.root), captures: cap ? strip(cap) : null };
}

// The default home of the original captures of other people's sites: the user's private folder, never a project.
export function capturesHome(env = {}) {
  if (!env.HOME) throw new Error("env.HOME is required to find ~/.claude/taste/captures");
  return strip(env.HOME) + "/.claude/taste/captures";
}

// The default bar home keeps its footage out of version control: <cwd>/.steal-mechanism/.gitignore gets
// the line bars/*/capture/ (created or appended, never duplicated). `args` is the user's own JSON, not the
// resolved args. Returns the file, or null when args.barHome or STEAL_BAR_HOME chose the bar home.
export function ensureBarIgnore(args, env = {}, cwd = "") {
  if ((args && args.barHome) || env.STEAL_BAR_HOME || !cwd) return null;
  const dir = strip(cwd) + "/.steal-mechanism";
  const file = dir + "/.gitignore";
  const line = "bars/*/capture/";
  mkdirSync(dir, { recursive: true });
  const have = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (!have.split("\n").includes(line)) appendFileSync(file, (have && !have.endsWith("\n") ? "\n" : "") + line + "\n");
  return file;
}

// Everything run.js needs, resolved. `tools` is the folder holding capture.mjs and drive.mjs (optional);
// `spec` is the motion-kit intake spec (optional); `capturesLink` (args.capturesLink, else
// $STEAL_CAPTURES_LINK) is how a review page reaches the captures: when set, compare.json's
// original_video is <link>/<slug>/original/<file>, else the absolute path.
export function launchArgs(args, env = {}, cwd = "") {
  const a = args || {};
  const resolved = resolveArgs(a, env, cwd);
  if (!resolved.captures) capturesHome(env); // throws: no captures root and no HOME
  const link = a.capturesLink || env.STEAL_CAPTURES_LINK || "";
  return {
    ...a,
    ...resolved,
    capturesLink: link ? strip(link) : null,
    tools: a.tools || env.STEAL_TOOLS || null,
    spec: a.spec || env.MOTION_KIT_SPEC || null,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const user = process.argv[2] ? JSON.parse(process.argv[2]) : {};
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const out = launchArgs({ root, ...user }, process.env, process.cwd());
    ensureBarIgnore(user, process.env, process.cwd());
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    console.error(`args.mjs: ${e.message}`);
    process.exit(1);
  }
}
