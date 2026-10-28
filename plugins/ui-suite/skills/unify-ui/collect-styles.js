// unify-ui: collect computed styles of same-role elements on this page.
// Run in the browser pane with javascript_tool. Returns one sample per visible
// element. Save each route's result as JSON, then run summarize.mjs on all of them.
// Each sample has box: { x, y, width, height } in page coordinates, plus viewport,
// dpr and pageHeight, for cropping.
// An element can declare its role with data-ui-role="card" (or any name).
(() => {
  const ROLES = [
    ['button', 'button, [role="button"], input[type="button"], input[type="submit"]'],
    ['input', 'input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), select'],
    ['textarea', 'textarea'],
    ['link', 'a[href]'],
    ['h1', 'h1'],
    ['h2', 'h2'],
    ['h3', 'h3'],
    ['card', '[data-slot="card"], article'],
  ];
  const PROPS = ['font-family', 'font-size', 'font-weight', 'line-height', 'padding-top', 'padding-right',
    'padding-bottom', 'padding-left', 'border-radius', 'border-width', 'border-color', 'background-color',
    'color', 'box-shadow', 'height', 'row-gap', 'column-gap'];
  const path = (el) => {
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && parts.length < 4; e = e.parentElement) {
      parts.unshift(e.tagName.toLowerCase() + (e.id ? `#${e.id}` : '') + (e.classList[0] ? `.${e.classList[0]}` : ''));
      if (e.id) break;
    }
    return parts.join(' > ');
  };
  const seen = new Set();
  const out = [];
  const add = (el, role) => {
    if (seen.has(el)) return;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    seen.add(el);
    const cs = getComputedStyle(el);
    out.push({
      route: location.pathname + location.search,
      role,
      selector: path(el),
      viewport: window.innerWidth,
      dpr: window.devicePixelRatio,
      pageHeight: document.documentElement.scrollHeight,
      box: { x: Math.round(box.x + window.scrollX), y: Math.round(box.y + window.scrollY), width: Math.round(box.width), height: Math.round(box.height) },
      text: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 40),
      style: Object.fromEntries(PROPS.map((p) => [p, cs.getPropertyValue(p)])),
    });
  };
  document.querySelectorAll('[data-ui-role]').forEach((el) => add(el, el.dataset.uiRole));
  for (const [role, selector] of ROLES) document.querySelectorAll(selector).forEach((el) => add(el, role));
  return out;
})()
