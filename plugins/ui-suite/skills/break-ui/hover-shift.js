// Hover-shift check: does hovering anything move the frame? Paste the whole file into
// javascript_tool in the browser pane (top-level await works there). It hovers every
// interactive element and a sample of chart marks with synthetic pointer events (which fire
// React and DOM hover handlers), then reports any layout box outside a chart that moved or
// changed height. Marks inside a chart ([role=img], svg) may change on hover by design, so only
// the chart's own box is watched. An element whose own text changed may change width; its
// siblings may not move because of it.
// Synthetic events do not trigger CSS :hover, so the second part scans the stylesheets for
// :hover rules that change a layout property (font weight, size, padding, border, margin...).
// Returns {check, line: 'Hover shifts: N', findings, cssHoverLayout}.
(async () => {
  const MAX_PER_CHART = 40;
  const wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const inChart = el => !!el.parentElement?.closest('[role=img], svg');
  const name = el => {
    const t = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    const c = (el.getAttribute('class') || '').split(' ').slice(0, 3).join('.');
    return `${el.tagName.toLowerCase()}${c ? '.' + c : ''}${t ? ` "${t}"` : ''}`;
  };

  const watch = [...document.body.querySelectorAll('*')].filter(el => {
    if (!visible(el) || inChart(el)) return false;
    const s = getComputedStyle(el);
    return s.display !== 'inline' && s.position !== 'fixed' && !el.closest('[data-radix-popper-content-wrapper]');
  });
  const index = new Map(watch.map((el, i) => [el, i]));
  const ownText = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
  const snap = () => watch.map(el => { const r = el.getBoundingClientRect(); return { t: r.top, l: r.left, h: r.height, w: ownText(el) }; });

  const targets = new Set(document.querySelectorAll('button, a[href], [role=button], [tabindex]:not([tabindex="-1"]), .cursor-pointer'));
  for (const chart of document.querySelectorAll('[role=img], svg')) {
    const marks = [...chart.querySelectorAll('*')].filter(visible);
    const step = Math.max(1, Math.ceil(marks.length / MAX_PER_CHART));
    marks.forEach((m, i) => { if (i % step === 0) targets.add(m); });
  }

  const base = snap();
  const findings = new Map();
  for (const t of targets) {
    if (!t.isConnected || !visible(t)) continue;
    t.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    t.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    t.dispatchEvent(new MouseEvent('mouseenter'));
    await wait();
    const now = snap();
    now.forEach((n, i) => {
      const b = base[i], el = watch[i];
      // A mark that hover removes (a filtered-out segment) left the layout on purpose.
      if (!el.isConnected) return;
      const textChanged = n.w !== b.w;
      // Text that appears or empties may resize its own box; a neighbor that moves still counts.
      if (textChanged && (!b.w.trim() || !n.w.trim())) return;
      const dt = n.t - b.t, dl = n.l - b.l, dh = n.h - b.h;
      if (Math.abs(dt) > 0.5 || Math.abs(dh) > 0.5 || (!textChanged && Math.abs(dl) > 0.5)) {
        // A swatch or icon in the same line as changing text flows with that text.
        const pi = index.get(el.parentElement);
        if (pi !== undefined && now[pi].w !== base[pi].w && Math.abs(dt) <= 0.5 && Math.abs(dh) <= 0.5) return;
        const key = name(el);
        if (!findings.has(key)) findings.set(key, { moved: key, by: `top ${dt.toFixed(1)}, left ${dl.toFixed(1)}, height ${dh.toFixed(1)}`, onHover: name(t) });
      }
    });
    t.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
    t.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    t.dispatchEvent(new MouseEvent('mouseleave'));
    await wait();
  }

  const LAYOUT = /^(font-weight|font-size|letter-spacing|padding|margin|border(-\w+)*-width|width|height|min-|max-|line-height|gap|display|position|top|left|right|bottom)/;
  const cssHoverLayout = [];
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    const walk = list => { for (const r of list) {
      if (r.cssRules) walk(r.cssRules);
      if (!r.selectorText?.includes(':hover') || !r.style) continue;
      const props = [...r.style].filter(p => LAYOUT.test(p));
      if (props.length && document.querySelector(r.selectorText.replace(/:hover/g, ''))) cssHoverLayout.push(`${r.selectorText} { ${props.join(', ')} }`);
    } };
    walk(rules);
  }

  const list = [...findings.values()];
  return { check: 'hoverShiftV1', line: `Hover shifts: ${list.length}`, hovered: targets.size, findings: list.slice(0, 25), cssHoverLayout: cssHoverLayout.slice(0, 25) };
})()
