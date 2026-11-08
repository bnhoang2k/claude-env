// Reads the "## UI system" block from the nearest DESIGN.md at or above a folder.
// Paths in the block are relative to that DESIGN.md.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const FIELDS = {
  Stack: 'stack',
  'Token home': 'tokenHome',
  'Component home': 'componentHome',
  Catalog: 'catalog',
  Preset: 'preset',
};

export function findDesign(start) {
  let dir = resolve(start);
  for (;;) {
    const file = join(dir, 'DESIGN.md');
    if (existsSync(file)) return file;
    if (existsSync(join(dir, '.git')) || dirname(dir) === dir) return null;
    dir = dirname(dir);
  }
}

export function parseUiSystem(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.trim() === '## UI system');
  if (start === -1) return null;
  const out = {};
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*$/);
    if (!m || !FIELDS[m[1]]) continue;
    const value = m[2].replace(/`/g, '').trim();
    if (value && !value.startsWith('<!--')) out[FIELDS[m[1]]] = value;
  }
  return out;
}

export function readUiSystem(start) {
  const file = findDesign(start);
  if (!file) {
    throw new Error(`No DESIGN.md at or above ${start}. Add one that holds a "## UI system" block.`);
  }
  const ui = parseUiSystem(readFileSync(file, 'utf8'));
  if (!ui) {
    throw new Error(`No "## UI system" heading in ${file}. Add a "## UI system" block with a Token home and a Component home.`);
  }
  const missing = ['Token home', 'Component home'].filter((name) => !ui[FIELDS[name]]);
  if (missing.length) {
    throw new Error(`${file}: the "## UI system" block has no ${missing.join(' or ')}. Fill it in.`);
  }
  return { ...ui, root: dirname(file) };
}
