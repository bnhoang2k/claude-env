// Pre-push hook logic for the public clone. Reads git's pre-push stdin and
// refuses (exit 1, one reason per line on stderr) anything that has no passing
// stamp for its tree, a wrong author or committer, an off-template commit
// message, a ref other than main or a version tag, or an annotated tag (the tool
// makes lightweight tags only). Fails closed on any error.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readStamp } from './stamp.mjs';
import { loadRules, scanText } from './deny.mjs';
import { SEMVER, fixedIdentity } from './util.mjs';

const ZERO = /^0+$/;
const TAG_REF_RE = new RegExp(`^refs/tags/v${SEMVER}$`);
const MESSAGE_RE = new RegExp(`^Release v${SEMVER}(?: \\(built dist\\))?\\n?$`);

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  return { status: r.status, out: r.stdout, err: r.stderr };
}

function gitOut(args) {
  const r = git(args);
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.err.trim()}`);
  return r.out.replace(/\n$/, '');
}

function parseIdentity(text) {
  const m = /^(\S.*?) <([^<>\s]+)>$/.exec(text.trim());
  return m ? { name: m[1], email: m[2] } : null;
}

function matches(id, name, email) {
  return name === id.name && email === id.email;
}

function checkCommit(sha, id, cwd, reasons) {
  const short = sha.slice(0, 7);
  const tree = gitOut(['rev-parse', `${sha}^{tree}`]);
  const stamp = readStamp(cwd, tree);
  if (!stamp || stamp.pass !== true) {
    reasons.push(`refused ${short}: no stamp for tree ${tree.slice(0, 12)}`);
  }
  const f = gitOut(['show', '-s', '--format=%an%x00%ae%x00%cn%x00%ce', sha]).split('\0');
  if (!matches(id, f[0], f[1])) {
    reasons.push(`refused ${short}: identity: author is ${f[0]} <${f[1]}>`);
  }
  if (!matches(id, f[2], f[3])) {
    reasons.push(`refused ${short}: identity: committer is ${f[2]} <${f[3]}>`);
  }
  const cat = git(['cat-file', 'commit', sha]);
  if (cat.status !== 0) {
    reasons.push(`refused ${short}: message: cannot read the commit`);
    return;
  }
  const raw = cat.out;
  const at = raw.indexOf('\n\n');
  const message = at === -1 ? '' : raw.slice(at + 2);
  if (!MESSAGE_RE.test(message)) {
    reasons.push(`refused ${short}: message is not "Release vX.Y.Z" or "Release vX.Y.Z (built dist)"`);
  }
}

// Only main and version tags may be pushed. The object type decides what a push holds, never the ref name.
function checkRef(localSha, remoteRef, id, cwd, reasons) {
  const isTag = TAG_REF_RE.test(remoteRef);
  if (remoteRef !== 'refs/heads/main' && !isTag) {
    reasons.push(`refused ${remoteRef}: ref: only refs/heads/main and refs/tags/vX.Y.Z may be pushed`);
    return;
  }
  if (ZERO.test(localSha)) return; // a deletion pushes no commits
  const label = isTag ? remoteRef.replace('refs/tags/', 'tag ') : 'main';
  const type = gitOut(['cat-file', '-t', localSha]);
  if (type === 'tag') {
    reasons.push(`refused ${label}: ref: annotated tags are not allowed, push a lightweight tag`);
    return;
  }
  if (type !== 'commit') {
    reasons.push(`refused ${label}: ref: the pushed object is not a commit`);
    return;
  }
  const commits = new Set();
  // Always check the tagged commit, even when the remote already has it.
  if (isTag) commits.add(localSha);
  const listed = gitOut(['rev-list', localSha, '--not', '--remotes=origin']);
  for (const sha of listed.split('\n').filter(Boolean)) commits.add(sha);
  for (const sha of commits) checkCommit(sha, id, cwd, reasons);
}

function main() {
  const identityText = git(['config', '--get', 'publish.identity']);
  const id = identityText.status === 0 ? parseIdentity(identityText.out) : null;
  if (!id) {
    console.error('refused: identity: publish.identity is unset or not "Name <email>"');
    return 1;
  }
  const fixed = fixedIdentity();
  const expected = `${fixed.name} <${fixed.email}>`;
  if (!matches(id, fixed.name, fixed.email)) {
    console.error(`refused: identity: publish.identity is not ${expected}`);
    return 1;
  }
  // The public clone has no publish.json (it is never exported), so it cannot name deny sets. The identity
  // text is checked against the base set, which every repo uses.
  const denied = scanText(expected, loadRules(['base']));
  if (denied.length > 0) {
    console.error(`refused: identity: the identity text hits the deny list (${denied.map((h) => h.rule).join(', ')})`);
    return 1;
  }
  const cwd = process.cwd();
  const reasons = [];
  const lines = readFileSync(0, 'utf8').split('\n').filter((l) => l.trim());
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 4) {
      reasons.push(`refused: unreadable push line: ${line}`);
      continue;
    }
    const [, localSha, remoteRef] = parts;
    checkRef(localSha, remoteRef, id, cwd, reasons);
  }
  if (reasons.length === 0) return 0;
  console.error(reasons.join('\n'));
  return 1;
}

// Set the exit code and return, so stderr is flushed before the process ends.
try {
  process.exitCode = main();
} catch (e) {
  console.error(`refused: hook error: ${e.message}`);
  process.exitCode = 1;
}
