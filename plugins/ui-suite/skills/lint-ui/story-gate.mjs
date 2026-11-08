// One lint command for one Storybook story, across its data sets and themes.
//   npx -y -p lintapple@0.1.20 node ${CLAUDE_PLUGIN_ROOT}/skills/lint-ui/story-gate.mjs <storybook-url> <story-id>
//     [--data demo,worst,empty] [--data-global data] [--themes light,dark] [--theme-global theme]
//     [--ready '<selector>'] [--config ui-policy.json] [--widths 1280,1440]
// For each data set and theme it opens <storybook-url>/iframe.html?id=<story-id>&globals=<data>;<theme>
// and runs three checks there:
//   1. lintapple with --ready (default '#storybook-root > *'), re-run once if the first run does not finish;
//   2. the text-edge check (text-edge-auto.mjs) at the project's lint widths;
//   3. a hover-shift probe: hover each control and row, and count the hovers that move anything
//      outside the hovered element.
// It prints these three lines, then the details:
//   Passed: 0 UI findings across N story checks.   (or "Failed: N UI findings ...")
//   Text edges: 0 near-misses
//   Hover shifts: 0
// Exit 0 = all clean. 1 = findings. 2 = a check did not finish (not a pass).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPlaywright, lintWidths } from './shared.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const at = args.indexOf(name);
  return at >= 0 ? args.splice(at, 2)[1] : fallback;
};
const list = v => (v ? v.split(',').map(s => s.trim()).filter(Boolean) : [null]);
const dataSets = list(flag('--data'));
const dataGlobal = flag('--data-global', 'data');
const themes = list(flag('--themes'));
const themeGlobal = flag('--theme-global', 'theme');
const ready = flag('--ready', '#storybook-root > *');
const config = resolve(flag('--config', join(here, 'ui-policy.json')));
const widthsArg = flag('--widths');
const [base, story] = args;
const stop = msg => { console.error('Story gate: check did not finish. ' + msg); process.exit(2); };
if (!base || !story) stop('Usage: story-gate.mjs <storybook-url> <story-id> [--data a,b] [--themes light,dark] [--ready sel] [--config policy] [--widths px,px]');

const { widths, from: widthsFrom } = lintWidths(widthsArg, f => readFileSync(f, 'utf8'));
if (!widths.length) stop(`--widths needs pixel widths between 200 and 4000, like 1280,1440; got "${widthsArg}".`);
const pw = findPlaywright();
if (!pw) stop('Playwright not found. Run through: npx -y -p lintapple@0.1.20 node story-gate.mjs ...');

function storyUrl(data, theme) {
  const globals = [data && `${dataGlobal}:${data}`, theme && `${themeGlobal}:${theme}`].filter(Boolean).join(';');
  const u = new URL('iframe.html', base.endsWith('/') ? base : base + '/');
  u.searchParams.set('id', story);
  u.searchParams.set('viewMode', 'story');
  if (globals) u.searchParams.set('globals', globals);
  return u.href;
}

const run = (cmd, argv) => spawnSync(cmd, argv, { encoding: 'utf8', timeout: 300_000 });

function lintapple(url) {
  const argv = [url, '--config', config, '--ready', ready];
  let res = run('lintapple', argv);
  if (res.status !== 0 && res.status !== 1) res = run('lintapple', argv);  // a timeout or crash: once more
  const out = (res.stdout || '') + (res.stderr || '');
  const m = out.match(/^(Passed|Failed): (\d+) UI findings?/m);
  if (!m || (res.status !== 0 && res.status !== 1)) return { done: false, out };
  return { done: true, findings: Number(m[2]), out };
}

function textEdges(url) {
  const res = run(process.execPath, [join(here, 'text-edge-auto.mjs'), url, '--ready', ready, '--widths', widths.join(',')]);
  const out = (res.stdout || '') + (res.stderr || '');
  const m = out.match(/^Text edges: (\d+) near-miss/m);
  if (!m || (res.status !== 0 && res.status !== 1)) return { done: false, out };
  return { done: true, findings: Number(m[1]), out };
}

// Runs in the page: hover targets, and a snapshot of every element's box.
const PROBE = {
  targets: `(() => {
    const root = document.querySelector('#storybook-root') || document.body;
    const sel = 'button, a[href], [role=button], [role=menuitem], [role=tab], [role=row], tr, li, summary, [tabindex]:not([tabindex="-1"])';
    const els = [...root.querySelectorAll(sel)].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== 'hidden';
    }).slice(0, 80);
    els.forEach((el, i) => el.setAttribute('data-story-gate-hover', String(i)));
    return els.length;
  })()`,
  snapshot: `(hovered => {
    const root = document.querySelector('#storybook-root') || document.body;
    const skip = hovered == null ? null : document.querySelector('[data-story-gate-hover="' + hovered + '"]');
    const out = {};
    window.__storyGateNext = window.__storyGateNext || 0;
    for (const el of root.querySelectorAll('*')) {
      if (skip && skip.contains(el)) continue;
      const r = el.getBoundingClientRect();
      if (!el.dataset.storyGateId) el.dataset.storyGateId = String(window.__storyGateNext++);
      out[el.dataset.storyGateId] = [r.x, r.y, r.width, r.height];
    }
    return out;
  })`,
  describe: `((attr, id) => {
    const el = document.querySelector('[' + attr + '="' + id + '"]');
    if (!el) return '?';
    const text = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
    const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/)[0] : '';
    return el.tagName.toLowerCase() + cls + (text ? ' "' + text + '"' : '');
  })`,
};

async function hoverShifts(browser, url, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  try {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector(ready);
    await page.evaluate(() => document.fonts && document.fonts.ready);
    const count = await page.evaluate(PROBE.targets);
    const found = [];
    for (let i = 0; i < count; i++) {
      await page.mouse.move(0, 0);
      await page.waitForTimeout(250);
      const before = await page.evaluate(`${PROBE.snapshot}(${i})`);
      const target = page.locator(`[data-story-gate-hover="${i}"]`);
      try { await target.hover({ timeout: 2000, force: true }); } catch { continue; }
      await page.waitForTimeout(350);  // let hover transitions finish
      const after = await page.evaluate(`${PROBE.snapshot}(${i})`);
      const moved = Object.keys(before).filter(k => after[k] && before[k].some((v, j) => Math.abs(v - after[k][j]) > 0.5));
      if (moved.length) {
        // Name the smallest element that moved: a leaf says more than the card around it.
        const pick = moved.reduce((m, k) => (before[k][2] * before[k][3] < before[m][2] * before[m][3] ? k : m));
        const what = await page.evaluate(`${PROBE.describe}('data-story-gate-hover', ${i})`);
        const first = await page.evaluate(`${PROBE.describe}('data-story-gate-id', ${JSON.stringify(pick)})`);
        const [a, b] = [before[pick], after[pick]];
        found.push(`hovering ${what} moved ${moved.length} element${moved.length === 1 ? '' : 's'}, e.g. ${first} by ${(b[0] - a[0]).toFixed(1)},${(b[1] - a[1]).toFixed(1)}px (size ${(b[2] - a[2]).toFixed(1)}x${(b[3] - a[3]).toFixed(1)})`);
      }
    }
    return found;
  } finally {
    await page.close();
  }
}

let lintFindings = 0, lintChecks = 0, edgeFindings = 0, hoverFindings = 0;
const details = [];
let browser;
try {
  browser = await pw.chromium.launch();
  for (const data of dataSets) {
    for (const theme of themes) {
      const url = storyUrl(data, theme);
      const label = [data, theme].filter(Boolean).join(' / ') || 'default';
      const lint = lintapple(url);
      if (!lint.done) stop(`lintapple did not finish on ${label} (${url}):\n${lint.out.trim()}`);
      lintChecks++;
      lintFindings += lint.findings;
      if (lint.findings) details.push(`[${label}] lintapple:\n${lint.out.trim()}`);
      const edge = textEdges(url);
      if (!edge.done) stop(`the text-edge check did not finish on ${label} (${url}):\n${edge.out.trim()}`);
      edgeFindings += edge.findings;
      if (edge.findings) details.push(`[${label}] ${edge.out.trim()}`);
      for (const width of widths) {
        for (const line of await hoverShifts(browser, url, width)) {
          hoverFindings++;
          details.push(`[${label}] ${width}px  ${line}`);
        }
      }
    }
  }
} catch (e) {
  stop(String(e && e.message || e).split('\n')[0]);
} finally {
  if (browser) await browser.close();
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
console.log(`${lintFindings ? 'Failed' : 'Passed'}: ${plural(lintFindings, 'UI finding', 'UI findings')} across ${plural(lintChecks, 'story check', 'story checks')}.`);
console.log(`Text edges: ${plural(edgeFindings, 'near-miss', 'near-misses')}`);
console.log(`Hover shifts: ${hoverFindings}`);
console.log(`Story: ${story}; data: ${dataSets.filter(Boolean).join(', ') || 'default'}; themes: ${themes.filter(Boolean).join(', ') || 'default'}; widths: ${widths.join(', ')} (${widthsFrom})`);
for (const line of details) console.log(line);
process.exit(lintFindings || edgeFindings || hoverFindings ? 1 : 0);
