// The publish run. Exports an allowlisted copy of a private kit repo, checks it
// (gitleaks, deny list, blind review with plants, build and test), then stages
// two stamped commits and a tag in the public clone. It never pushes.
// Usage: node publish.mjs <privateRepo> [--dry-run] [--seed N]
//        node publish.mjs <privateRepo> --unstage   drop what a run staged and the remote does not have
import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomInt } from "node:crypto";
import {
  mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync, cpSync,
  chmodSync, lstatSync, existsSync, rmSync, realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readConfig, exportTree, showHead } from "./export.mjs";
import { loadRules, checkSamples, scanTree } from "./deny.mjs";
import { makePlants, placePlants, scorePlants } from "./plants.mjs";
import { checkBlindness, blindReview, totalCost, resetCost } from "./review.mjs";
import { writeStamp, stampPath } from "./stamp.mjs";
import { SEMVER_RE, assertConfigDir, listFiles as listUtil } from "./util.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GITLEAKS_CONFIG = path.join(HERE, "../data/gitleaks.toml");
const BUILD_TIMEOUT_MS = 600000;

export const BUILD_COMMANDS = [
  ["pnpm", "install", "--frozen-lockfile"],
  ["pnpm", "build"],
  ["pnpm", "test"],
];

const msg = (e) => (e instanceof Error ? e.message : String(e));
const posix = (p) => p.split(path.sep).join("/");

function git(cwd, args, env = {}) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, env: { ...process.env, ...env } });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${(r.stderr || "").trim()}`);
  return r.stdout;
}
const git1 = (cwd, args, env) => git(cwd, args, env).trim();
function tryGit(cwd, args) {
  try { return git1(cwd, args); } catch { return null; }
}

/** Runs install, build and test in dir, one command at a time, without a shell. */
export async function defaultBuild(dir) {
  for (const [cmd, ...args] of BUILD_COMMANDS) {
    const r = spawnSync(cmd, args, { cwd: dir, encoding: "utf8", timeout: BUILD_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
    if (r.error || r.status !== 0) {
      const tail = `${r.stderr || ""}${r.stdout || ""}`.trim().slice(-300);
      throw new Error(`${cmd} ${args.join(" ")} failed: ${r.error ? r.error.message : `exit ${r.status}`} ${tail}`.trim());
    }
  }
}

/** gitleaks over dir. Returns [{ file, line, why }]. Exit 0 with [] is clean, exit 1 with hits is a hit, all else throws. */
export async function runGitleaks(dir) {
  // Nothing in the scanned folder or the environment may switch the scan off:
  // fixed config, no gitleaks:allow comments, an empty ignore folder, an empty cwd.
  const quiet = mkdtempSync(path.join(tmpdir(), "gitleaks-cwd-"));
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GITLEAKS_")));
  const args = [
    "dir", dir, "--no-banner", "--report-format", "json", "--report-path", "-", "--exit-code", "1", "--log-level", "error",
    "--config", GITLEAKS_CONFIG, "--ignore-gitleaks-allow", "--gitleaks-ignore-path", quiet,
  ];
  let r;
  try {
    r = spawnSync("gitleaks", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, cwd: quiet, env });
  } finally {
    rmSync(quiet, { recursive: true, force: true });
  }
  if (r.error) throw r.error;
  let hits;
  try { hits = JSON.parse(r.stdout); } catch { throw new Error("gitleaks output is not JSON"); }
  if (!Array.isArray(hits)) throw new Error("gitleaks output is not a JSON array");
  if (r.status === 0 && hits.length === 0) return [];
  if (r.status !== 1 || hits.length === 0) throw new Error(`gitleaks gave exit ${r.status} with ${hits.length} finding(s)`);
  const bases = [path.resolve(dir), realpathSync(dir)];
  const rel = (f) => {
    for (const b of bases) { const x = path.relative(b, f); if (!x.startsWith("..")) return posix(x); }
    return f;
  };
  // The secret itself is never copied into the result.
  return hits.map((h) => ({ file: rel(String(h.File)), line: h.StartLine, why: String(h.RuleID) }));
}

const listFiles = (dir) => listUtil(dir, { noSymlinks: true });

function copyFiles(from, to, files) {
  for (const rel of files) {
    const dest = path.join(to, ...rel.split("/"));
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(path.join(from, ...rel.split("/")), dest);
    chmodSync(dest, lstatSync(path.join(from, ...rel.split("/"))).mode & 0o777);
  }
}

/** Blob id of each file under dir, git hash-object with no filters. Throws if git fails. */
function blobIds(dir, files) {
  if (files.length === 0) return [];
  for (const rel of files) if (rel.includes("\n")) throw new Error(`path contains a newline: ${JSON.stringify(rel)}`);
  const r = spawnSync("git", ["hash-object", "--no-filters", "--stdin-paths"], {
    cwd: dir, input: `${files.join("\n")}\n`, encoding: "utf8", maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
  });
  const ids = (r.stdout || "").split("\n").slice(0, files.length);
  if (r.error || r.status !== 0 || ids.length !== files.length || ids.some((x) => !/^[0-9a-f]{40,64}$/.test(x))) {
    throw new Error(`could not hash the exported files: ${r.error ? r.error.message : (r.stderr || "").trim()}`);
  }
  return ids;
}

/** Throws unless the staged index holds exactly these files with exactly these blobs. */
function assertIndex(clone, expected) {
  const staged = new Map();
  for (const rec of git(clone, ["ls-files", "-s", "-z"]).split("\0")) {
    const tab = rec.indexOf("\t");
    if (tab > 0) staged.set(rec.slice(tab + 1), rec.slice(0, tab).split(" ")[1]);
  }
  for (const [rel, id] of expected) {
    if (!staged.has(rel)) throw new Error(`staged tree is missing ${rel}`);
    if (staged.get(rel) !== id) throw new Error(`staged file differs from the reviewed export: ${rel}`);
  }
  for (const rel of staged.keys()) if (!expected.has(rel)) throw new Error(`staged tree has an extra file: ${rel}`);
}

// Files that tell a search tool to skip paths. They can hide files from gitleaks or from the reviewer.
const IGNORE_FILES = new Set([".gitleaksignore", ".ignore", ".rgignore"]);
const NO_IGNORE_FILE = (files) => {
  const bad = files.find((f) => IGNORE_FILES.has(path.posix.basename(f)));
  if (bad) throw new Error(`${bad} could hide files from the secret scan or the reviewer, so it cannot be published`);
};

function randomToken(n) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(randomBytes(n), (b) => chars[b % chars.length]).join("");
}

const remoteName = (remote) => /([^/:]+\/[^/:]+?)(?:\.git)?\/?$/.exec(remote)?.[1] ?? remote;

/** Added, changed and removed files: the export against public main. Read only. */
function changesAgainst(clone, exportDir, files, cloneOptional) {
  const old = new Map();
  if (!existsSync(clone)) {
    if (!cloneOptional) throw new Error(`public clone not found: ${clone}`);
  } else if (tryGit(clone, ["rev-parse", "--verify", "-q", "refs/heads/main"])) {
    for (const rec of git(clone, ["ls-tree", "-r", "-z", "main"]).split("\0")) {
      const tab = rec.indexOf("\t");
      if (tab > 0) old.set(rec.slice(tab + 1), rec.slice(0, tab).split(" ")[2]);
    }
  }
  const ids = blobIds(exportDir, files);
  const changes = { added: [], changed: [], removed: [] };
  files.forEach((rel, i) => {
    if (!old.has(rel)) changes.added.push(rel);
    else if (old.get(rel) !== ids[i]) changes.changed.push(rel);
  });
  const now = new Set(files);
  changes.removed = [...old.keys()].filter((rel) => !now.has(rel)).sort();
  return changes;
}

/** Refuse a public clone that is dirty, off main, or already tagged for this version. */
function checkClone(clone, version) {
  if (!existsSync(clone)) throw new Error(`public clone not found: ${clone}`);
  if (git1(clone, ["status", "--porcelain"]) !== "") throw new Error("public clone has uncommitted or untracked changes");
  if (tryGit(clone, ["symbolic-ref", "--short", "-q", "HEAD"]) !== "main") throw new Error("public clone is not on main");
  if (tryGit(clone, ["rev-parse", "-q", "--verify", `refs/tags/v${version}`])) throw new Error(`public clone already has tag v${version}`);
}

/** Waivers as committed at HEAD: a file that is not committed has no effect. */
function loadWaivers(privateRepo) {
  const text = showHead(privateRepo, ".publish-waivers.json");
  if (text === null) return [];
  const list = JSON.parse(text);
  const ok = Array.isArray(list) && list.every((w) => w && ["file", "sha256", "why"].every((k) => typeof w[k] === "string"));
  if (!ok) throw new Error(".publish-waivers.json must be a list of { file, sha256, why }");
  return list;
}

/** Map a line number in the planted copy to the clean export. Null inside the changed region. */
export function cleanLineOf(cleanText, plantedText, n) {
  const c = cleanText.split("\n");
  const p = plantedText.split("\n");
  const max = Math.min(c.length, p.length);
  let a = 0;
  while (a < max && c[a] === p[a]) a++;
  let b = 0;
  while (b < max - a && c[c.length - 1 - b] === p[p.length - 1 - b]) b++;
  if (n <= a) return n;
  if (n > p.length - b) return n - (p.length - c.length);
  return null;
}

/** Split real findings into the ones a waiver covers and the rest. Lines in both lists are clean-export lines. */
function applyWaivers(real, waivers, exportDir, plantedDir) {
  const used = [];
  const rest = [];
  for (const f of real) {
    let line = f.line;
    let text;
    try {
      const clean = readFileSync(path.join(exportDir, f.file), "utf8");
      const mapped = cleanLineOf(clean, readFileSync(path.join(plantedDir, f.file), "utf8"), f.line);
      if (mapped !== null) { line = mapped; text = clean.split("\n")[mapped - 1]; }
    } catch { /* unreadable file: cannot be waived */ }
    const sha = text === undefined ? null : createHash("sha256").update(text).digest("hex");
    const w = sha && waivers.find((x) => x.file === f.file && x.sha256 === sha);
    if (w) used.push({ file: f.file, line, why: w.why, finding: f.why });
    else rest.push({ file: f.file, line, why: f.why });
  }
  return { used, rest };
}

/** Stage the release commit, the built-dist commit (when withDist) and the tag in the public clone.
 *  Without dist the tag sits on the release commit. Rolls back on any error. */
function stageCommits({ clone, export: exportDir, files, buildDir, version, id, stampBase, withDist = true }) {
  // TZ=UTC: commit dates carry +0000, so they do not show the local time zone.
  const env = { GIT_AUTHOR_NAME: id.name, GIT_AUTHOR_EMAIL: id.email, GIT_COMMITTER_NAME: id.name, GIT_COMMITTER_EMAIL: id.email, TZ: "UTC" };
  const nogpg = ["-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false"];
  const orig = tryGit(clone, ["rev-parse", "--verify", "-q", "HEAD"]);
  const ids = blobIds(exportDir, files);
  const stampFiles = [];
  let tagged = false;
  const commit = (message) => {
    const tree = git1(clone, ["write-tree"]);
    if (tree === tryGit(clone, ["rev-parse", "HEAD^{tree}"])) throw new Error("nothing changed since the last commit");
    stampFiles.push(stampPath(clone, tree)); // recorded first, so a rollback always finds it
    writeStamp(clone, tree, stampBase);
    git(clone, [...nogpg, "commit", "-q", "-m", message], env);
    if (git1(clone, ["rev-parse", "HEAD^{tree}"]) !== tree) throw new Error("commit tree differs from the stamped tree");
  };
  try {
    git(clone, ["rm", "-rq", "--ignore-unmatch", "."]);
    copyFiles(exportDir, clone, files);
    git(clone, ["add", "-A"]);
    const expected = new Map(files.map((rel, i) => [rel, ids[i]]));
    assertIndex(clone, expected);
    commit(`Release v${version}`);
    if (withDist) {
      git(clone, ["switch", "-q", "--detach"]);
      rmSync(path.join(clone, "dist"), { recursive: true, force: true });
      const dist = path.join(buildDir, "dist");
      copyFiles(dist, path.join(clone, "dist"), listFiles(dist));
      git(clone, ["add", "-f", "dist"]);
      const distFiles = listFiles(dist).map((rel) => `dist/${rel}`);
      blobIds(buildDir, distFiles).forEach((id, i) => expected.set(distFiles[i], id));
      assertIndex(clone, expected);
      commit(`Release v${version} (built dist)`);
    }
    git(clone, [...nogpg, "tag", `v${version}`], env);
    tagged = true;
    if (withDist) git(clone, ["switch", "-q", "main"]);
  } catch (e) {
    const t = (args) => tryGit(clone, args);
    t(["switch", "-q", "-f", "main"]);
    if (tagged) t(["tag", "-d", `v${version}`]);
    if (orig) t(["reset", "-q", "--hard", orig]);
    else { t(["update-ref", "-d", "refs/heads/main"]); t(["read-tree", "--empty"]); }
    t(["clean", "-fdxq"]);
    for (const f of stampFiles) rmSync(f, { force: true });
    throw e;
  }
}

/** Unchanged files the review reads as a spot check, and the step it grows by when plants need room. */
const UNCHANGED_SAMPLE = 5;

/**
 * Copy the files the reviewer reads into dir and place the plants there. A full review reads every
 * file. A diff review reads the files added or changed since public main, plus a seeded sample of
 * unchanged files; the sample grows while the plants lack eligible files. On a first release every
 * file is added, so a diff review reads them all. Returns { placed, reviewed }.
 */
function reviewSet(exportDir, dir, files, changes, { full, seed }) {
  const changed = new Set([...changes.added, ...changes.changed]);
  const order = (rel) => createHash("sha256").update(`${seed}:${rel}`).digest("hex");
  const rest = files.filter((rel) => !changed.has(rel)).sort((a, b) => (order(a) < order(b) ? -1 : 1));
  let take = full ? rest.length : Math.min(UNCHANGED_SAMPLE, rest.length);
  for (;;) {
    const pick = [...files.filter((rel) => changed.has(rel)), ...rest.slice(0, take)];
    rmSync(dir, { recursive: true, force: true });
    for (const rel of pick) {
      mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      cpSync(path.join(exportDir, rel), path.join(dir, rel));
    }
    try {
      return { placed: placePlants(dir, makePlants(seed), seed), reviewed: pick.length };
    } catch (e) {
      if (!/eligible/.test(msg(e)) || take >= rest.length) throw e;
      take = Math.min(rest.length, take + UNCHANGED_SAMPLE);
    }
  }
}

/** Run every check, then stage the commits. Returns a Report. Never throws. */
export async function publish(privateRepo, opts = {}) {
  const { dryRun = false, full = false, review = { checkBlindness, blindReview }, gitleaks = runGitleaks, build = defaultBuild, onPlaced } = opts;
  const seed = opts.seed ?? randomInt(0, 2 ** 32);
  resetCost();
  const report = {
    pass: false, version: "", changes: { added: [], changed: [], removed: [] }, checks: {},
    plants: { caught: 0, total: 0 }, findings: [], reviewFindings: [], missed: [], waivers: [], seed, dryRun, name: "", blindness: null, cost: 0,
    review: null,
  };
  const step = async (key, fn) => {
    try { await fn(); report.checks[key] = "pass"; } catch (e) { report.checks[key] = msg(e); throw e; }
  };
  const work = mkdtempSync(path.join(tmpdir(), "publish-run-"));
  const exportDir = path.join(work, "export");
  const plantedDir = path.join(work, "planted");
  const buildDir = path.join(work, "build");
  const hitsToFindings = (hits, prefix, label) => hits.map((h) => ({ file: prefix + h.file, line: h.line, why: `${label}: ${h.why ?? h.rule}` }));
  try {
    let config, files, clone;
    await step("export", async () => {
      assertConfigDir(); // before readConfig reads identity.json: a missing folder gets the clear message
      config = readConfig(privateRepo);
      report.name = remoteName(config.public.remote);
      // Specs, plans and research live in the kit's brain repo, never in the twin, so none can reach the export.
      if (tryGit(privateRepo, ["ls-tree", "--name-only", "HEAD", "docs"])) {
        throw new Error("the private repo has a docs/ folder: specs, plans and research belong in the kit's separate notes repo");
      }
      clone = config.public.clone; // readConfig resolved it
      ({ files } = exportTree(privateRepo, config, exportDir));
      NO_IGNORE_FILE(files);
      const version = JSON.parse(readFileSync(path.join(exportDir, "package.json"), "utf8")).version;
      if (typeof version !== "string" || !SEMVER_RE.test(version)) throw new Error(`version in package.json is not semver: ${version}`);
      if (JSON.parse(readFileSync(path.join(exportDir, "package.json"), "utf8")).scripts?.prepare !== undefined) {
        throw new Error("package.json has a prepare script, which would run private hooks in the public repo");
      }
      report.version = version;
      // node_modules/ and dist/ never go to public main. dist/ comes from the build only.
      files = files.filter((rel) => !/^dist\//.test(rel) && !rel.split("/").includes("node_modules"));
      report.changes = changesAgainst(clone, exportDir, files, dryRun);
    });
    if (!dryRun) await step("clone", async () => checkClone(clone, report.version));

    await step("gitleaks", async () => {
      const probe = path.join(work, "probe");
      cpSync(exportDir, probe, { recursive: true });
      writeFileSync(path.join(probe, "selftest-key.txt"), `token = "ghp_${randomToken(36)}"\n`);
      const caught = await gitleaks(probe);
      rmSync(probe, { recursive: true, force: true });
      if (caught.length === 0) throw new Error("self-test failed: gitleaks did not catch a planted key");
      const hits = await gitleaks(exportDir);
      if (hits.length > 0) {
        report.findings.push(...hitsToFindings(hits, "", "secret scan"));
        throw new Error(`${hits.length} secret hit(s) in the export`);
      }
    });

    let rules;
    await step("deny", async () => {
      rules = loadRules(config.deny); // the sets this repo picked in publish.json, from the user's config folder
      checkSamples(rules, config.deny);
      const hits = scanTree(exportDir, rules);
      if (hits.length > 0) {
        report.findings.push(...hitsToFindings(hits, "", "deny rule"));
        throw new Error(`${hits.length} deny list hit(s) in the export`);
      }
    });

    await step("blindness", async () => {
      const r = await review.checkBlindness(undefined, { rules });
      report.blindness = r.blind === true;
      if (r.blind !== true) throw new Error("the reviewer is not blind: it can see private context");
    });

    await step("review", async () => {
      const { placed, reviewed } = reviewSet(exportDir, plantedDir, files, report.changes, { full, seed });
      report.review = { mode: full ? "full" : "diff", reviewed, total: files.length };
      onPlaced?.(placed, plantedDir);
      const { caught, missed, real } = scorePlants(await review.blindReview(plantedDir), placed);
      report.plants = { caught: caught.length, total: placed.length };
      report.missed = missed.map(({ file, line, type }) => ({ file, line, type }));
      const { used, rest } = applyWaivers(real, loadWaivers(privateRepo), exportDir, plantedDir);
      report.waivers = used;
      // The reviewer's own findings are judgement calls that differ run to run, so they never block.
      // They go in the report for the user to read before the push. Missed plants still fail the run.
      report.reviewFindings.push(...rest);
      if (missed.length > 0) throw new Error(`${missed.length} plant(s) missed`);
    });

    await step("build", async () => {
      cpSync(exportDir, buildDir, { recursive: true }); // the export stays as reviewed
      rmSync(path.join(buildDir, "dist"), { recursive: true, force: true }); // dist/ is build output only
      await build(buildDir);
    });
    // publish.json "dist": false is for a repo used straight from its source (a plugin marketplace):
    // the build only checks it, and a dist/ folder it leaves behind is refused rather than dropped.
    await step("dist", async () => {
      const dist = path.join(buildDir, "dist");
      if (!config.dist) {
        if (existsSync(dist)) throw new Error('the build made dist/ files, but publish.json says "dist": false');
        return;
      }
      if (!existsSync(dist) || listFiles(dist).length === 0) throw new Error("the build made no dist/ files");
      NO_IGNORE_FILE(listFiles(dist));
      const hits = [
        ...hitsToFindings(await gitleaks(dist), "dist/", "secret scan"),
        ...hitsToFindings(scanTree(dist, rules), "dist/", "deny rule"),
      ];
      if (hits.length > 0) { report.findings.push(...hits); throw new Error(`${hits.length} hit(s) in dist/`); }
    });

    if (!dryRun) {
      await step("stage", async () => {
        checkClone(clone, report.version);
        const stampBase = {
          pass: true, date: new Date().toISOString(), version: report.version, seed,
          checks: { ...report.checks }, plants: report.plants, reviewFindings: report.reviewFindings.length, blindness: true, review: report.review.mode,
        };
        stageCommits({ clone, export: exportDir, files, buildDir, version: report.version, id: config.identity, stampBase, withDist: config.dist });
      });
    }
    report.pass = true;
  } catch {
    // The failing step recorded its message in report.checks.
  } finally {
    report.cost = totalCost();
    rmSync(work, { recursive: true, force: true });
  }
  return report;
}

/**
 * Undo a staged run that was not pushed (the user said no, or the hook refused). In the public clone:
 * delete every local v* tag the remote lacks, put main back on origin/main (or make it unborn when
 * origin has no main), remove the stamps of the dropped commits, and clean the work tree.
 * Fails closed: if the clone is off main or the remote cannot be listed, nothing changes.
 * Returns the lines to print.
 */
export function unstage(privateRepo) {
  const { public: pub } = readConfig(privateRepo);
  const clone = pub.clone;
  if (!existsSync(clone)) throw new Error(`public clone not found: ${clone}`);
  if (tryGit(clone, ["symbolic-ref", "--short", "-q", "HEAD"]) !== "main") throw new Error("public clone is not on main");
  // Read everything first. Nothing is changed until the remote has answered.
  const listing = git(clone, ["ls-remote", "--tags", "origin"], { GIT_TERMINAL_PROMPT: "0" });
  const remoteTags = new Set(listing.split("\n").map((l) => /\trefs\/tags\/(.+?)(?:\^\{\})?$/.exec(l)?.[1]).filter(Boolean));
  const dropTags = git(clone, ["tag", "-l", "v*"]).split("\n").filter(Boolean).filter((t) => !remoteTags.has(t));
  const hasMain = tryGit(clone, ["rev-parse", "--verify", "-q", "refs/heads/main"]) !== null;
  const hasOrigin = tryGit(clone, ["rev-parse", "--verify", "-q", "refs/remotes/origin/main"]) !== null;
  const tips = [...(hasMain ? ["refs/heads/main"] : []), ...dropTags.map((t) => `refs/tags/${t}`)];
  const dropped = tips.length === 0 ? [] : git(clone, ["rev-list", ...tips, "--not", "--remotes=origin"]).split("\n").filter(Boolean);
  const droppedInfo = dropped.map((sha) => ({
    sha, tree: git1(clone, ["rev-parse", `${sha}^{tree}`]), subject: git1(clone, ["log", "-1", "--format=%s", sha]),
  }));

  const lines = [];
  for (const t of dropTags) { git(clone, ["tag", "-d", t]); lines.push(`removed tag ${t}`); }
  if (hasOrigin) {
    git(clone, ["reset", "-q", "--hard", "refs/remotes/origin/main"]);
    if (droppedInfo.length > 0) lines.push("put main back on origin/main");
  } else {
    if (hasMain) { git(clone, ["update-ref", "-d", "refs/heads/main"]); lines.push("made main unborn again (origin has no main)"); }
    git(clone, ["read-tree", "--empty"]);
  }
  git(clone, ["clean", "-fdxq"]);
  for (const { sha, tree, subject } of droppedInfo) {
    rmSync(stampPath(clone, tree), { force: true });
    lines.push(`dropped commit ${sha.slice(0, 7)} ${subject} and its stamp`);
  }
  if (lines.length === 0) lines.push("nothing to remove: the clone matches the remote");
  return lines;
}

const topFolder = (rel) => (rel.includes("/") ? `${rel.split("/")[0]}/` : "(top level)");

/** Plain text report. Simplified English, ASCII only. */
export function formatReport(r) {
  const L = [`Publish report for v${r.version || "?"} (seed ${r.seed})`, "", "Changes by folder:"];
  const groups = new Map();
  for (const kind of ["added", "changed", "removed"]) {
    for (const rel of r.changes[kind]) {
      const g = groups.get(topFolder(rel)) ?? { added: 0, changed: 0, removed: 0 };
      g[kind]++;
      groups.set(topFolder(rel), g);
    }
  }
  if (groups.size === 0) L.push("  none");
  for (const [dir, g] of [...groups].sort()) L.push(`  ${dir} ${g.added} added, ${g.changed} changed, ${g.removed} removed`);
  L.push("", "Checks:");
  for (const [k, v] of Object.entries(r.checks)) L.push(`  ${k}: ${v === "pass" ? "pass" : `FAIL, ${v}`}`);
  if (r.review) {
    const why = r.review.mode === "full" ? "full"
      : r.review.reviewed === r.review.total ? "every file is new or changed"
        : "changed since the last release, plus a sample";
    L.push(`Review: ${r.review.reviewed} of ${r.review.total} files (${why})`);
  }
  L.push(`Plants caught: ${r.plants.caught} of ${r.plants.total}`);
  L.push(`Blindness check: ${r.blindness === null ? "not run" : r.blindness ? "pass" : "FAIL"}`);
  L.push(`Reviewer cost: $${Number(r.cost).toFixed(2)}`);
  if (r.findings.length > 0) {
    L.push("", "Findings:");
    for (const f of r.findings) L.push(`  ${f.file} line ${f.line}: ${f.why}`);
  }
  if (r.reviewFindings.length > 0) {
    L.push("", "Review findings (they do not block; read them before you push):");
    for (const f of r.reviewFindings) L.push(`  ${f.file} line ${f.line}: ${f.why}`);
  }
  if (r.missed.length > 0) {
    L.push("", "Plants the reviewer missed:");
    for (const m of r.missed) L.push(`  ${m.file} line ${m.line} (${m.type})`);
  }
  if (r.waivers.length > 0) {
    L.push("", "Waivers used:");
    for (const w of r.waivers) L.push(`  ${w.file} line ${w.line}: ${w.why}`);
  }
  L.push("");
  if (!r.pass) L.push("Result: FAIL. Nothing was staged.");
  else if (r.dryRun) L.push("Result: PASS. Dry run, so nothing was staged.");
  else if (r.reviewFindings.length > 0) L.push(`Push v${r.version} to public ${r.name}? Read the ${r.reviewFindings.length} review finding(s) above first.`);
  else L.push(`Push v${r.version} to public ${r.name}?`);
  return L.join("\n");
}

async function main(argv) {
  const args = argv.slice(2);
  const usage = () => { console.error("Usage: node publish.mjs <privateRepo> [--dry-run] [--full] [--seed N]\n       node publish.mjs <privateRepo> --unstage"); return 2; };
  let dryRun = false;
  let full = false;
  let doUnstage = false;
  let seed;
  const repos = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") dryRun = true;
    else if (args[i] === "--full") full = true;
    else if (args[i] === "--unstage") doUnstage = true;
    else if (args[i] === "--seed") {
      seed = /^\d+$/.test(args[i + 1] ?? "") ? Number(args[++i]) : NaN;
      if (!Number.isSafeInteger(seed)) return usage();
    } else if (args[i].startsWith("--")) return usage();
    else repos.push(args[i]);
  }
  if (repos.length !== 1) return usage();
  const repo = repos[0];
  if (doUnstage) {
    if (dryRun || full || seed !== undefined) return usage();
    for (const line of unstage(path.resolve(repo))) console.log(line);
    return 0;
  }
  const report = await publish(path.resolve(repo), { dryRun, full, seed });
  console.log(formatReport(report));
  return report.pass ? 0 : 1;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv).then((code) => process.exit(code), (e) => { console.error(msg(e)); process.exit(1); });
}
