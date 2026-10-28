// Adds a capture path to a project folder's .gitignore, so a capture of someone else's site never gets
// committed. Run it before writing a capture inside a project folder.
// usage: node ignore-capture.mjs <project folder> <capture path>
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function ignoreCapture(project, capture) {
  const rel = path.relative(path.resolve(project), path.resolve(capture));
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`${capture} is outside the project folder ${project}; nothing to ignore there`);
  }
  const line = "/" + rel.split(path.sep).join("/") + "/";
  const file = path.join(project, ".gitignore");
  const have = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (have.split("\n").includes(line)) return line;
  appendFileSync(file, (have && !have.endsWith("\n") ? "\n" : "") + line + "\n");
  return line;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [project, capture] = process.argv.slice(2);
  if (!project || !capture) { console.error("usage: node ignore-capture.mjs <project folder> <capture path>"); process.exit(2); }
  try { console.log(`ignored ${ignoreCapture(project, capture)} in ${path.join(project, ".gitignore")}`); }
  catch (e) { console.error(e.message); process.exit(1); }
}
