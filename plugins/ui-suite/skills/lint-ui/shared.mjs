// Shared by text-edge-auto.mjs and story-gate.mjs.
// findPlaywright: Playwright comes from the lintapple package
// that `npx -p lintapple@0.1.20` puts on PATH, or from the npx cache.
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export function findPlaywright() {
  const roots = (process.env.PATH || '').split(':').filter(p => p.endsWith('node_modules/.bin')).map(p => dirname(p));
  const cache = join(homedir(), '.npm', '_npx');
  if (existsSync(cache)) for (const d of readdirSync(cache)) roots.push(join(cache, d, 'node_modules'));
  for (const root of roots) {
    if (!existsSync(join(root, 'playwright'))) continue;
    try { return createRequire(join(root, 'x.js'))('playwright'); } catch { /* try the next one */ }
  }
  return null;
}

// The project's lint widths: --widths, else a "Lint widths: 1280, 1440" line in the nearest
// DESIGN.md (root or docs/) from the current folder up, else 390 and 1440.
const WIDTHS_LINE = /^[\s>*-]*(?:\*\*)?Lint widths(?:\*\*)?:\s*(.+)$/im;
export const parseWidths = text => (text.match(/\d+/g) || []).map(Number).filter(n => n >= 200 && n <= 4000);

export function lintWidths(flag, readFile) {
  if (flag != null) return { widths: parseWidths(flag), from: '--widths' };
  for (let dir = process.cwd(); ; dir = dirname(dir)) {
    for (const f of [join(dir, 'DESIGN.md'), join(dir, 'docs', 'DESIGN.md')]) {
      if (!existsSync(f)) continue;
      const m = readFile(f).match(WIDTHS_LINE);
      if (m && parseWidths(m[1]).length) return { widths: parseWidths(m[1]), from: f };
    }
    if (dirname(dir) === dir) return { widths: [390, 1440], from: 'default' };
  }
}
