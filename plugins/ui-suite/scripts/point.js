// Point-and-ask: ring parts of the live page with lettered red tags, so a reply or a question can
// say "A" and "B" instead of describing where things are.
// Load it once per page: paste the whole file into javascript_tool in the browser pane (top-level
// await works there; in Playwright's browser_evaluate pass it as `async () => <this file>`). That
// installs window.__point and rings MARKS below. After that, ring with one short call:
//   await __point.mark({ A: 'Save', B: { selector: '.sidebar' }, C: { selector: 'li', text: 'Jobs' } })
// A string is text to find; an object takes {selector?, text?, all?}. The array form [{label,
// selector?, text?, all?}] works too. `text` picks the smallest visible element whose text
// contains it (inside `selector` when both are given). `selector` rings every match; that is a
// problem unless `all: true` says one letter is meant to cover them all. A page reload drops
// __point: paste the file again.
// Rings sit on one fixed overlay layer with pointer-events off, never on the page's own elements,
// so a React re-render can't wipe them and layout never moves. They are redrawn every frame, so
// they follow scroll, resize and re-rendered elements. A ring stands 6px off its part, clear of
// the part's own outline (less when a ringed neighbor is close), and shows only the part a
// scroll box leaves visible.
// Each tag takes the first spot around its ring that covers no text, icon, other tag or other
// ring's edge: left of the top corner, above, right, below, then inside.
// Inside Storybook's manager page it draws in the story iframe, where the story lives.
// Each mark() replaces the old rings. __point.clear() removes them.
// Returns {check, line, counts, problems, frame}. `line` reads 'Pointed: A=1 B=1 | Clean', or ends
// in '| Problems: ...' listing a part that matched nothing, rings several parts, holds another
// ringed part, sits so close to another that their rings touch, is off screen or cut off by a
// scroll box, or whose tag still covers something.
// Fix each one before the reply goes out: point-gate.py holds a reply whose last rings have any.
//
// Review, for three or more parts at once (a sign-off, a list of fixes): no rings, a side list
// of lettered cards instead. Hovering a card spotlights its part; choosing it opens the part (a
// step) and scrolls to it; each card takes a yes or a no with a note. The person answers at
// their own pace, then the next turn reads the answers:
//   await __point.review([{ note: 'Budget written in full', selector: '#budget' },
//                         { note: 'Detail opens in place', selector: '#more', step: { selector: '#toggle' } }])
//   __point.answers().line   // 'Answers: A yes; B no (say 4 hr); C open'
// A note stays under 60 characters; `hover: true` marks a change only hover shows. Answers stay
// in this page's localStorage across reloads (paste the file again to bring the list back).
// The next review() drops answered cards, keeps open ones faded, and keeps counting letters.
// review() returns a line like mark()'s, ending in "| Clean" or "| Problems: ...".
// __point.endReview() removes the list and its answers.
(async () => {
  // The first rings, drawn when the file is pasted. Later rings come from __point.mark().
  const MARKS = [
    { label: 'A', selector: 'h1' },
    { label: 'B', text: 'Example text' },
  ];
  const RED = '#e0242a', WAIT_MS = 4000, PAD = 6, GAP = 4, TAG_H = 22;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // The story iframe starts as a blank page and swaps in the story later, so look it up again
  // on every poll instead of keeping the first document it had.
  let doc = document, win = window, frame = 'top';
  const target = () => {
    const el = document.querySelector('#storybook-preview-iframe');
    if (!el) return;
    try { doc = el.contentDocument; win = el.contentWindow; frame = 'storybook'; }
    catch { doc = document; win = window; frame = 'top (story iframe is cross-origin)'; }
  };
  window.__point?.clear(); // rings from an earlier load of this file

  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const find = m => {
    let all;
    // A thrown error carries no Problems line, so the gate would pass it: report it instead.
    try { all = doc.querySelectorAll(m.selector || 'body *'); } catch { m.invalid = true; return []; }
    const pool = [...all].filter(visible);
    if (!m.text) return pool;
    const want = m.text.toLowerCase();
    const hits = pool.filter(el => (el.innerText || '').toLowerCase().includes(want));
    // Smallest element holding the text: drop any hit that contains another hit.
    const inner = hits.filter(el => !hits.some(o => o !== el && el.contains(o)));
    return m.selector ? inner : inner.slice(0, 1);
  };
  // {A: 'text'} and {A: {selector, text}} become [{label: 'A', ...}].
  const normalize = marks => (Array.isArray(marks) ? marks : Object.entries(marks)
    .map(([label, m]) => (typeof m === 'string' ? { label, text: m } : { label, ...m })));

  const box = (left, top, right, bottom) => ({ left, top, right, bottom });
  const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const inside = (a, b) => a.left >= b.left && a.right <= b.right && a.top >= b.top && a.bottom <= b.bottom;
  const meet = (a, b) => box(Math.max(a.left, b.left), Math.max(a.top, b.top), Math.min(a.right, b.right), Math.min(a.bottom, b.bottom));
  const empty = r => r.right <= r.left || r.bottom <= r.top;
  const pad = (r, p = PAD) => box(r.left - p, r.top - p, r.right + p, r.bottom + p);
  // The space between two boxes that do not overlap (0 when they do).
  const gapBetween = (a, b) => Math.max(0, a.left - b.right, b.left - a.right, a.top - b.bottom, b.top - a.bottom);
  // The boxes around el that cut off what overflows them (scroll boxes, overflow: hidden).
  const clippers = el => {
    const out = [];
    for (let a = el.parentElement; a && a !== doc.body && a !== doc.documentElement; a = a.parentElement) {
      const s = win.getComputedStyle(a);
      if (/auto|scroll|hidden|clip/.test(s.overflowX + s.overflowY)) out.push(a);
    }
    return out;
  };
  // The part of el the scroll boxes around it leave visible (the window is not counted here).
  const shownPart = (el, clips) => clips.reduce((r, a) => meet(r, a.getBoundingClientRect()), el.getBoundingClientRect());

  // What a tag at `rect` would hide, or '' when the spot is clear.
  const covers = (rect, rings, tags) => {
    if (rect.left < 0 || rect.top < 0 || rect.right > win.innerWidth || rect.bottom > win.innerHeight) return 'the window edge';
    if (tags.some(t => hit(rect, t))) return 'another tag';
    // Crossing a ring's edge hides its line; sitting fully inside it is judged by what is under the tag.
    if (rings.some(r => hit(rect, r) && !inside(rect, r))) return "another ring's edge";
    const seen = new Set();
    for (let x = rect.left + 1; x < rect.right; x += 5) for (let y = rect.top + 1; y < rect.bottom; y += 5) {
      for (const el of doc.elementsFromPoint(x, y)) {
        if (seen.has(el)) continue;
        seen.add(el);
        if (el.closest('svg, img, canvas, video')) return 'an icon or image';
        for (const n of el.childNodes) {
          if (n.nodeType !== 3 || !n.textContent.trim()) continue;
          const range = doc.createRange();
          range.selectNodeContents(n);
          if ([...range.getClientRects()].some(r => hit(rect, r))) return 'text';
        }
      }
    }
    return '';
  };
  // Where a tag of width w goes around ring r, for each side.
  const SIDES = ['left', 'above', 'right', 'below', 'inside'];
  const spot = (side, r, w) => {
    const at = {
      left: [r.left - w - GAP, r.top], above: [r.left, r.top - TAG_H - GAP], right: [r.right + GAP, r.top],
      // A part bigger than the window keeps its inside tag on screen.
      below: [r.left, r.bottom + GAP], inside: [Math.max(r.left, 0) + 3, Math.max(r.top, 0) + 3],
    }[side];
    return box(at[0], at[1], at[0] + w, at[1] + TAG_H);
  };

  let stop = null; // removes the current rings
  const clear = () => { stop?.(); stop = null; };
  // Each mark() or review() call takes a number; a call still waiting for its parts when a later
  // one starts draws nothing, so the first paste's rings never land on top of a review.
  let calls = 0;

  const mark = async (marks) => {
    const list = normalize(marks), me = ++calls;
    // Story iframes and SPAs render late: poll until every mark matches or the wait runs out.
    target();
    let found = list.map(find);
    for (let t = 0; t < WAIT_MS && found.some((f, i) => !f.length && !list[i].invalid); t += 150) { await sleep(150); target(); found = list.map(find); }
    if (me !== calls) return { check: 'pointV2', line: 'Pointed: nothing (a later call replaced this one)', counts: {}, problems: [], frame };
    clear();
    win.__point = window.__point = api;

    const layer = doc.createElement('div');
    layer.setAttribute('data-point-overlay', '');
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    doc.documentElement.appendChild(layer);
    const items = [];
    list.forEach((m, i) => found[i].forEach(el => {
      const ring = doc.createElement('div');
      ring.style.cssText = `position:absolute;border:3px solid ${RED};border-radius:8px;` +
        'box-shadow:0 0 0 2px #fff, inset 0 0 0 1px #fff;box-sizing:border-box;';
      const tag = doc.createElement('div');
      tag.textContent = m.label;
      tag.style.cssText = `position:absolute;min-width:22px;height:${TAG_H}px;padding:0 6px;border-radius:6px;` +
        `background:${RED};color:#fff;font:700 13px/22px system-ui,sans-serif;text-align:center;` +
        'box-shadow:0 0 0 2px #fff;box-sizing:border-box;';
      layer.append(ring, tag);
      items.push({ m, el, ring, tag, clips: clippers(el) });
    }));
    items.forEach(it => { it.w = Math.max(22, it.tag.offsetWidth); });

    const problems = [];
    const say = p => { if (!problems.includes(p)) problems.push(p); };
    list.forEach((m, i) => {
      if (m.invalid) say(`${m.label} has an invalid selector`);
      else if (!found[i].length) say(`${m.label} matched nothing`);
      else if (found[i].length > 1 && !m.all) say(`${m.label} rings ${found[i].length} parts`);
    });
    // One ringed part inside another: their rings and tags crowd each other.
    list.forEach((a, i) => list.forEach((b, j) => {
      if (i === j) return;
      if (found[i].some(x => found[j].some(y => x === y)) && i < j) say(`${a.label} and ${b.label} ring the same part`);
      else if (found[i].some(x => found[j].some(y => x !== y && x.contains(y)))) say(`${a.label} holds ${b.label}`);
    }));

    // Pick each tag's spot once, in label order, so later tags step around earlier ones.
    const view = box(0, 0, win.innerWidth, win.innerHeight);
    const shown = it => { const r = shownPart(it.el, it.clips); return empty(r) ? null : r; };
    // Neighbors closer than two rings' width: each ring stands off its part by half the gap, less
    // its 2px white edge. Still touching (parts closer than about 6px) is a problem.
    const parts = items.map(it => { const r = shown(it); return r && !empty(meet(r, view)) ? r : null; });
    items.forEach(it => { it.pad = PAD; });
    items.forEach((a, i) => items.forEach((b, j) => {
      if (j <= i || !parts[i] || !parts[j] || a.el.contains(b.el) || b.el.contains(a.el)) return;
      const gap = gapBetween(parts[i], parts[j]);
      if (gap >= 2 * (PAD + 2)) return;
      const p = Math.max(1, Math.floor(gap / 2) - 2);
      a.pad = Math.min(a.pad, p); b.pad = Math.min(b.pad, p);
      if (2 * (p + 2) > gap && a.m.label !== b.m.label) say(`${a.m.label} and ${b.m.label} rings touch`);
    }));
    const rings = items.map((it, i) => parts[i] && pad(parts[i], it.pad));
    const tags = [];
    items.forEach((it, i) => {
      const r = rings[i];
      // One tag per letter: a letter that rings several parts tags only the first one shown.
      it.noTag = items.slice(0, i).some((o, j) => o.m === it.m && rings[j]);
      if (it.noTag) return;
      const whole = it.el.getBoundingClientRect();
      if (!r) {
        say(empty(meet(box(whole.left, whole.top, whole.right, whole.bottom), view)) ? `${it.m.label} is off screen`
          : `${it.m.label} is cut off by a scroll box`);
        it.side = 'left';
        return;
      }
      const w = it.w;
      const others = rings.filter((o, j) => o && j !== i);
      let best = null;
      for (const side of SIDES) {
        const why = covers(spot(side, r, w), others, tags);
        if (!why) { best = { side, why }; break; }
        if (!best) best = { side, why };
      }
      it.side = best.side;
      if (best.why) say(`${it.m.label}'s tag covers ${best.why}`);
      tags.push(spot(best.side, r, w));
    });

    let raf = 0, alive = true;
    const draw = () => {
      if (!alive) return;
      // Read every box before writing any style: a write between reads forces a fresh layout
      // each time, which dropped 1,000 rings to 4 frames a second.
      const now = items.map(it => {
        // A re-render may swap the element out: find the mark again.
        if (!it.el.isConnected) { it.el = find(it.m)[0] || it.el; it.clips = clippers(it.el); }
        return it.el.isConnected ? shown(it) : null;
      });
      items.forEach((it, i) => {
        const r = now[i];
        it.ring.style.display = r ? '' : 'none';
        it.tag.style.display = r && !it.noTag ? '' : 'none';
        if (!r) return;
        const p = pad(r, it.pad);
        Object.assign(it.ring.style, { left: `${p.left}px`, top: `${p.top}px`,
          width: `${p.right - p.left}px`, height: `${p.bottom - p.top}px` });
        if (it.noTag) return;
        const t = spot(it.side, p, it.w);
        Object.assign(it.tag.style, { left: `${t.left}px`, top: `${t.top}px` });
      });
      raf = win.requestAnimationFrame(draw);
    };
    draw();
    const host = win;
    stop = () => { alive = false; host.cancelAnimationFrame(raf); layer.remove(); };

    const counts = Object.fromEntries(list.map((m, i) => [m.label, found[i].length]));
    const line = `Pointed: ${list.map(m => `${m.label}=${counts[m.label]}`).join(' ')}` +
      // The line names 10 problems at most; `problems` holds them all.
      (problems.length ? ` | Problems: ${problems.slice(0, 10).join('; ')}` +
        (problems.length > 10 ? `; and ${problems.length - 10} more` : '') : ' | Clean') +
      // A background pane tab has no size, so nothing counts as visible: front the tab first.
      (win.innerWidth ? '' : ' (window has no size: front the tab and run again)');
    return { check: 'pointV2', line, counts, problems, frame };
  };

  // ---- Review: many parts at once, answered on the page --------------------------------------
  // A side list of lettered cards, one per part. Hovering or focusing a card spotlights its part;
  // choosing a card opens a hidden part (its step) and scrolls it into view. Each card takes a
  // yes or a no with a short note. Answers live in this page's localStorage, so a reload keeps
  // them; the next review() carries open cards over and keeps counting letters.
  // Keyed by path only: Storybook changes the query on every story and argument switch.
  const KEY = 'point-review:' + location.pathname;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
  // 0 -> A, 25 -> Z, 26 -> AA.
  const letter = n => (n >= 26 ? letter(Math.floor(n / 26) - 1) : '') + String.fromCharCode(65 + (n % 26));
  const NOTE_MAX = 60, W = 264, STRIP = 44;
  const CSS = `
  .pt-rv { all: initial; position: fixed; top: 12px; z-index: 2147483647; width: ${W}px; max-height: calc(100vh - 24px);
    display: flex; flex-direction: column; box-sizing: border-box; border-radius: 10px;
    --pt-paper: #fff; --pt-ink: #1b1b1a; --pt-gray: #5c5c58; --pt-line: #e4e4e2; --pt-wash: #f4f4f2;
    --pt-red: #d21f25; --pt-yes: #1e7a3c; --pt-yes-wash: #e6f4ea; --pt-no-wash: #fdeaea;
    background: var(--pt-paper); color: var(--pt-ink); box-shadow: 0 0 0 1px var(--pt-line), 0 8px 24px rgba(0,0,0,.08);
    font: 13px/1.4 system-ui, -apple-system, sans-serif; }
  @media (prefers-color-scheme: dark) { .pt-rv { --pt-paper: #1e1e1d; --pt-ink: #ededeb; --pt-gray: #a8a8a3;
    --pt-line: #383836; --pt-wash: #2a2a28; --pt-red: #e5484d; --pt-yes: #4cc38a; --pt-yes-wash: #1d3326; --pt-no-wash: #3b2021; } }
  .pt-rv * { box-sizing: border-box; font: inherit; color: inherit; margin: 0; }
  .pt-rv.pt-left { left: 12px; } .pt-rv.pt-right { right: 12px; }
  .pt-rv-head { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 12px; border-bottom: 1px solid var(--pt-line); }
  .pt-rv-title { font-weight: 600; flex: 1; }
  .pt-rv-count { color: var(--pt-gray); font-size: 12px; font-variant-numeric: tabular-nums; }
  .pt-rv button { all: unset; box-sizing: border-box; width: 24px; height: 24px; border-radius: 6px; display: inline-flex;
    align-items: center; justify-content: center; color: var(--pt-gray); cursor: pointer; flex-shrink: 0; }
  .pt-rv button:hover, .pt-rv button:focus-visible { background: var(--pt-wash); color: var(--pt-ink); }
  .pt-rv button:focus-visible, .pt-rv-card:focus-visible { outline: 2px solid var(--pt-red); outline-offset: -2px; }
  .pt-rv svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .pt-rv-list { list-style: none; padding: 4px 0; overflow: auto; }
  .pt-rv-card { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; grid-template-rows: auto 24px;
    column-gap: 8px; padding: 6px 8px 6px 12px; cursor: pointer; }
  .pt-rv-card:hover, .pt-rv-card.pt-on { background: var(--pt-wash); }
  .pt-rv-label { grid-row: 1 / 3; align-self: start; min-width: 24px; height: 20px; padding: 0 4px; border-radius: 6px;
    background: var(--pt-red); color: #fff; font-size: 12px; font-weight: 700; line-height: 20px; text-align: center; }
  .pt-rv-note { align-self: center; overflow: hidden; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .pt-rv-acts { display: flex; gap: 8px; align-self: start; }
  .pt-rv-acts .pt-yes.pt-set { background: var(--pt-yes-wash); color: var(--pt-yes); }
  .pt-rv-acts .pt-no.pt-set { background: var(--pt-no-wash); color: var(--pt-red); }
  .pt-rv-where { grid-column: 2 / 4; align-self: center; color: var(--pt-gray); font-size: 12px; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; }
  .pt-rv-input { grid-column: 2 / 4; height: 24px; padding: 0 8px; border: 0; border-radius: 6px; outline: none;
    background: var(--pt-paper); box-shadow: inset 0 0 0 1px var(--pt-line); font-size: 12px; }
  .pt-rv-input:focus { box-shadow: inset 0 0 0 1px var(--pt-gray); }
  .pt-rv-input::placeholder { color: var(--pt-gray); }
  .pt-rv-card.pt-done .pt-rv-note, .pt-rv-card.pt-old .pt-rv-note { color: var(--pt-gray); }
  .pt-rv-card.pt-old .pt-rv-label { background: transparent; color: var(--pt-red); box-shadow: inset 0 0 0 1px var(--pt-red); }
  .pt-rv-tip { position: fixed; z-index: 2147483647; padding: 2px 8px; border-radius: 6px; background: var(--pt-ink);
    color: var(--pt-paper); font-size: 12px; pointer-events: none; white-space: nowrap; }
  .pt-rv-tip[hidden] { display: none; }
  .pt-rv.pt-folded { width: ${STRIP}px; }
  .pt-rv.pt-folded .pt-rv-head { padding: 8px 10px; justify-content: center; }
  .pt-rv.pt-folded .pt-rv-title, .pt-rv.pt-folded .pt-rv-count, .pt-rv.pt-folded .pt-rv-note,
  .pt-rv.pt-folded .pt-rv-acts, .pt-rv.pt-folded .pt-rv-where, .pt-rv.pt-folded .pt-rv-input { display: none; }
  .pt-rv.pt-folded .pt-rv-card { grid-template-columns: 24px; grid-template-rows: auto; padding: 4px 10px; }
  .pt-rv-spot { position: fixed; border: 2px solid var(--pt-red, #d21f25); border-radius: 10px; pointer-events: none;
    z-index: 2147483646; box-shadow: 0 0 0 9999px rgba(20,20,20,.28); transition: all .12s ease-out; }
  @media (prefers-reduced-motion: reduce) { .pt-rv-spot { transition: none; } }`;
  const ICON = {
    yes: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    no: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    fold: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    open: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  };
  const el = (tag, cls, text) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  let panel = null; // removes the current review panel and spotlight
  const endPanel = () => { panel?.(); panel = null; };

  // The side of the window whose strip holds less of the page's text and controls.
  const pickSide = () => {
    const busy = x0 => {
      let n = 0;
      for (let x = x0 + 4; x < x0 + W; x += 24) for (let y = 12; y < win.innerHeight - 12; y += 24) {
        const e = doc.elementFromPoint(x, y);
        if (e && e !== doc.body && e !== doc.documentElement && (e.closest('button, a, input, select, textarea, svg, img') ||
          [...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()))) n++;
      }
      return n;
    };
    const left = busy(12), right = busy(win.innerWidth - W - 12);
    return { side: right <= left ? 'right' : 'left', folded: Math.min(left, right) > 0 };
  };

  const show = state => {
    endPanel();
    if (!doc.getElementById('pt-rv-style')) { const s = el('style'); s.id = 'pt-rv-style'; s.textContent = CSS; doc.head.appendChild(s); }
    const { side, folded } = pickSide();
    const root = el('section', `pt-rv pt-${side}${folded ? ' pt-folded' : ''}`);
    root.setAttribute('aria-label', 'Review');
    root.setAttribute('data-point-overlay', '');
    const tip = el('div', 'pt-rv-tip');
    tip.id = 'pt-rv-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
    const tipFor = (b, text) => {
      b.setAttribute('aria-label', text); b.setAttribute('aria-describedby', tip.id); b.dataset.tip = text;
      const on = () => { tip.textContent = b.dataset.tip; tip.hidden = false; const r = b.getBoundingClientRect();
        tip.style.top = `${r.bottom + 6}px`; tip.style.left = `${Math.min(r.left, win.innerWidth - tip.offsetWidth - 8)}px`; };
      b.addEventListener('mouseenter', on); b.addEventListener('focus', on);
      b.addEventListener('mouseleave', () => { tip.hidden = true; }); b.addEventListener('blur', () => { tip.hidden = true; });
    };
    const head = el('div', 'pt-rv-head');
    const count = el('span', 'pt-rv-count');
    const fold = el('button');
    head.append(el('span', 'pt-rv-title', 'Review'), count, fold);
    const setFold = f => { root.classList.toggle('pt-folded', f); fold.innerHTML = f ? ICON.open : ICON.fold;
      fold.dataset.tip = f ? 'Open the list' : 'Fold the list'; fold.setAttribute('aria-label', fold.dataset.tip); };
    tipFor(fold, 'Fold the list');
    fold.addEventListener('click', () => setFold(!root.classList.contains('pt-folded')));
    setFold(folded);
    const list = el('ol', 'pt-rv-list');
    root.append(head, list);
    doc.documentElement.append(root, tip);

    const spot = el('div', 'pt-rv-spot');
    spot.hidden = true;
    doc.documentElement.appendChild(spot);
    let active = null, raf = 0;
    const partOf = it => {
      const els = find(it);
      if (!els.length) return null;
      // One letter for several parts: spotlight the box around all of them.
      const rs = els.map(e => shownPart(e, clippers(e))).filter(r => !empty(r));
      return rs.length ? rs.reduce((a, b) => box(Math.min(a.left, b.left), Math.min(a.top, b.top), Math.max(a.right, b.right), Math.max(a.bottom, b.bottom))) : null;
    };
    const follow = () => {
      const r = active && partOf(active);
      spot.hidden = !r;
      if (r) Object.assign(spot.style, { left: `${r.left - 8}px`, top: `${r.top - 8}px`,
        width: `${r.right - r.left + 16}px`, height: `${r.bottom - r.top + 16}px` });
      raf = active ? win.requestAnimationFrame(follow) : 0;
    };
    const focusOn = it => { active = it; win.cancelAnimationFrame(raf); follow(); };

    const where = it => {
      if (it.invalid) return 'Invalid selector';
      const r = partOf(it);
      if (!r) return it.step ? 'Hidden' : 'Not on the page';
      if (r.bottom < 0) return 'Above the view';
      if (r.top > win.innerHeight) return 'Below the view';
      return it.hover ? 'Hover the part to see it' : '';
    };
    const paint = () => {
      const done = state.items.filter(i => i.verdict).length;
      count.textContent = `${done} of ${state.items.length}`;
    };
    const rows = state.items.map(it => {
      const card = el('li', 'pt-rv-card');
      card.tabIndex = 0;
      const yes = el('button', 'pt-yes'), no = el('button', 'pt-no');
      yes.innerHTML = ICON.yes; no.innerHTML = ICON.no;
      tipFor(yes, 'Looks right'); tipFor(no, 'Needs a change');
      const acts = el('span', 'pt-rv-acts'); acts.append(yes, no);
      const whereLine = el('span', 'pt-rv-where');
      const input = el('input', 'pt-rv-input');
      input.placeholder = 'What to change'; input.value = it.comment || '';
      input.setAttribute('aria-label', `What to change in ${it.label}`);
      const note = el('span', 'pt-rv-note', it.note);
      note.title = it.note;
      card.append(el('span', 'pt-rv-label', it.label), note, acts, whereLine);
      const set = () => {
        yes.classList.toggle('pt-set', it.verdict === 'yes'); no.classList.toggle('pt-set', it.verdict === 'no');
        card.classList.toggle('pt-done', !!it.verdict); card.classList.toggle('pt-old', !!it.old && !it.verdict);
        // The note box takes the status line's slot, so the card keeps its height.
        if (it.verdict === 'no') { if (!input.isConnected) whereLine.replaceWith(input); }
        else if (input.isConnected) input.replaceWith(whereLine);
        whereLine.textContent = where(it);
        paint();
      };
      const verdict = v => e => { e.stopPropagation(); it.verdict = it.verdict === v ? undefined : v; save(state); set();
        if (it.verdict === 'no') input.focus(); };
      yes.addEventListener('click', verdict('yes')); no.addEventListener('click', verdict('no'));
      input.addEventListener('click', e => e.stopPropagation());
      input.addEventListener('input', () => { it.comment = input.value; save(state); });
      card.addEventListener('mouseenter', () => focusOn(it)); card.addEventListener('focus', () => focusOn(it));
      card.addEventListener('mouseleave', () => focusOn(null));
      card.addEventListener('blur', e => { if (!card.contains(e.relatedTarget)) focusOn(null); });
      const go = async () => {
        if (!partOf(it) && it.step) { (find(it.step)[0])?.click(); await sleep(60); }
        const e = find(it)[0];
        const still = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
        e?.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
        focusOn(it);
      };
      card.addEventListener('click', go);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === card) go(); });
      list.appendChild(card);
      return set;
    });
    rows.forEach(set => set());
    // Status lines follow scroll and opened parts, without moving the cards.
    const tick = setInterval(() => rows.forEach(set => set()), 500);
    panel = () => { clearInterval(tick); win.cancelAnimationFrame(raf); root.remove(); tip.remove(); spot.remove(); };
  };

  // review([{note, selector?, text?, all?, step?: {selector?, text?}, hover?, label?}])
  const review = async input => {
    const fresh = (Array.isArray(input) ? input : Object.entries(input).map(([label, m]) => ({ label, ...m })))
      .map(m => ({ note: String(m.note || ''), selector: m.selector, text: m.text, all: !!m.all, step: m.step, hover: !!m.hover, label: m.label }));
    const me = ++calls;
    target();
    // Parts render late in story iframes and SPAs; a part behind a step may stay hidden.
    let found = fresh.map(find);
    for (let t = 0; t < WAIT_MS && found.some((f, i) => !f.length && !fresh[i].invalid && !fresh[i].step); t += 150) {
      await sleep(150); target(); found = fresh.map(find);
    }
    if (me !== calls) return { check: 'pointReviewV1', line: 'Review: nothing (a later call replaced this one)', problems: [], labels: [], frame };
    win.__point = window.__point = api;
    const before = load();
    // Answered cards were read with answers() and leave; open ones stay, faded, under their letters.
    const carried = (before.items || []).filter(i => !i.verdict).map(i => ({ ...i, old: true }));
    let next = before.next || 0;
    fresh.forEach(m => { if (!m.label) m.label = letter(next++); });
    const state = { items: [...carried, ...fresh], next };
    save(state);
    if (state.items.length) show(state); else endPanel();

    const problems = [];
    fresh.forEach((m, i) => {
      if (m.invalid) problems.push(`${m.label} has an invalid selector`);
      else if (!found[i].length && !m.step) problems.push(`${m.label} matched nothing`);
      else if (found[i].length > 1 && !m.all) problems.push(`${m.label} rings ${found[i].length} parts`);
      if (!m.note) problems.push(`${m.label} has no note`);
      else if (m.note.length > NOTE_MAX) problems.push(`${m.label}'s note runs past ${NOTE_MAX} characters`);
    });
    const labels = state.items.map(i => i.label).join(' ') || 'none';
    const line = `Review: ${labels}` + (carried.length ? ` (${carried.length} carried over)` : '') +
      (problems.length ? ` | Problems: ${problems.slice(0, 10).join('; ')}` +
        (problems.length > 10 ? `; and ${problems.length - 10} more` : '') : ' | Clean');
    return { check: 'pointReviewV1', line, problems, labels: state.items.map(i => i.label), frame };
  };

  // What the user answered: one line for the reply, and every card.
  const answers = () => {
    const items = (load().items || []).map(i => ({ label: i.label, note: i.note, verdict: i.verdict || 'open', comment: i.comment || '' }));
    const line = `Answers: ${items.map(i => `${i.label} ${i.verdict}${i.comment ? ` (${i.comment})` : ''}`).join('; ') || 'none'}`;
    return { check: 'pointAnswersV1', line, items };
  };
  const endReview = () => { endPanel(); try { localStorage.removeItem(KEY); } catch {} };

  const api = { mark, clear, review, answers, endReview };
  window.__point = api;
  // A reload drops the panel but not the answers: pasting the file again brings the panel back.
  if (load().items?.length) { target(); show(load()); }
  return mark(MARKS);
})()
