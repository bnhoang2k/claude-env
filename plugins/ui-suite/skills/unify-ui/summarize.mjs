// unify-ui: group style samples from every route into looks per role.
// Usage: node summarize.mjs samples.json [more.json ...]
// A role with more than one look is drift.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Height is part of a look only for controls. Cards, headings and textareas size to content.
const HEIGHT_ROLES = new Set(['button', 'input']);
const lookStyle = (role, style) => {
  if (HEIGHT_ROLES.has(role) || !('height' in style)) return style;
  const { height, ...rest } = style;
  return rest;
};

const signature = (style) => JSON.stringify(Object.keys(style).sort().map((k) => [k, style[k]]));

function diffProps(looks) {
  if (looks.length < 2) return [];
  return Object.keys(looks[0].style).filter((k) => new Set(looks.map((l) => l.style[k])).size > 1);
}

export function summarize(samples) {
  const roles = new Map();
  for (const sample of samples) {
    if (!roles.has(sample.role)) roles.set(sample.role, new Map());
    const looks = roles.get(sample.role);
    const style = lookStyle(sample.role, sample.style);
    const sig = signature(style);
    if (!looks.has(sig)) looks.set(sig, { style, count: 0, routes: new Set(), examples: [] });
    const look = looks.get(sig);
    look.count += 1;
    look.routes.add(sample.route);
    if (look.examples.length < 3) look.examples.push({ route: sample.route, selector: sample.selector, text: sample.text, box: sample.box, viewport: sample.viewport, dpr: sample.dpr, pageHeight: sample.pageHeight });
  }
  return [...roles]
    .map(([role, looks]) => {
      const list = [...looks.values()]
        .sort((a, b) => b.count - a.count)
        .map((l) => ({ ...l, routes: [...l.routes].sort() }));
      return { role, drift: list.length > 1, looks: list, diff: diffProps(list) };
    })
    .sort((a, b) => b.looks.length - a.looks.length || a.role.localeCompare(b.role));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const samples = process.argv.slice(2).flatMap((f) => JSON.parse(readFileSync(f, 'utf8')));
  for (const r of summarize(samples)) {
    const tail = r.drift ? `, differs in ${r.diff.join(', ')}` : '';
    console.log(`${r.drift ? 'DRIFT' : 'ok   '} ${r.role}: ${r.looks.length} look(s)${tail}`);
    if (!r.drift) continue;
    r.looks.forEach((l, i) => {
      const e = l.examples[0];
      const b = e.box ? ` box ${JSON.stringify(e.box)}` : '';
      const v = e.viewport ? ` vp ${e.viewport} ph ${e.pageHeight} dpr ${e.dpr}` : '';
      console.log(`  ${i + 1}. ${l.count}x on ${l.routes.join(', ')}, e.g. ${e.route} ${e.selector} "${e.text}"${b}${v}`);
    });
  }
}
