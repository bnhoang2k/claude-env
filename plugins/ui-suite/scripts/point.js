// Point-and-ask: ring parts of the live page with lettered red tags, so a reply or a question can
// say "A" and "B" instead of describing where things are.
// Load it once per page: paste the whole file into javascript_tool in the browser pane (top-level
// await works there; in Playwright's browser_evaluate pass it as `async () => <this file>`). That
// installs window.__point and rings MARKS below. After that, ring with one short call:
//   await __point.mark({ A: 'Save', B: { selector: '.sidebar' }, C: { selector: 'li', text: 'Jobs' } })
// A string is text to find; an object takes {selector?, text?}. The array form [{label, selector?,
// text?}] works too. `selector` rings every match; `text` picks the smallest visible element whose
// text contains it (inside `selector` when both are given). A page reload drops __point: paste the
// file again.
// Rings sit on one fixed overlay layer with pointer-events off, never on the page's own elements,
// so a React re-render can't wipe them and layout never moves. They are redrawn every frame, so
// they follow scroll, resize and re-rendered elements.
// Inside Storybook's manager page it draws in the story iframe, where the story lives.
// Each mark() replaces the old rings. __point.clear() removes them.
// Returns {check, line: 'Pointed: A=1 B=0', counts, missing, offscreen, frame}. A label with 0
// matches is a wrong selector or text: fix it before the reply goes out.
(async () => {
  // The first rings, drawn when the file is pasted. Later rings come from __point.mark().
  const MARKS = [
    { label: 'A', selector: 'h1' },
    { label: 'B', text: 'Example text' },
  ];
  const RED = '#e0242a', WAIT_MS = 4000;

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
    const pool = [...doc.querySelectorAll(m.selector || 'body *')].filter(visible);
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

  let stop = null; // removes the current rings
  const clear = () => { stop?.(); stop = null; };

  const mark = async (marks) => {
    const list = normalize(marks);
    // Story iframes and SPAs render late: poll until every mark matches or the wait runs out.
    target();
    let found = list.map(find);
    for (let t = 0; t < WAIT_MS && found.some(f => !f.length); t += 150) { await sleep(150); target(); found = list.map(find); }
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
      tag.style.cssText = `position:absolute;min-width:22px;height:22px;padding:0 6px;border-radius:6px;` +
        `background:${RED};color:#fff;font:700 13px/22px system-ui,sans-serif;text-align:center;` +
        'box-shadow:0 0 0 2px #fff;box-sizing:border-box;';
      layer.append(ring, tag);
      items.push({ m, el, ring, tag });
    }));

    const PAD = 4;
    let raf = 0, alive = true;
    const draw = () => {
      if (!alive) return;
      for (const it of items) {
        // A re-render may swap the element out: find the mark again.
        if (!it.el.isConnected) it.el = find(it.m)[0] || it.el;
        const r = it.el.getBoundingClientRect(), shown = it.el.isConnected && r.width > 0;
        it.ring.style.display = it.tag.style.display = shown ? '' : 'none';
        if (!shown) continue;
        Object.assign(it.ring.style, { left: `${r.left - PAD}px`, top: `${r.top - PAD}px`,
          width: `${r.width + PAD * 2}px`, height: `${r.height + PAD * 2}px` });
        // Tag sits left of the ring's top corner, in the margin, so it covers no text. With no
        // room there it goes above the ring, then inside it at the screen's top edge.
        const w = it.tag.offsetWidth, left = r.left - PAD - w - 4 >= 0, above = r.top - PAD - 26 >= 0;
        Object.assign(it.tag.style, left
          ? { left: `${r.left - PAD - w - 4}px`, top: `${r.top - PAD}px` }
          : { left: `${Math.max(0, r.left - PAD)}px`, top: `${above ? r.top - PAD - 26 : r.top - PAD + 3}px` });
      }
      raf = win.requestAnimationFrame(draw);
    };
    draw();
    const view = win;
    stop = () => { alive = false; view.cancelAnimationFrame(raf); layer.remove(); };

    const counts = Object.fromEntries(list.map((m, i) => [m.label, found[i].length]));
    const missing = list.filter((m, i) => !found[i].length).map(m => m.label);
    const offscreen = list.filter((m, i) => found[i].length && found[i].every(el => {
      const r = el.getBoundingClientRect();
      return r.bottom < 0 || r.top > win.innerHeight || r.right < 0 || r.left > win.innerWidth;
    })).map(m => m.label);
    const line = `Pointed: ${list.map(m => `${m.label}=${counts[m.label]}`).join(' ')}` +
      (missing.length ? ` (no match: ${missing.join(', ')})` : '') +
      (offscreen.length ? ` (off screen: ${offscreen.join(', ')})` : '') +
      // A background pane tab has no size, so nothing counts as visible: front the tab first.
      (win.innerWidth ? '' : ' (window has no size: front the tab and run again)');
    return { check: 'pointV1', line, counts, missing, offscreen, frame };
  };

  const api = { mark, clear };
  window.__point = api;
  return mark(MARKS);
})()
