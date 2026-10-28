// Automatic text-edge check. Needs no data-ui-align marks. Finds text blocks stacked in
// one column whose left text edges almost line up, and text blocks at the right end of
// their row whose right text edges almost line up: more than 1px apart, at most 32px.
// That is the "pushed out of line by an icon, dot or padding" fault, on either side.
// Run it in the browser pane with javascript_tool (paste the whole file), or headless
// with text-edge-auto.mjs. Returns { check, line, findings }; `line` is the one line to
// keep in the report: "Text edges: 0 near-misses" on success.
// Left edges ignore: centered and right-aligned text, text-indent, list markers,
// svg text, and an indent that repeats (two or more blocks on each side) with no
// icon in the gap and no nested list or quote behind it.
// Right edges look only at text that sits at the right end of its row: text-align right,
// or the last item of a justify-content space-between / flex-end / end row (one line,
// and no other text inside that item). The edge is the end of the text, not the box.
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
  const blocks = new Map(), allRects = new Map();
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
    allRects.set(b, (allRects.get(b) || []).concat(lines));
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

  // 1b. Right edge: text blocks at the right end of their row, by the end of their text.
  const END = /^(flex-end|end|right|space-between)$/;
  const inFlow = e => { const s = cs(e); return s.display !== 'none' && s.position !== 'absolute' && s.position !== 'fixed'; };
  const textIn = e => [...blocks.keys()].filter(k => e.contains(k)).length;
  const atRowEnd = (b, textRight) => {
    if (/^(right|end|-webkit-right)$/.test(cs(b).textAlign)) return true;
    let item = b;
    for (let i = 0; item && item !== document.body && i < 4; item = item.parentElement, i++) {
      if (textIn(item) !== 1) return false;       // another text block shares this item
      const p = item.parentElement;
      if (!p) return false;
      const ps = cs(p), s = cs(item);
      const reach = item.getBoundingClientRect().right - textRight;
      if (reach > MAX + TOL) continue;            // the text sits too far inside this item
      const kids = [...p.children].filter(inFlow);
      const last = kids[kids.length - 1] === item;
      if (/flex/.test(ps.display) && !/column|reverse/.test(ps.flexDirection)) {
        if (last && END.test(ps.justifyContent)) return true;
      } else if (/flex/.test(ps.display) && /column/.test(ps.flexDirection)) {
        if (/^(flex-end|end|right)$/.test(ps.alignItems) || /^(flex-end|end|right)$/.test(s.alignSelf)) return true;
      } else if (/grid/.test(ps.display)) {
        if (/^(flex-end|end|right)$/.test(s.justifySelf) || /^(flex-end|end|right)$/.test(ps.justifyItems)) return true;
      }
    }
    return false;
  };
  const rightItems = [];
  for (const [b, rects] of allRects) {
    const top = Math.min(...rects.map(x => x.top));
    const first = rects.filter(x => Math.abs(x.top - top) <= 2);
    const oneLine = first.length === rects.length;
    const right = Math.round(Math.max(...first.map(x => x.right)) * 10) / 10;
    const left = Math.min(...first.map(x => x.left));
    if (right < 0 || left > innerWidth) continue;
    const aligned = /^(right|end|-webkit-right)$/.test(cs(b).textAlign);
    if (!aligned && !oneLine) continue;
    if (!atRowEnd(b, right)) continue;
    const bl = blocks.get(b);
    rightItems.push({ el: b, right, left, top, bottom: Math.max(...first.map(x => x.bottom)), text: bl ? bl.text : b.textContent.trim().slice(0, 40) });
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
  // An icon, image or ::before / ::after in the gap beside the text: before it (left), after it (right).
  const hasObject = (it, edge, side) => {
    const host = it.el.parentElement || it.el;
    const hit = [...host.querySelectorAll('*')].some(o => {
      if (o === it.el || it.el.contains(o) && o.textContent.trim()) return false;
      if (o.textContent.trim() && !/^(svg|img|i)$/i.test(o.tagName)) return false;
      const r = o.getBoundingClientRect();
      const beside = side === 'left'
        ? r.right <= edge + TOL && r.left >= edge - MAX - TOL
        : r.left >= edge - TOL && r.right <= edge + MAX + TOL;
      return r.width > 0 && r.height > 0 && beside && r.top < it.bottom && r.bottom > it.top;
    });
    const pseudo = [it.el, host].some(x => {
      const b = getComputedStyle(x, side === 'left' ? '::before' : '::after');
      return b.content !== 'none' && b.content !== 'normal' && b.position !== 'absolute';
    });
    return hit || pseudo;
  };
  const overlapX = (a, b) => {
    const x = a.el.getBoundingClientRect(), y = b.el.getBoundingClientRect();
    return x.left < y.right && y.left < x.right;
  };

  // side 'left': compare left edges of stacked blocks. side 'right': compare right edges.
  const scan = (list, side) => {
    const reported = new Set(), out = [];
    const at = x => x[side];
    for (const C of containers) {
      const inside = list.filter(it => C.contains(it.el));
      if (inside.length < 2) continue;
      const sorted = inside.slice().sort((a, b) => at(a) - at(b));
      const groups = [];
      for (const it of sorted) {
        const g = groups[groups.length - 1];
        if (g && at(it) - at(g.items[g.items.length - 1]) <= TOL) g.items.push(it);
        else groups.push({ items: [it] });
      }
      for (let i = 0; i + 1 < groups.length; i++) {
        const lo = groups[i], hi = groups[i + 1];
        const edge = (g) => at(g.items[0]);
        const gap = edge(hi) - edge(lo);
        if (gap <= TOL || gap > MAX) continue;
        const near = (a, b) => stacked(a, b) && (side === 'left' || overlapX(a, b));
        if (!lo.items.some(a => hi.items.some(b => near(a, b)))) continue;
        const all = lo.items.concat(hi.items);
        if (all.every(x => reported.has(x.el))) continue;
        const lone = Math.min(lo.items.length, hi.items.length) === 1;
        // Left: the text that moved is the right-hand group, pushed by something before it.
        // Right: the text that moved is the left-hand group, pushed by something after it.
        const moved = side === 'left' ? hi : lo;
        const withObject = moved.items.some(x => hasObject(x, edge(moved), side));
        const nested = side === 'left'
          && hi.items.every(x => { const a = x.el.closest(SEMANTIC); return a && C.contains(a); });
        if (nested || !(lone || withObject)) continue;
        all.forEach(x => reported.add(x.el));
        out.push({
          side,
          container: sel(C),
          edges: [edge(lo), edge(hi)],
          offsetPx: Math.round(gap * 10) / 10,
          cause: side === 'left'
            ? (withObject ? 'something sits before the text' : 'text starts at a different edge')
            : (withObject ? 'something sits after the text' : 'text ends at a different edge'),
          items: all.map(x => side === 'left'
            ? { text: x.text, textLeft: x.left, element: sel(x.el) }
            : { text: x.text, textRight: x.right, element: sel(x.el) }),
        });
      }
    }
    return out;
  };
  const findings = scan(items, 'left').concat(scan(rightItems, 'right'));
  return {
    check: 'textEdgeAutoV1',
    line: 'Text edges: ' + findings.length + ' near-miss' + (findings.length === 1 ? '' : 'es'),
    blocksChecked: items.length + rightItems.length,
    findings,
  };
})()
