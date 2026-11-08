// Scans one bar folder before it is committed, with the guards that will judge it later: the kit's
// own leak check (scripts/check-public.mjs: names, home paths, links, keys and emails) on every
// file and its process words on the public files only (study.md and bar.private.json stay private),
// when the kit has one, and the publish tool's deny list on every file.
// usage: node leak-scan.mjs <bar dir>     exit 0 clean, 1 hits, 2 a missing kit or tool
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findPublishScripts, hasPublishScripts, kitImport, requireKit } from "./kit.mjs";
const dir = process.argv[2];
if (!dir) { console.error("usage: node leak-scan.mjs <bar dir>"); process.exit(2); }
const KIT = requireKit();
// The public kit has no check-public.mjs. Without it that pass is skipped, and the deny list below still runs.
let scanText = () => [];
let PROCESS_WORDS = null;
if (existsSync(path.join(KIT, "scripts/check-public.mjs"))) {
  ({ scanText, PROCESS_WORDS } = await kitImport("scripts/check-public.mjs"));
} else {
  console.log("leak-scan: this kit has no scripts/check-public.mjs, so its own leak check is skipped; the publish deny list still runs.");
}
// The publish tool's scripts (deny.mjs, export.mjs) are in the workflow plugin, a sibling of this one.
// kit.mjs finds them from PUBLISH_PUBLIC_SCRIPTS, else the claude-env checkout layout, else the plugin cache
// layout. With none, stop: a scan without the deny list would pass files the publish guard rejects.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const scriptsDir = findPublishScripts(HERE, process.env);
if (!scriptsDir || !hasPublishScripts(scriptsDir)) {
  console.error(`leak-scan: cannot find the publish tool's deny.mjs and export.mjs${scriptsDir ? ` in ${scriptsDir}` : ""}. Set PUBLISH_PUBLIC_SCRIPTS to the workflow plugin's skills/publish-public/scripts folder (find it with: ls -d ~/.claude/plugins/cache/*/workflow/*/skills/publish-public/scripts).`);
  process.exit(2);
}
const deny = await import(pathToFileURL(path.join(scriptsDir, "deny.mjs")).href);
let rules;
// The kit's own deny sets (publish.json "deny"), from the user's publish-public config folder.
// A config problem is an error: say what is wrong and stop.
try {
  const { readDenySets } = await import(pathToFileURL(path.join(scriptsDir, "export.mjs")).href);
  rules = deny.loadRules(readDenySets(KIT));
} catch (e) {
  console.error(`leak-scan: ${String(e.message).split("\n")[0]}`);
  process.exit(1);
}
const PRIVATE = new Set(["study.md", "bar.private.json"]);
const TEXT = /\.(html|md|json|ts|mjs|js|css|txt|svg)$/;
const walk = (d) => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
let hits = 0;
const hit = (f, line, rule, text) => { hits++; console.log(`${path.relative(KIT, f)}:${line}: ${rule}: ${String(text).trim().slice(0, 160)}`); };
for (const f of walk(dir).filter((p) => TEXT.test(p))) {
  const text = readFileSync(f, "utf8");
  for (const h of scanText(text)) hit(f, h.line, h.rule, h.text);
  for (const h of deny.scanText(text, rules)) hit(f, h.line, `deny ${h.rule}`, h.text);
  if (PROCESS_WORDS && !PRIVATE.has(path.basename(f))) text.split("\n").forEach((t, i) => { if (PROCESS_WORDS.test(t)) hit(f, i + 1, "process word", t); });
}
console.log(`hits: ${hits}`);
process.exit(hits ? 1 : 0);
