// Point a repo at the tool's hook folders through core.hooksPath.
//   node install-guards.mjs dev <repo>
//   node install-guards.mjs public <privateRepo>
// The hooks root defaults to <config folder>/hooks (~/.claude/publish-public/hooks, or under
// $PUBLISH_PUBLIC_HOME). PUBLISH_PUBLIC_HOOKS or --hooks-root <dir> overrides it.
// Each run also writes <config folder>/scripts-dir: the absolute path of the folder that holds this
// script. The guard hooks read that file to find devcheck.mjs and prepush.mjs, so the hooks keep a
// stable path while the skill folder may move.
import { execFileSync } from "node:child_process";
import { accessSync, constants, existsSync, mkdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readConfig } from "./export.mjs";
import { assertConfigDir, configDir } from "./util.mjs";

const SCRIPTS_DIR = path.dirname(realpathSync(fileURLToPath(import.meta.url)));

/** Records where the scripts are, for the guard hooks. Runs after the hooks are known to exist. */
function writeScriptsDir() {
  const home = configDir();
  mkdirSync(home, { recursive: true });
  writeFileSync(path.join(home, "scripts-dir"), `${SCRIPTS_DIR}\n`);
}

function git(repo, args) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** Throw unless every hook file exists and has the exec bit. Git runs no hooks from a folder that lacks them. */
function requireHooks(folder, names) {
  for (const name of names) {
    const file = path.join(folder, name);
    let ok = false;
    try {
      ok = statSync(file).isFile();
      accessSync(file, constants.X_OK);
    } catch {
      ok = false;
    }
    if (!ok) {
      throw new Error(`hook missing or not executable: ${file}. Copy the plugin's data/hooks/ folder into the config folder's hooks/ and make the files executable (nothing was set)`);
    }
  }
}

function setConfig(repo, pairs) {
  for (const [key, value] of pairs) {
    if (key === "core.hooksPath") {
      let old = "";
      try { old = git(repo, ["config", "--get", key]); } catch { /* unset */ }
      if (old && old !== value) console.log(`replacing old ${key} = ${old}`);
    }
    git(repo, ["config", key, value]);
    console.log(`set ${key} = ${value}`);
  }
}

function isGitRepo(dir) {
  try {
    return git(dir, ["rev-parse", "--is-inside-work-tree"]) === "true"
      && realpathSync(git(dir, ["rev-parse", "--show-toplevel"])) === realpathSync(dir);
  } catch {
    return false;
  }
}

export function installDev(repo, hooksRoot) {
  assertConfigDir();
  if (!isGitRepo(repo)) throw new Error(`not a git repo: ${repo}`);
  requireHooks(path.join(hooksRoot, "dev"), ["pre-commit", "commit-msg"]);
  writeScriptsDir();
  setConfig(repo, [["core.hooksPath", path.join(hooksRoot, "dev")]]);
}

export function installPublic(privateRepo, hooksRoot) {
  assertConfigDir();
  const { public: pub, identity } = readConfig(privateRepo);
  requireHooks(path.join(hooksRoot, "public"), ["pre-push"]);
  writeScriptsDir();
  const clone = pub.clone; // readConfig already resolved it
  if (!existsSync(clone)) {
    execFileSync("git", ["clone", pub.remote, clone], { stdio: ["ignore", "inherit", "inherit"] });
    console.log(`cloned ${pub.remote} into ${clone}`);
  } else {
    if (!isGitRepo(clone)) throw new Error(`${clone} exists but is not a git repo`);
    let origin;
    try { origin = git(clone, ["remote", "get-url", "origin"]); } catch { origin = "(no origin)"; }
    if (origin !== pub.remote) {
      throw new Error(`${clone} has origin ${origin}, not ${pub.remote}`);
    }
  }
  setConfig(clone, [
    ["core.hooksPath", path.join(hooksRoot, "public")],
    ["user.name", identity.name],
    ["user.email", identity.email],
    ["publish.identity", `${identity.name} <${identity.email}>`],
    ["commit.gpgsign", "false"],
    ["tag.gpgsign", "false"],
  ]);
}

function main(argv) {
  const args = [...argv];
  let hooksRoot = process.env.PUBLISH_PUBLIC_HOOKS || path.join(configDir(), "hooks");
  const i = args.indexOf("--hooks-root");
  if (i >= 0) {
    hooksRoot = args[i + 1];
    args.splice(i, 2);
  }
  const [mode, repo] = args;
  if (!hooksRoot || !repo || args.length !== 2 || !["dev", "public"].includes(mode)) {
    throw new Error("usage: install-guards.mjs dev|public <repo> [--hooks-root <dir>]");
  }
  hooksRoot = path.resolve(hooksRoot);
  if (mode === "dev") installDev(path.resolve(repo), hooksRoot);
  else installPublic(path.resolve(repo), hooksRoot);
}

// realpath: node resolves symlinks (macOS /var -> /private/var) in import.meta.url but not in argv.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`install-guards: ${e.message}`);
    process.exitCode = 1;
  }
}
