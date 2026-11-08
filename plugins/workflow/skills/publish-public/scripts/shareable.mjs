// Would publish-public export this path? Used by the name-lint edit hook.
//   node shareable.mjs <repoRoot> <relPath>   prints "yes" or "no"
// The answer uses the same allow, keep and never-export rules as the export, read from publish.json as
// committed at HEAD (the export reads HEAD too). A repo with no publish.json, or no HEAD, answers "no".
// This is a lenient reader on purpose: it checks only allow and keep, never the identity or deny fields,
// because a warning hook must not fail over a config problem that the publish run itself reports.
import path from "node:path";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { NEVER_EXPORT, matchesAllow, matchesKeep, showHead } from "./export.mjs";

/** True when publish.json (at HEAD) allows `rel`, no keep rule holds it back, and it is not a never-export file. */
export function isShareable(repo, rel) {
  let text;
  try {
    text = showHead(repo, "publish.json");
  } catch {
    return false; // not a repo, or no HEAD yet
  }
  if (text === null) return false;
  const cfg = JSON.parse(text);
  const allow = Array.isArray(cfg.allow) ? cfg.allow.filter((p) => typeof p === "string") : [];
  const keep = Array.isArray(cfg.keep) ? cfg.keep.filter((p) => typeof p === "string") : [];
  if (NEVER_EXPORT.has(path.posix.basename(rel))) return false;
  return allow.some((p) => matchesAllow(rel, p)) && !keep.some((p) => matchesKeep(rel, p));
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [repo, rel, ...extra] = process.argv.slice(2);
  if (!repo || !rel || extra.length > 0) {
    console.error("usage: shareable.mjs <repoRoot> <relPath>");
    process.exitCode = 2;
  } else {
    try {
      console.log(isShareable(repo, rel) ? "yes" : "no");
    } catch (e) {
      console.error(`shareable: ${e.message}`);
      process.exitCode = 1;
    }
  }
}
