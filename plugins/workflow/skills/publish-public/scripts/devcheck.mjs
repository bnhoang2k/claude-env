// Dev repo guard. Runs from the dev hooks.
//   node devcheck.mjs pre-commit            scan the added lines of the staged diff
//   node devcheck.mjs commit-msg <msgfile>  scan every line of the commit message
// Any hit, or any error, exits 1 (fail closed).
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadRules, scanText } from "./deny.mjs";
import { readDenySets } from "./export.mjs";

/** Added lines of a unified diff, as { file, line, text }. Binary files carry no hunks. */
export function addedLines(diff) {
  const out = [];
  let file = null;
  let next = 0;
  let inHunk = false;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("diff --git ")) { inHunk = false; file = null; continue; }
    if (!inHunk) {
      if (raw.startsWith("+++ ")) file = raw.slice(4).replace(/^b\//, "");
      const m = /^@@ -\S+ \+(\d+)/.exec(raw);
      if (m) { inHunk = true; next = Number(m[1]); }
      continue;
    }
    const m = /^@@ -\S+ \+(\d+)/.exec(raw);
    if (m) { next = Number(m[1]); continue; }
    if (raw.startsWith("+")) out.push({ file, line: next++, text: raw.slice(1) });
  }
  return out;
}

function checkStaged(rules) {
  const diff = execFileSync(
    "git",
    ["-c", "core.quotepath=off", "diff", "--cached", "-U0", "--no-color", "--no-ext-diff", "--no-renames"],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  const hits = [];
  for (const a of addedLines(diff)) {
    for (const h of scanText(a.text, rules)) hits.push(`${a.file}:${a.line}: ${h.rule}: ${h.text}`);
  }
  return hits;
}

function checkMessage(rules, msgFile) {
  // Every line counts, including "#" lines. With -m or -F git keeps "#" lines in the commit,
  // and this hook reads the file before cleanup. A hit in the editor template only blocks the commit.
  return scanText(readFileSync(msgFile, "utf8"), rules).map((h) => `message:${h.line}: ${h.rule}: ${h.text}`);
}

function main(argv) {
  const [mode, msgFile] = argv;
  const rules = loadRules(readDenySets(process.cwd()));
  let hits;
  if (mode === "pre-commit") hits = checkStaged(rules);
  else if (mode === "commit-msg" && msgFile) hits = checkMessage(rules, msgFile);
  else throw new Error("usage: devcheck.mjs pre-commit | commit-msg <msgfile>");
  if (hits.length === 0) return 0;
  for (const h of hits) console.error(`refused: ${h}`);
  console.error(`${hits.length} deny list hit(s). Fix the text and commit again. Do not use --no-verify.`);
  return 1;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(`refused: guard error (fail closed): ${e.message}`);
    process.exitCode = 1;
  }
}
