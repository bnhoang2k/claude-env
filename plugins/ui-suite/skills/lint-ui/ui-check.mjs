// One lint command for one or more pages: lintapple and the text-edge check, in one go.
//   npx -y -p lintapple@0.1.20 node ${CLAUDE_PLUGIN_ROOT}/skills/lint-ui/ui-check.mjs <page.html | url> [more ...]
//     [--config ui-policy.json] [--ready '<selector>'] [--widths 1280,1440]
// An .html path is served from its own folder by a file server inside this command, so there
// is no server to start, wait for or stop. A URL (an app's dev server, a state such as
// ?data=worst) is used as it is. Pass every changed page and state in one run.
// Policy: --config, else ui-policy.json next to the first page, else in the current folder,
// else this skill's default (a line says so: copy it and set fonts and fontSizes).
// It prints these two lines first, then the details:
//   Passed: 0 UI findings across N page checks.   (or "Failed: N UI findings ...")
//   Text edges: 0 near-misses
// Exit 0 = both clean. 1 = findings. 2 = a check did not finish (not a pass).
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { basename, dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : fallback;
};
const stop = msg => { console.log(`Failed: lint did not finish. ${msg}`); console.log('Text edges: check did not finish'); process.exit(2); };

const ready = flag('--ready');
const widths = flag('--widths');
const configFlag = flag('--config');
const targets = args.filter(a => !a.startsWith('--'));
if (!targets.length) stop('Usage: ui-check.mjs <page.html | url> [more ...] [--config policy] [--ready sel] [--widths px,px]');
const isUrl = t => /^[a-z][a-z0-9+.-]*:\/\//i.test(t);

function pickConfig() {
  if (configFlag) return { path: resolve(configFlag), note: '' };
  const first = targets.find(t => !isUrl(t));
  for (const dir of [first && dirname(resolve(first)), process.cwd()].filter(Boolean)) {
    const p = join(dir, 'ui-policy.json');
    if (existsSync(p)) return { path: p, note: '' };
  }
  return { path: join(here, 'ui-policy.json'),
           note: "Policy: this skill's default ui-policy.json. Copy it next to the page and set fonts and fontSizes to the project's." };
}
const config = pickConfig();

const TYPES = { '.html': 'text/html', '.htm': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.ico': 'image/x-icon' };

// One server per folder that holds a page, each on a free port.
async function serve(root) {
  const server = createServer((req, res) => {
    const path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const file = existsSync(path) && statSync(path).isDirectory() ? join(path, 'index.html') : path;
    if (!existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  await new Promise((ok, bad) => server.once('error', bad).listen(0, '127.0.0.1', ok));
  return server;
}

const run = (cmd, argv) => new Promise(done => {
  const child = spawn(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  const timer = setTimeout(() => child.kill('SIGKILL'), 300_000);
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  child.on('error', e => { clearTimeout(timer); done({ status: null, out: out + String(e.message) }); });
  child.on('close', status => { clearTimeout(timer); done({ status, out }); });
});

async function lintapple(url) {
  const argv = [url, '--config', config.path, ...(ready ? ['--ready', ready] : [])];
  let res = await run('lintapple', argv);
  if (res.status !== 0 && res.status !== 1) res = await run('lintapple', argv);  // a timeout or crash: once more
  const m = res.out.match(/^(Passed|Failed): (\d+) UI findings? across (\d+)/m);
  if (!m || (res.status !== 0 && res.status !== 1)) return { done: false, out: res.out };
  return { done: true, findings: Number(m[2]), checks: Number(m[3]), out: res.out };
}

async function textEdges(url) {
  const argv = [join(here, 'text-edge-auto.mjs'), url, ...(ready ? ['--ready', ready] : []),
                ...(widths ? ['--widths', widths] : [])];
  const res = await run(process.execPath, argv);
  const m = res.out.match(/^Text edges: (\d+) near-miss/m);
  if (!m || (res.status !== 0 && res.status !== 1)) return { done: false, out: res.out };
  const used = (res.out.match(/^Widths: .*$/m) || [''])[0];
  return { done: true, findings: Number(m[1]), out: res.out, used };
}

const servers = new Map();
async function urlFor(target) {
  if (isUrl(target)) return target;
  const file = resolve(target);
  if (!existsSync(file)) stop(`No such page: ${target}`);
  const root = dirname(file);
  if (!servers.has(root)) servers.set(root, await serve(root));
  return `http://127.0.0.1:${servers.get(root).address().port}/${encodeURIComponent(basename(file))}`;
}

let lintFindings = 0, lintChecks = 0, edgeFindings = 0, widthsLine = '';
const details = [];
try {
  for (const target of targets) {
    const url = await urlFor(target);
    const [lint, edge] = await Promise.all([lintapple(url), textEdges(url)]);
    if (!lint.done) stop(`lintapple did not finish on ${target}:\n${lint.out.trim()}`);
    if (!edge.done) stop(`the text-edge check did not finish on ${target}:\n${edge.out.trim()}`);
    lintFindings += lint.findings;
    lintChecks += lint.checks;
    edgeFindings += edge.findings;
    widthsLine = edge.used || widthsLine;
    if (lint.findings) details.push(`[${target}] lintapple:\n${lint.out.trim()}`);
    if (edge.findings) details.push(`[${target}] ${edge.out.trim()}`);
  }
} finally {
  for (const s of servers.values()) s.close();
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
console.log(`${lintFindings ? 'Failed' : 'Passed'}: ${plural(lintFindings, 'UI finding', 'UI findings')} across ${plural(lintChecks, 'page check', 'page checks')}.`);
console.log(`Text edges: ${plural(edgeFindings, 'near-miss', 'near-misses')}`);
console.log(`Pages: ${targets.join(', ')}`);
if (widthsLine) console.log(`Text-edge ${widthsLine.charAt(0).toLowerCase()}${widthsLine.slice(1)}`);
if (config.note) console.log(config.note);
for (const line of details) console.log(line);
process.exit(lintFindings || edgeFindings ? 1 : 0);
