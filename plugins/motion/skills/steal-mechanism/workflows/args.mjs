// Resolves the launch arguments of workflows/run.js. The Workflow tool's script runtime has no
// filesystem, no process.env and no known import support, so this file runs first, in Node, and the
// launcher passes its output to the workflow as `args`:
//   node "${CLAUDE_PLUGIN_ROOT}/skills/steal-mechanism/workflows/args.mjs" '<json: mode, slugs, ...>'
// The command line fills `root` from this file's own location and reads HOME, STEAL_BAR_HOME,
// MOTION_KIT (else PROJECTS_ROOT/motion-kit), STEAL_TOOLS and the current folder from the real environment.
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { KIT_LINE, kitPath } from "../scripts/intake/kit.mjs";

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
  // Intake finds the kit as the intake scripts do (kitPath: MOTION_KIT, else $PROJECTS_ROOT/motion-kit). Study and fix
  // never guess a kit: they take one only when it is named.
  const kitRaw = mode === "intake" ? kitPath(a.kit ? { ...env, MOTION_KIT: a.kit } : env) || "" : a.kit || env.MOTION_KIT || "";
  if (mode === "intake" && !kitRaw) throw new Error(KIT_LINE);
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
// `spec` is the intake procedure (args.spec, else $MOTION_KIT_SPEC, else the intake.md that ships beside SKILL.md);
// in intake mode `kitBars`, `kitDoc`, `kitDialSet` and `kitStripsPrivate` say which kit files exist; `capturesLink` (args.capturesLink, else
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
    spec: a.spec || env.MOTION_KIT_SPEC || resolved.root + "/intake.md",
    ...(resolved.mode === "intake" ? kitFacts(resolved.kit) : {}),
  };
}

// Which of the files run.js points agents at the kit has (run.js has no filesystem). The public kit has bars 04, 13
// and 31, an AGENTS.md where an older kit has a CLAUDE.md, and no kinds/*/dial-set.json. Throws the one-line kit
// message when the folder is missing.
export function kitFacts(kit) {
  const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };
  if (!isDir(kit)) throw new Error(`${KIT_LINE} (no folder at ${kit})`);
  const names = (d) => (isDir(d) ? readdirSync(d).sort() : []);
  return {
    kitBars: names(kit + "/bars").filter((n) => isDir(kit + "/bars/" + n)),
    kitDoc: ["CLAUDE.md", "AGENTS.md"].find((n) => existsSync(kit + "/" + n)) || null,
    kitDialSet: names(kit + "/kinds").some((k) => existsSync(kit + "/kinds/" + k + "/dial-set.json")),
    // A kit with scripts/check-public.mjs is a private dev kit that strips study.md and bar.private.json at publish.
    // Any other kit is a public clone or fork: those two files stay untracked there.
    kitStripsPrivate: existsSync(kit + "/scripts/check-public.mjs"),
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
