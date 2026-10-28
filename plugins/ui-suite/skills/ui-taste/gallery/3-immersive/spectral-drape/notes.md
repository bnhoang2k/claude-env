---
origin: own
---

# Spectral Drape

- Date: 2026-10-16
- A user: “honestly amazing redesign.” (2026-10-16)
- Idea: a glowing drape of about 44,000 dots folded in 3D, drifting on its own; the pointer dents it and a click rolls a ring across it. Rebuilt from the description on pro.reactbits.dev, not from its code.
- Rung 3, Immersive. Look: bold. Feel: calm.
- Source: built in an earlier spike (WebGL 2, one file, no build).

Copy its feel, not its layout: take the behavior numbers below; do not copy its layout, content or colors.

## Behavior, not identity

- body-luminance: 0.11 (window.__drape.stats().p50 in the page, 1440x900 pane, dpr 2)
- crest-luminance: 0.83 (window.__drape.stats().p99, same run)
- dot-size-base: 4.8 (window.__drape.D.size)
- drift-change-mean: 0.57 (capture script run with --secs 4 on the page; meta.json curve, normal pass)
- ripple-amplitude: 0.09 (rips.push amp in page.html)
- pointer-push: 0.07 (push in the vertex shader)
- reduce-motion: still drape, no lean, no push, no ripples (capture script, reduce-motion pass)
- frame-time-ms: n/a (not measured; the pane was hidden during testing)
