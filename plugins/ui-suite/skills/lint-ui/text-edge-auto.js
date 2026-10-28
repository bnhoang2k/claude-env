// Automatic text-edge check. Needs no data-ui-align marks. Finds text blocks stacked in
// one column whose left text edges almost line up: more than 1px apart, at most 32px.
// That is the "pushed out of line by an icon, dot or padding" fault.
// Run it in the browser pane with javascript_tool (paste the whole file), or headless
// with text-edge-auto.mjs. Returns { check, line, findings }; `line` is the one line to
// keep in the report: "Text edges: 0 near-misses" on success.
// Ignored on purpose: centered and right-aligned text, text-indent, list markers,
// svg text, and an indent that repeats (two or more blocks on each side) with no
// icon in the gap and no nested list or quote behind it.
(() => {
  const TOL = 1, MAX = 32, STACK = 48;
  const cs = e => getComputedStyle(e);
  const sel = e => {
    const id = e.id ? '#' + e.id : '';
    const cls = typeof e.className === 'string' && e.className.trim()
      ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return e.tagName.toLowerCase() + id + cls;
  };
  const isBlockBox = e => { const d = cs(e).display; return d !== 'inline' && d !== 'contents' && d !== 'none'; };
  const blockOf = n => { let e = n.parentElement; while (e && !isBlockBox(e)) e = e.parentElement; return e; };
  const shown = e => {
    if (e.checkVisibility) return e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    return cs(e).visibility !== 'hidden';
  };
  const CENTER = /^(center|flex-end|end|right|space-around|space-evenly|space-between)$/;
  const pushedRight = b => {
    for (let e = b, i = 0; e && i < 4; e = e.parentElement, i++) {
      const s = cs(e);
      if (/^(center|right|end|-webkit-center|-webkit-right)$/.test(s.textAlign)) return true;
      // Only the horizontal axis moves a left edge: justify-* in a row, align-* in a column.
      const col = /column/.test(s.flexDirection);
      if (/flex/.test(s.display) && CENTER.test(col ? s.alignItems : s.justifyContent)) return true;
      if (/grid/.test(s.display) && [s.justifyContent, s.justifyItems].some(v => CENTER.test(v))) return true;
      const ps = e.parentElement && cs(e.parentElement);
      if (ps && /flex/.test(ps.display) && /column/.test(ps.flexDirection) && CENTER.test(s.alignSelf)) return true;
      if (ps && /grid/.test(ps.display) && CENTER.test(s.justifySelf)) return true;
    }
    const r = b.getBoundingClientRect(), p = b.parentElement && b.parentElement.getBoundingClientRect();
    if (!p) return false;
    const L = r.left - p.left, R = p.right - r.right;
    return L > 4 && R > 4 && Math.abs(L - R) <= 2;  // margin: auto
  };

  // 1. One entry per text block: the left edge of its first line.
  const blocks = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('svg,script,style,noscript,template,textarea,select,option') || !shown(el)) continue;
    const b = blockOf(n);
    if (!b) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    const lines = [...r.getClientRects()].filter(x => x.width > 0 && x.height > 0)
      .sort((a, c) => a.top - c.top || a.left - c.left);
    if (!lines.length) continue;
    const line = lines[0], cur = blocks.get(b);
    if (!cur || line.top < cur.top - 2 || (Math.abs(line.top - cur.top) <= 2 && line.left < cur.left)) {
      blocks.set(b, { el: b, left: line.left, top: line.top, bottom: line.bottom, right: line.right,
                      text: n.nodeValue.trim().slice(0, 40) });
    }
  }
  const items = [];
  for (const it of blocks.values()) {
    const s = cs(it.el);
    if (it.right < 0 || it.left > innerWidth) continue;
    if (parseFloat(s.textIndent) !== 0 || pushedRight(it.el)) continue;
    if (s.display === 'list-item' && s.listStylePosition === 'inside' && s.listStyleType !== 'none') {
      it.left = it.el.getBoundingClientRect().left + parseFloat(s.paddingLeft) + parseFloat(s.borderLeftWidth);
    }
    it.left = Math.round(it.left * 10) / 10;
    items.push(it);
  }

  // 2. Per container, deepest first: group the edges, compare neighbouring groups.
  const depth = e => { let d = 0; for (; e; e = e.parentElement) d++; return d; };
  const containers = [...document.body.querySelectorAll('*')].concat(document.body)
    .map(e => ({ e, d: depth(e) })).sort((a, b) => b.d - a.d).map(x => x.e);
  const stacked = (a, b) => {
    const gap = Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom);
    return gap >= -2 && gap <= STACK && !(a.top < b.bottom - 2 && b.top < a.bottom - 2);
  };
  const SEMANTIC = 'ul ul,ol ol,ul ol,ol ul,blockquote,dd,[role=group],[role=tree]';
  const hasLeadObject = (it, edge) => {
    const host = it.el.parentElement || it.el;
    const hit = [...host.querySelectorAll('*')].some(o => {
      if (o === it.el || it.el.contains(o) && o.textContent.trim()) return false;
      if (o.textContent.trim() && !/^(svg|img|i)$/i.test(o.tagName)) return false;
      const r = o.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.right <= edge + TOL && r.left >= edge - MAX - TOL
        && r.top < it.bottom && r.bottom > it.top;
    });
    const pseudo = [it.el, host].some(x => {
      const b = getComputedStyle(x, '::before');
      return b.content !== 'none' && b.content !== 'normal' && b.position !== 'absolute';
    });
    return hit || pseudo;
  };

  const reported = new Set(), findings = [];
  for (const C of containers) {
    const inside = items.filter(it => C.contains(it.el));
    if (inside.length < 2) continue;
    const sorted = inside.slice().sort((a, b) => a.left - b.left);
    const groups = [];
    for (const it of sorted) {
      const g = groups[groups.length - 1];
      if (g && it.left - g.items[g.items.length - 1].left <= TOL) g.items.push(it);
      else groups.push({ items: [it] });
    }
    for (let i = 0; i + 1 < groups.length; i++) {
      const lo = groups[i], hi = groups[i + 1];
      const edge = (g) => g.items[0].left;
      const gap = edge(hi) - edge(lo);
      if (gap <= TOL || gap > MAX) continue;
      if (!lo.items.some(a => hi.items.some(b => stacked(a, b)))) continue;
      const all = lo.items.concat(hi.items);
      if (all.every(x => reported.has(x.el))) continue;
      const lone = Math.min(lo.items.length, hi.items.length) === 1;
      const withObject = hi.items.some(x => hasLeadObject(x, edge(hi)));
      const nested = hi.items.every(x => { const a = x.el.closest(SEMANTIC); return a && C.contains(a); });
      if (nested || !(lone || withObject)) continue;
      all.forEach(x => reported.add(x.el));
      findings.push({
        container: sel(C),
        edges: [edge(lo), edge(hi)],
        offsetPx: Math.round(gap * 10) / 10,
        cause: withObject ? 'something sits before the text' : 'text starts at a different edge',
        items: all.map(x => ({ text: x.text, textLeft: x.left, element: sel(x.el) })),
      });
    }
  }
  return {
    check: 'textEdgeAutoV1',
    line: 'Text edges: ' + findings.length + ' near-miss' + (findings.length === 1 ? '' : 'es'),
    blocksChecked: items.length,
    findings,
  };
})()
