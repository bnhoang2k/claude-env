// Small helpers shared by the publish-public scripts.
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const NUM = "(?:0|[1-9]\\d*)";
const PRE_ID = `(?:${NUM}|\\d*[A-Za-z-][0-9A-Za-z-]*)`;
/** Regex source for a semver version. No anchors, so callers can embed it. */
export const SEMVER = `${NUM}\\.${NUM}\\.${NUM}(?:-${PRE_ID}(?:\\.${PRE_ID})*)?`;
/** The same, anchored: the whole string must be a version. */
export const SEMVER_RE = new RegExp(`^${SEMVER}$`);

/** True when a NUL byte sits in the first 8000 bytes. */
export function isBinary(file) {
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(8000);
    return buf.subarray(0, readSync(fd, buf, 0, 8000, 0)).includes(0);
  } finally {
    closeSync(fd);
  }
}

/**
 * Every file under root, as sorted POSIX relative paths.
 * A symlink counts as a file and is never followed, unless noSymlinks is set: then it throws.
 */
export function listFiles(root, { noSymlinks = false } = {}) {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      const rel = path.relative(root, full).split(path.sep).join("/");
      if (noSymlinks && e.isSymbolicLink()) throw new Error(`symlink in ${rel}`);
      if (e.isDirectory()) walk(full);
      else out.push(rel);
    }
  };
  walk(root);
  return out.sort();
}

/** The user's config folder: $PUBLISH_PUBLIC_HOME, or ~/.claude/publish-public. It holds the deny sets, plants and identity. */
export function configDir() {
  return process.env.PUBLISH_PUBLIC_HOME || path.join(homedir(), ".claude", "publish-public");
}

/** Throws the standard "not configured" error unless the config folder exists. Call it before anything reads the folder. */
export function assertConfigDir(dir = configDir()) {
  if (!existsSync(dir)) throw new Error(`no deny rules configured: ${dir} (copy data/deny.example.json there)`);
}

/** The one public identity, from <dir>/identity.json: { name, email }. Throws if the file is missing or odd. */
export function fixedIdentity(dir = configDir()) {
  const file = path.join(dir, "identity.json");
  let id;
  try {
    id = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`cannot read ${file}: ${e.message} (copy data/identity.example.json there and edit it)`);
  }
  if (!id || typeof id.name !== "string" || typeof id.email !== "string" || !id.name || !id.email) {
    throw new Error(`${file}: needs a string name and email`);
  }
  return { name: id.name, email: id.email };
}
