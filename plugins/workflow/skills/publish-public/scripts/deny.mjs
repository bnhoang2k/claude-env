// Private deny-list scanner. Finds text that must not reach the public twin.
// Generic rules (home path, keys, emails) live here. Names of private things
// (people, repos, tools, projects) live in the user's config folder, in named
// sets: <configDir>/deny/<set>.json. A repo picks its sets in publish.json.
//   node deny.mjs scan <dir> [--sets a,b]   list findings as file:line: rule, exit 1 on any
import { existsSync, readFileSync, readdirSync, readlinkSync, realpathSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { configDir, isBinary } from "./util.mjs";

export { configDir };

/** Rules with no private names in them. Names match a kit's check-public.mjs. */
const GENERIC = [
  { name: "home path", re: /\/Users\/|~\/Documents\b|\/home\/[a-z]/i },
  { name: "private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "API key or token", re: /\b(sk-ant-[\w-]{10,}|sk-[A-Za-z0-9]{32,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,}|AKIA[0-9A-Z]{16}|xox[abprs]-[\w-]{10,})/ },
];

export const EMAIL_RULE = "email address";
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Anthropic's co-author address, GitHub noreply addresses, and the reserved example domains (RFC 2606).
const ALLOWED_EMAIL = /^noreply@anthropic\.com$|@users\.noreply\.github\.com$|@example\.(com|org|net)$|\.(test|invalid|example)$/i;

/** One neutral sample per built-in rule. Each must hit its rule. A set's own samples live beside the set. */
export const GENERIC_SAMPLES = {
  // Each sample is joined from parts at load time, so this file never contains text its own rules would flag.
  "home path": ["see /Users", "/example/project/file.txt"].join(""),
  "private key": ["-----BEGIN RSA PRIV", "ATE KEY-----"].join(""),
  "API key or token": ["token = ghp", "_", "a".repeat(36)].join(""),
  [EMAIL_RULE]: ["contact someone", "@gmail.com for help"].join(""),
};

const SET_NAME = /^[a-z0-9][a-z0-9-]*$/;

/** Flags without g or y: those make re.test remember its position between calls. */
const stateless = (flags = "") => flags.replace(/[gy]/g, "");

const setPath = (dir, set, suffix = "") => join(dir, "deny", `${set}${suffix}.json`);

function checkSets(sets) {
  if (!Array.isArray(sets) || sets.length === 0) throw new Error('no deny sets named: pass a non-empty list such as ["base"]');
  for (const set of sets) {
    if (typeof set !== "string" || !SET_NAME.test(set)) throw new Error(`not a valid deny set name: ${JSON.stringify(set)}`);
  }
}

function missing(path) {
  return new Error(`no deny rules configured: ${path} (copy data/deny.example.json there)`);
}

/** Build every RegExp once, from <dir>/deny/<set>.json for each set, in order. Throws on a missing set,
 *  a bad entry or a repeated name (fail closed). Each rule carries the set it came from. */
export function loadRules(sets, dir = configDir()) {
  checkSets(sets);
  if (!existsSync(dir)) throw missing(dir);
  const rules = GENERIC.map((r) => ({ name: r.name, set: "built-in", re: new RegExp(r.re.source, stateless(r.re.flags)) }));
  const seen = new Set([...rules.map((r) => r.name), EMAIL_RULE]);
  for (const set of sets) {
    const file = setPath(dir, set);
    if (!existsSync(file)) throw missing(file);
    const entries = JSON.parse(readFileSync(file, "utf8"));
    if (!Array.isArray(entries)) throw new Error(`${file}: expected a JSON array`);
    for (const e of entries) {
      if (!e || typeof e.name !== "string" || typeof e.pattern !== "string") {
        throw new Error(`${file}: each entry needs a string name and pattern`);
      }
      if (seen.has(e.name)) throw new Error(`${file}: duplicate rule name "${e.name}"`);
      seen.add(e.name);
      rules.push({ name: e.name, set, re: new RegExp(e.pattern, stateless(e.flags)) });
    }
  }
  return rules;
}

/** Throws unless every rule has a sample that hits it. Built-in samples are in code. A set's samples are in
 *  <dir>/deny/<set>.samples.json, and each rule of that set needs its own entry there. */
export function checkSamples(rules, sets, dir = configDir()) {
  const bySet = new Map();
  for (const set of sets) {
    const file = setPath(dir, set, ".samples");
    if (!existsSync(file)) throw new Error(`no deny samples: ${file} (copy data/deny-samples.example.json there)`);
    bySet.set(set, JSON.parse(readFileSync(file, "utf8")));
  }
  const need = [...rules.map((r) => [r.set, r.name]), ["built-in", EMAIL_RULE]];
  for (const [set, name] of need) {
    const sample = (set === "built-in" ? GENERIC_SAMPLES : bySet.get(set))?.[name];
    if (typeof sample !== "string") throw new Error(`no deny sample for rule "${name}"${set === "built-in" ? "" : ` in set "${set}"`}`);
    if (!scanText(sample, rules).some((h) => h.rule === name)) throw new Error(`deny rule "${name}" did not catch its own sample`);
  }
}

/** Hits in a block of text, as { line, rule, text }. */
export function scanText(text, rules) {
  const out = [];
  text.split("\n").forEach((raw, i) => {
    const line = i + 1;
    const trimmed = raw.trim();
    for (const r of rules) if (r.re.test(raw)) out.push({ line, rule: r.name, text: trimmed });
    for (const m of raw.match(EMAIL) ?? []) {
      if (!ALLOWED_EMAIL.test(m)) out.push({ line, rule: EMAIL_RULE, text: trimmed });
    }
  });
  return out;
}

/** Printable ASCII runs of 4 or more characters, like `strings`, one per line. */
function printableRuns(file) {
  return (readFileSync(file).toString("latin1").match(/[\t\x20-\x7e]{4,}/g) ?? []).join("\n");
}

/** Hits in every file under dir, as { file, line, rule, text }. Skips .git/.
 *  A binary file is scanned through its printable runs: its hits carry line 0 and the run text.
 *  A symlink is never followed. Its target string is committed content, so that string is scanned (line 1). */
export function scanTree(dir, rules) {
  const out = [];
  const walk = (d) => {
    const entries = readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const e of entries) {
      const p = join(d, e.name);
      const file = relative(dir, p).split(sep).join("/");
      if (e.isSymbolicLink()) {
        for (const h of scanText(readlinkSync(p), rules)) out.push({ file, ...h });
      } else if (e.isDirectory()) {
        if (e.name !== ".git") walk(p);
      } else if (e.isFile()) {
        if (isBinary(p)) {
          for (const h of scanText(printableRuns(p), rules)) out.push({ file, ...h, line: 0 });
        } else {
          for (const h of scanText(readFileSync(p, "utf8"), rules)) out.push({ file, ...h });
        }
      }
    }
  };
  walk(dir);
  return out;
}

function main(argv) {
  const [cmd, target, ...rest] = argv;
  const usage = "usage: deny.mjs scan <dir> [--sets a,b]";
  if (cmd !== "scan" || !target || (rest.length !== 0 && !(rest.length === 2 && rest[0] === "--sets"))) throw new Error(usage);
  const sets = rest.length === 2 ? rest[1].split(",") : ["base"];
  const hits = scanTree(target, loadRules(sets));
  for (const h of hits) console.log(`${h.file}:${h.line}: ${h.rule}`);
  return hits.length === 0 ? 0 : 1;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(`deny: ${e.message}`);
    process.exitCode = 1;
  }
}
