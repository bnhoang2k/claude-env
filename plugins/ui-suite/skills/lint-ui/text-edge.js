// Text-edge alignment check. lintapple compares element boxes, so text pushed
// sideways by padding passes it. This measures where each item's text starts.
// Run in the browser pane with javascript_tool. Each group returns the left edge
// of the first text line of every [data-ui-align-item]; aligned is false when
// they differ by more than 1px.
[...document.querySelectorAll('[data-ui-align]')].map(g => {
  const xs = [...g.querySelectorAll('[data-ui-align-item]')]
    .filter(el => el.closest('[data-ui-align]') === g)
    .map(el => {
      const r = document.createRange(); r.selectNodeContents(el);
      const box = [...r.getClientRects()].find(b => b.width > 0);
      return box ? Math.round(box.left * 10) / 10 : null;
    });
  return { group: g.id || g.className, textLeft: xs, aligned: Math.max(...xs) - Math.min(...xs) <= 1 };
})
