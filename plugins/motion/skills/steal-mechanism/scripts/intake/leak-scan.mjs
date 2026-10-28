// Scans one bar folder before it is committed, with both guards that will judge it later: the kit's
// own leak check (scripts/check-public.mjs: names, home paths, links,
// keys and emails) on every file, its process words on the public files only (study.md and
// bar.private.json stay private), and the publish tool's deny list on every file.
// usage: node leak-scan.mjs <bar dir>     exit 0 clean, 1 hits
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { KIT, kitImport } from "./kit.mjs";
const dir = process.argv[2];
if (!dir) { console.error("usage: node leak-scan.mjs <bar dir>"); process.exit(2); }
const { scanText, PROCESS_WORDS } = await kitImport("scripts/check-public.mjs");
// The publish tool's scripts (deny.mjs, export.mjs) are in the workflow plugin, a sibling of this one.
// A plugin cannot assume where a sibling is installed, so the folder comes from PUBLISH_PUBLIC_SCRIPTS
// (the workflow plugin's skills/publish-public/scripts), or else from the claude-env checkout layout
// (plugins/motion/... beside plugins/workflow/...). With neither, stop: a scan without the deny list
// would pass files the publish guard rejects.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const scriptsDir = process.env.PUBLISH_PUBLIC_SCRIPTS
  || path.resolve(HERE, "../../../../../workflow/skills/publish-public/scripts");
if (!existsSync(path.join(scriptsDir, "deny.mjs")) || !existsSync(path.join(scriptsDir, "export.mjs"))) {
  console.error(`leak-scan: cannot find the publish tool's deny.mjs and export.mjs in ${scriptsDir}. Set PUBLISH_PUBLIC_SCRIPTS to the workflow plugin's skills/publish-public/scripts folder.`);
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
  if (!PRIVATE.has(path.basename(f))) text.split("\n").forEach((t, i) => { if (PROCESS_WORDS.test(t)) hit(f, i + 1, "process word", t); });
}
console.log(`hits: ${hits}`);
process.exit(hits ? 1 : 0);
