#!/usr/bin/env node
// Builds the dashboard page as an Artifact fragment (the Artifact tool wraps it in a document).
//
//   node build_page.mjs publish <out.html>
//       Live page: no data baked in. It subscribes to the project's Artifact database.
//   node build_page.mjs snapshot <out.html> --data <dir> --now <iso>
//       Saved copy: the docs in <dir>/<collection>/<doc_id>.json are baked in. Each file is
//       {id, data, version?, updatedAt?} (an ArtifactData dump) or a bare body.
//
// Fragment order: <title>, <style> (page.css), body markup (page.html), then for a snapshot
// the data as <script type="application/json">, then one <script> with fold.js, view.js and
// render.js in that order.
//
// Publish the live page with exactly CAPABILITIES (printed by `publish`). Every collection
// is readable by viewers and writable only at admin level (the owner and editors): agents
// write as the owner's own account, and the page itself writes only `archive`. setup.md
// repeats this declaration; a test keeps the two equal.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, '..', 'assets');
export const COLLECTIONS = ['meta', 'claims', 'events', 'plans', 'pointers', 'direction', 'evidence', 'checks', 'archive', 'subplans'];
export const CAPABILITIES = {
  db: { rules: COLLECTIONS.map(c => ({ path: c, read: 'view', write: 'admin' })) },
  user: {},
  assets: {},
};
const WRAPPER_KEYS = new Set(['id', 'data', 'version', 'updatedAt', 'createdAt', 'path']);

function read(name) { return fs.readFileSync(path.join(ASSETS, name), 'utf8'); }

function isWrapper(obj) {
  return obj && typeof obj === 'object' && !Array.isArray(obj) &&
    obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data) &&
    Object.keys(obj).every(k => WRAPPER_KEYS.has(k));
}

// Read an out_dir dump into {collection: [{id, data, version?, updatedAt?}]}.
export function loadDumpDir(dir) {
  const out = {};
  for (const c of COLLECTIONS) {
    const cdir = path.join(dir, c);
    out[c] = [];
    if (!fs.existsSync(cdir)) continue;
    for (const f of fs.readdirSync(cdir).filter(f => f.endsWith('.json')).sort()) {
      const raw = JSON.parse(fs.readFileSync(path.join(cdir, f), 'utf8'));
      const fileId = f.slice(0, -'.json'.length);
      if (isWrapper(raw)) {
        const doc = { id: typeof raw.id === 'string' ? raw.id : fileId, data: raw.data };
        if (raw.version != null) doc.version = raw.version;
        if (raw.updatedAt != null) doc.updatedAt = raw.updatedAt;
        out[c].push(doc);
      } else {
        out[c].push({ id: fileId, data: raw });
      }
    }
  }
  return out;
}

function inlineScript() {
  const src = ['fold.js', 'view.js', 'render.js'].map(read).join('\n;\n');
  if (/<\/script/i.test(src)) throw new Error('an inlined script contains a closing script tag');
  return '<script>\n' + src + '\n</script>\n';
}

function shell(dataTag) {
  return [
    '<title>Project dashboard</title>\n',
    '<meta name="claude:viewport-fit-sides" content="cover">\n',
    '<style>\n' + read('page.css') + '\n</style>\n',
    read('page.html'),
    dataTag || '',
    inlineScript(),
  ].join('');
}

export function buildPublish() { return shell(''); }

export function buildSnapshot(collections, nowIso) {
  if (isNaN(Date.parse(nowIso))) throw new Error('--now must be an ISO time');
  const json = JSON.stringify({ now: new Date(Date.parse(nowIso)).toISOString(), collections }).replace(/</g, '\\u003c');
  return shell('<script type="application/json" id="dashboard-data">' + json + '</script>\n');
}

function main(argv) {
  const [mode, out, ...rest] = argv;
  const opt = name => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
  if (!out || (mode !== 'publish' && mode !== 'snapshot')) {
    console.error('usage: build_page.mjs publish <out.html>\n       build_page.mjs snapshot <out.html> --data <dir> --now <iso>');
    return 2;
  }
  let html;
  if (mode === 'publish') html = buildPublish();
  else {
    const dir = opt('--data');
    const now = opt('--now');
    if (!dir || !now) { console.error('snapshot needs --data <dir> and --now <iso>'); return 2; }
    html = buildSnapshot(loadDumpDir(dir), now);
  }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`wrote ${out} (${mode}, ${html.length} bytes)`);
  if (mode === 'publish') console.log('capabilities: ' + JSON.stringify(CAPABILITIES));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
