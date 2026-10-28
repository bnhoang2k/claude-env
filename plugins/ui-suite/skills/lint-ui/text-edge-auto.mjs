// Headless runner for text-edge-auto.js. Needs no marks on the page.
//   npx -y -p lintapple@0.1.20 node ${CLAUDE_PLUGIN_ROOT}/skills/lint-ui/text-edge-auto.mjs <url-or-html-path> [--ready '<selector>']
// Loads the page at 390px and 1440px wide (as lintapple does), runs the detector in each,
// prints the first line "Text edges: N near-misses", then the findings.
// Exit 0 = no near-misses. 1 = near-misses. 2 = the check did not finish (not a pass).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const readyAt = args.indexOf('--ready');
const ready = readyAt >= 0 ? args.splice(readyAt, 2)[1] : null;
const target = args[0];
const fail = msg => { console.error('Text edges: check did not finish. ' + msg); process.exit(2); };
if (!target) fail('Usage: text-edge-auto.mjs <url-or-html-path> [--ready <selector>]');

// Playwright comes from the lintapple package that `npx -p` puts on PATH, or from the npx cache.
function findPlaywright() {
  const roots = (process.env.PATH || '').split(':').filter(p => p.endsWith('node_modules/.bin')).map(p => dirname(p));
  const cache = join(homedir(), '.npm', '_npx');
  if (existsSync(cache)) for (const d of readdirSync(cache)) roots.push(join(cache, d, 'node_modules'));
  for (const root of roots) {
    if (!existsSync(join(root, 'playwright'))) continue;
    try { return createRequire(join(root, 'x.js'))('playwright'); } catch { /* try the next one */ }
  }
  return null;
}

const pw = findPlaywright();
if (!pw) fail('Playwright not found. Run through: npx -y -p lintapple@0.1.20 node text-edge-auto.mjs <page>');
const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(target) ? target : pathToFileURL(resolve(target)).href;
const source = readFileSync(join(here, 'text-edge-auto.js'), 'utf8');

let total = 0;
const report = [];
let browser;
try {
  browser = await pw.chromium.launch();
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(url, { waitUntil: 'load' });
    if (ready) await page.waitForSelector(ready);
    await page.evaluate(() => document.fonts && document.fonts.ready);
    const res = await page.evaluate(source);
    await page.close();
    if (!res || res.check !== 'textEdgeAutoV1') fail('The detector returned nothing.');
    total += res.findings.length;
    for (const f of res.findings) {
      report.push(`${width}px  ${f.container}: ${f.cause}; text starts at ${f.edges[0]}px and ${f.edges[1]}px (${f.offsetPx}px apart)`);
      for (const it of f.items) report.push(`    ${it.textLeft}px  ${it.element}  "${it.text}"`);
    }
  }
} catch (e) {
  fail(String(e && e.message || e).split('\n')[0]);
} finally {
  if (browser) await browser.close();
}
console.log(`Text edges: ${total} near-miss${total === 1 ? '' : 'es'}`);
for (const line of report) console.log(line);
process.exit(total ? 1 : 0);
