// Where the kit checkout is: $MOTION_KIT, else the folder named motion-kit under $PROJECTS_ROOT. Every intake script
// imports the kit's own gate code from there, so a trace or a fault is judged by the code that ships.
// No home-folder fallback: a guessed path would judge a trace by the wrong checkout.
// Nothing here throws at import time: a script that needs the kit calls requireKit() when it starts.
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const KIT_URL = "https://github.com/bnhoang2k/motion-kit";
export const KIT_LINE = `intake needs a motion-kit checkout: clone ${KIT_URL} and set MOTION_KIT to it`;

// -> the kit folder named by the environment, or null when nothing names one. Never throws.
export function kitPath(env = process.env) {
  if (env.MOTION_KIT) return env.MOTION_KIT;
  if (env.PROJECTS_ROOT) return path.join(env.PROJECTS_ROOT, "motion-kit");
  return null;
}

// -> the kit folder, or one stderr line and exit 2 (no stack) when there is none or it is not a folder.
export function requireKit(env = process.env) {
  const kit = kitPath(env);
  if (!kit) fail(KIT_LINE);
  if (!isDir(kit)) fail(`${KIT_LINE} (no folder at ${kit})`);
  return kit;
}

function fail(line) {
  console.error(line);
  process.exit(2);
}

const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };

export const kitImport = (rel, env = process.env) => import(pathToFileURL(path.join(requireKit(env), rel)).href);

// The publish tool's scripts (deny.mjs, export.mjs) are in the workflow plugin, a sibling of the motion plugin.
// A plugin cannot assume where a sibling is installed, so the folder comes from, in order:
//   1. PUBLISH_PUBLIC_SCRIPTS (the workflow plugin's skills/publish-public/scripts);
//   2. the claude-env checkout layout: plugins/motion/... beside plugins/workflow/...;
//   3. the plugin cache layout: <cache>/<marketplace>/motion/<version>/... beside <cache>/<marketplace>/workflow/<version>/...,
//      taking the newest version (numeric major.minor.patch, so 0.10.0 beats 0.9.0) that holds both scripts.
// `here` is the folder of the script that asks (scripts/intake). -> a folder, or null when none is found.
export function findPublishScripts(here, env = process.env) {
  if (env.PUBLISH_PUBLIC_SCRIPTS) return env.PUBLISH_PUBLIC_SCRIPTS;
  const checkout = path.resolve(here, "../../../../../workflow/skills/publish-public/scripts");
  if (hasPublishScripts(checkout)) return checkout;
  for (let dir = path.resolve(here); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const workflow = path.join(path.dirname(path.dirname(dir)), "workflow");
    if (!isDir(workflow)) continue;
    for (const v of versionsNewestFirst(workflow)) {
      const scripts = path.join(workflow, v, "skills", "publish-public", "scripts");
      if (hasPublishScripts(scripts)) return scripts;
    }
  }
  return null;
}

export const hasPublishScripts = (dir) => existsSync(path.join(dir, "deny.mjs")) && existsSync(path.join(dir, "export.mjs"));

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;
function versionsNewestFirst(dir) {
  let names;
  try { names = readdirSync(dir); } catch { return []; }
  return names
    .map((n) => ({ n, m: SEMVER.exec(n) }))
    .filter((x) => x.m)
    .sort((a, b) => b.m[1] - a.m[1] || b.m[2] - a.m[2] || b.m[3] - a.m[3] || (a.n < b.n ? 1 : -1))
    .map((x) => x.n);
}
