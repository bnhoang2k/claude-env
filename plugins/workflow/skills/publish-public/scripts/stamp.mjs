// Stamps: one JSON file per exact git tree that passed every publish check.
// Stored at <git-dir>/publish-stamps/<tree>.json inside the public clone.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TREE_RE = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

function stampDir(clone) {
  const r = spawnSync('git', ['rev-parse', '--absolute-git-dir'], {
    cwd: clone, encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`not a git repository: ${clone}`);
  return join(r.stdout.trim(), 'publish-stamps');
}

function checkTree(tree) {
  if (typeof tree !== 'string' || !TREE_RE.test(tree)) {
    throw new Error(`not a tree hash: ${String(tree)}`);
  }
}

// Where the stamp for this tree lives (it may not exist yet).
export function stampPath(clone, tree) {
  checkTree(tree);
  return join(stampDir(clone), `${tree}.json`);
}

export function writeStamp(clone, tree, result) {
  checkTree(tree);
  if (!result || result.pass !== true) {
    throw new Error('refusing to write a stamp unless pass is true');
  }
  const dir = stampDir(clone);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${tree}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(result, null, 2)}\n`);
  renameSync(tmp, file);
}

// Returns the stamp, or null when there is none or it cannot be read.
export function readStamp(clone, tree) {
  if (typeof tree !== 'string' || !TREE_RE.test(tree)) return null;
  try {
    return JSON.parse(readFileSync(join(stampDir(clone), `${tree}.json`), 'utf8'));
  } catch {
    return null;
  }
}
