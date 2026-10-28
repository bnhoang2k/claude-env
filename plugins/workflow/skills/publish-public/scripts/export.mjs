// Allowlist export: copy only allowed, committed files (from HEAD) into outDir.
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync, mkdirSync, readFileSync, readdirSync, lstatSync, copyFileSync,
  chmodSync, rmSync, rmdirSync, existsSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fixedIdentity, listFiles } from "./util.mjs";

// Never exported at any depth, even when an allow entry covers it. Both are private config.
export const NEVER_EXPORT = new Set([".publish-waivers.json", "publish.json"]);

const REQUIRED = [
  ["public", "remote"], ["public", "clone"], ["allow"], ["keep"],
  ["versionFrom"], ["identity", "name"], ["identity", "email"],
];
// Top-level fields publish.json may hold. An unknown one (a typo such as "exportHooks") fails the run
// rather than being skipped, because a skipped exportHook would publish files it was meant to drop.
const KNOWN = new Set(["public", "allow", "keep", "versionFrom", "identity", "exportHook", "deny", "dist"]);
const HOOK_TIMEOUT_MS = 60000;
const DEFAULT_DENY = ["base"];

/** The deny sets a publish.json field names: a non-empty list of unique set names, or the default ["base"] when absent. */
function parseDeny(value) {
  if (value === undefined) return [...DEFAULT_DENY];
  if (!Array.isArray(value) || value.length === 0 || value.some((s) => typeof s !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(s)) || new Set(value).size !== value.length) {
    throw new Error('publish.json field deny must be a list of unique deny set names, such as ["base", "kit"]');
  }
  return [...value];
}

/** Deny sets for a repo, from publish.json as committed at HEAD. No HEAD or no publish.json means ["base"].
 *  A publish.json that cannot be parsed, or a bad deny field, throws (fail closed). */
export function readDenySets(repo) {
  let text;
  try {
    git(repo, ["rev-parse", "--verify", "-q", "HEAD"]);
  } catch {
    return [...DEFAULT_DENY];
  }
  text = showHead(repo, "publish.json");
  if (text === null) return [...DEFAULT_DENY];
  const cfg = JSON.parse(text);
  return parseDeny(cfg?.deny);
}

/** The one way to read public.clone: a leading ~/ is the home folder, a relative path is relative to the private repo. */
export function resolveClone(privateRepo, clone) {
  const expanded = clone.replace(/^~(?=\/|$)/, homedir());
  return path.resolve(privateRepo, expanded);
}

/** Text of a file as committed at HEAD. Null when HEAD has no such path. Throws when git fails (not a repo, no HEAD). */
export function showHead(repo, rel) {
  if (git(repo, ["ls-tree", "--name-only", "-z", "HEAD", "--", rel]) === "") return null;
  return git(repo, ["cat-file", "blob", `HEAD:${rel}`]);
}

/** Reads publish.json as committed at HEAD: an edit that is not committed has no effect. */
export function readConfig(privateRepo) {
  const text = showHead(privateRepo, "publish.json");
  if (text === null) throw new Error("publish.json is not committed in HEAD of the private repo");
  const cfg = JSON.parse(text);
  for (const key of Object.keys(cfg)) {
    if (!KNOWN.has(key)) throw new Error(`publish.json has an unknown field: ${key}`);
  }
  for (const field of REQUIRED) {
    let v = cfg;
    for (const k of field) v = v == null ? undefined : v[k];
    if (v === undefined || v === null || v === "") {
      throw new Error(`publish.json is missing required field: ${field.join(".")}`);
    }
    const isList = field[0] === "allow" || field[0] === "keep";
    if (isList && !Array.isArray(v)) {
      throw new Error(`publish.json field must be an array: ${field.join(".")}`);
    }
  }
  // Braces, classes, escapes and extglobs hide dots from the keep matcher, so a dotfile could escape a keep rule.
  for (const pattern of cfg.keep) {
    if (typeof pattern !== "string" || /[{[\\]|[?*+@!]\(/.test(pattern)) {
      throw new Error(`publish.json keep pattern is not supported (no { [ \\ or extglob): ${JSON.stringify(pattern)}`);
    }
  }
  if (cfg.versionFrom !== "package.json") {
    throw new Error('publish.json field versionFrom must equal "package.json"');
  }
  const hook = cfg.exportHook;
  if (hook !== undefined && (!Array.isArray(hook) || hook.length === 0 || hook.some((a) => typeof a !== "string" || a === ""))) {
    throw new Error("publish.json field exportHook must be a list of non-empty strings: the command and its arguments");
  }
  if (cfg.dist !== undefined && typeof cfg.dist !== "boolean") {
    throw new Error("publish.json field dist must be true or false");
  }
  const deny = parseDeny(cfg.deny);
  const fixed = fixedIdentity();
  if (cfg.identity.name !== fixed.name || cfg.identity.email !== fixed.email) {
    throw new Error("publish.json identity must equal the fixed public identity in the config folder's identity.json");
  }
  return {
    public: { remote: cfg.public.remote, clone: resolveClone(privateRepo, cfg.public.clone) },
    allow: cfg.allow,
    keep: cfg.keep,
    versionFrom: cfg.versionFrom,
    identity: fixed,
    exportHook: hook ?? null,
    deny,
    dist: cfg.dist ?? true,
  };
}

// Allow matching: matchesGlob skips dotfiles under * and **. That only
// narrows what is allowed, so it fails closed.
export function matchesAllow(rel, pattern) {
  if (pattern.endsWith("/")) return rel.startsWith(pattern);
  return path.posix.matchesGlob(rel, pattern);
}

// Keep matching must include dotfiles, or a hidden file escapes a keep rule.
// Swap each segment's leading "." for a placeholder in path and pattern, so
// * and ** match it and a literal ".env" still matches only ".env".
const DOT = "\u0001";
const hideDots = (p) => p.split("/").map((s) => (s.startsWith(".") ? DOT + s.slice(1) : s)).join("/");
// The plain match runs too: dots inside braces, extglobs, escapes or classes
// are not swapped, so the union is what catches them. It can only add matches.
export function matchesKeep(rel, pattern) {
  return matchesAllow(rel, pattern) || matchesAllow(hideDots(rel), hideDots(pattern));
}

function git(repo, args) {
  return execFileSync("git", ["-C", repo, ...args], { stdio: "pipe", encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

// Early, clear check for the common case. The blob hash check in exportTree
// is the real guard: it catches every rewrite source.
// export-subst rewrites file text on archive, so a file would not be exported whole.
function assertNoExportSubst(repo) {
  const sources = [];
  for (const rel of git(repo, ["ls-tree", "-r", "--name-only", "-z", "HEAD"]).split("\0")) {
    if (rel && path.posix.basename(rel) === ".gitattributes") {
      sources.push([rel, git(repo, ["show", `HEAD:${rel}`])]);
    }
  }
  const info = path.resolve(repo, git(repo, ["rev-parse", "--git-path", "info/attributes"]).trim());
  if (existsSync(info)) sources.push([info, readFileSync(info, "utf8")]);
  for (const [name, text] of sources) {
    if (text.includes("export-subst")) {
      throw new Error(`export-subst found in ${name}: files would not be exported whole`);
    }
  }
}

// git archive can rewrite text (export-subst, ident, filter, eol/text, from any
// attributes source). Compare each extracted file with its blob id in HEAD.
function assertBlobsMatchHead(repo, extracted, kept) {
  if (kept.length === 0) return;
  const ids = new Map();
  for (const rec of git(repo, ["ls-tree", "-r", "-z", "HEAD"]).split("\0")) {
    const tab = rec.indexOf("\t");
    if (tab > 0) ids.set(rec.slice(tab + 1), rec.slice(0, tab).split(" ")[2]);
  }
  for (const rel of kept) {
    if (rel.includes("\n")) throw new Error(`path contains a newline: ${JSON.stringify(rel)}`);
  }
  const out = execFileSync("git", ["hash-object", "--no-filters", "--stdin-paths"], {
    cwd: extracted,
    input: kept.join("\n") + "\n",
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
  }).split("\n");
  kept.forEach((rel, i) => {
    if (ids.get(rel) !== out[i]) {
      throw new Error(`exported file differs from its committed blob: ${rel}`);
    }
  });
}

/**
 * The kit's export hook: a committed command that trims the export, for files that publish only on a
 * condition the allowlist cannot express (for example, a bar marked ready in a private file). It runs
 * without a shell, in the whole committed HEAD tree (private files included, nothing installed), with
 * outDir as its last argument. It may delete or rewrite exported files. It may not add any: the export
 * stays a subset of the allowlist. Every later check reads the trimmed export.
 */
function runExportHook([cmd, ...args], headTree, outDir, kept) {
  const r = spawnSync(cmd, [...args, outDir], { cwd: headTree, encoding: "utf8", timeout: HOOK_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 });
  if (r.error || r.status !== 0) {
    const tail = `${r.stderr || ""}${r.stdout || ""}`.trim().slice(-300);
    throw new Error(`export hook ${[cmd, ...args].join(" ")} failed: ${r.error ? r.error.message : `exit ${r.status}`} ${tail}`.trim());
  }
  const allowed = new Set(kept);
  const after = listFiles(outDir, { noSymlinks: true });
  const added = after.filter((rel) => !allowed.has(rel));
  if (added.length > 0) throw new Error(`export hook added files that are not in the allowlisted export: ${added.join(", ")}`);
  pruneEmptyDirs(outDir);
  return after;
}

/** Removes every empty folder under root, deepest first. Root itself stays. */
function pruneEmptyDirs(root) {
  for (const e of readdirSync(root, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const dir = path.join(root, e.name);
    pruneEmptyDirs(dir);
    if (readdirSync(dir).length === 0) rmdirSync(dir);
  }
}

export function exportTree(privateRepo, config, outDir) {
  if (existsSync(outDir) && readdirSync(outDir).length > 0) {
    throw new Error(`outDir is not empty: ${outDir}`);
  }
  assertNoExportSubst(privateRepo);
  const work = mkdtempSync(path.join(tmpdir(), "publish-export-"));
  try {
    const tarFile = path.join(work, "head.tar");
    const extracted = path.join(work, "tree");
    mkdirSync(extracted);
    // HEAD only: uncommitted and untracked files are never in the archive.
    execFileSync("git", ["-C", privateRepo, "archive", "--format=tar", "-o", tarFile, "HEAD"], { stdio: "pipe" });
    execFileSync("tar", ["-x", "-f", tarFile, "-C", extracted], { stdio: "pipe" });

    const kept = listFiles(extracted)
      .filter((rel) => !NEVER_EXPORT.has(path.posix.basename(rel)))
      .filter((rel) => config.allow.some((p) => matchesAllow(rel, p)))
      .filter((rel) => !config.keep.some((p) => matchesKeep(rel, p)))
      .sort();

    for (const rel of kept) {
      if (lstatSync(path.join(extracted, rel)).isSymbolicLink()) {
        throw new Error(`symlink in export: ${rel}`);
      }
    }

    assertBlobsMatchHead(privateRepo, extracted, kept);

    mkdirSync(outDir, { recursive: true });
    for (const rel of kept) {
      const src = path.join(extracted, rel);
      const dest = path.join(outDir, ...rel.split("/"));
      mkdirSync(path.dirname(dest), { recursive: true });
      copyFileSync(src, dest);
      chmodSync(dest, lstatSync(src).mode & 0o777);
    }
    if (!config.exportHook) return { files: kept };
    return { files: runExportHook(config.exportHook, extracted, outDir, kept) };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
