// Headless runner for text-edge-auto.js. Needs no marks on the page.
//   npx -y -p lintapple@0.1.20 node ${CLAUDE_PLUGIN_ROOT}/skills/lint-ui/text-edge-auto.mjs <url-or-html-path> [--ready '<selector>'] [--widths 1280,1440]
// Checks left text edges of stacked blocks and right text edges of blocks at the end of a row.
// Loads the page at each width, runs the detector in each, prints the first line
// "Text edges: N near-misses", then the findings, then the widths it used and where they came from.
// Widths: --widths, else a "Lint widths: 1280, 1440" line in the project's DESIGN.md (root or docs/,
// found from the current folder upward), else 390 and 1440 (as lintapple's default policy does).
// Exit 0 = no near-misses. 1 = near-misses. 2 = the check did not finish (not a pass).
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findPlaywright, lintWidths } from './shared.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const readyAt = args.indexOf('--ready');
const ready = readyAt >= 0 ? args.splice(readyAt, 2)[1] : null;
const widthsAt = args.indexOf('--widths');
const widthsArg = widthsAt >= 0 ? args.splice(widthsAt, 2)[1] : null;
const target = args[0];
const fail = msg => { console.error('Text edges: check did not finish. ' + msg); process.exit(2); };
if (!target) fail('Usage: text-edge-auto.mjs <url-or-html-path> [--ready <selector>] [--widths <px,px>]');

const { widths, from: widthsFrom } = lintWidths(widthsArg, f => readFileSync(f, 'utf8'));
if (!widths.length) fail(`--widths needs pixel widths between 200 and 4000, like 1280,1440; got "${widthsArg}".`);

const pw = findPlaywright();
if (!pw) fail('Playwright not found. Run through: npx -y -p lintapple@0.1.20 node text-edge-auto.mjs <page>');
const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(target) ? target : pathToFileURL(resolve(target)).href;
const source = readFileSync(join(here, 'text-edge-auto.js'), 'utf8');

let total = 0;
const report = [];
let browser;
try {
  browser = await pw.chromium.launch();
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(url, { waitUntil: 'load' });
    if (ready) await page.waitForSelector(ready);
    await page.evaluate(() => document.fonts && document.fonts.ready);
    const res = await page.evaluate(source);
    await page.close();
    if (!res || res.check !== 'textEdgeAutoV1') fail('The detector returned nothing.');
    total += res.findings.length;
    for (const f of res.findings) {
      const verb = f.side === 'right' ? 'ends' : 'starts';
      report.push(`${width}px  ${f.container}: ${f.cause}; text ${verb} at ${f.edges[0]}px and ${f.edges[1]}px (${f.offsetPx}px apart)`);
      for (const it of f.items) report.push(`    ${f.side === 'right' ? it.textRight : it.textLeft}px  ${it.element}  "${it.text}"`);
    }
  }
} catch (e) {
  fail(String(e && e.message || e).split('\n')[0]);
} finally {
  if (browser) await browser.close();
}
console.log(`Text edges: ${total} near-miss${total === 1 ? '' : 'es'}`);
for (const line of report) console.log(line);
console.log(`Widths: ${widths.join(', ')} (${widthsFrom})`);
process.exit(total ? 1 : 0);
