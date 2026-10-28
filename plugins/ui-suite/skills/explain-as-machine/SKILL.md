---
name: explain-as-machine
description: Use when the user asks how something in a project works and wants to see it — "explain it visually", "draw it", "show me how X works", "I don't get how X works" — and the concept has moving structure (a pipeline, filter, cache, queue, state machine, lock, retry loop, scheduler). Also use when a plain-prose explanation of such a concept has already failed. Not for one-line answers, purely linear steps (a numbered list does that), a side-by-side comparison of two systems (an inline structural diagram does that), or a finished figure for docs or a landing page (use figures:anatomy).
---

# Explain as a machine

## Overview
Draw the concept as a small physical machine whose working *is* the concept, using the vendored `figures:anatomy` kit. **The picture is the analogy.** An analogy that only lives in the prose next to a boxes-and-lanes diagram is the failure this skill exists to fix.

This is a sketch: about 10 minutes, one connected machine (several moving parts are fine), 20–60 solids. It is not an anatomy Figure.

## Steps
1. **Pick a faithful machine.** Every moving part maps to one real thing in the code, named by its symbol (`merge_similar`, `similarity ≥ 90`). Prefer a machine the user can picture from daily life: a coin sorter, a sieve, a mail-room sorting rack, a turnstile, a ticket dispenser. If two parts of the concept would map to the same piece, pick another machine.
2. **Use real data and the real rule.** Take example inputs from the code, its tests, or its fixtures, and compute every number the readout shows with the rule the code uses. If the inputs are invented, the card says so. If part of the rule is unknown (which hash, which fuzzy library), use the closest standard implementation and name that assumption in chat.
3. **Build it.** `<anatomy>` below is the folder of the `figures:anatomy` skill, a sibling plugin: load that skill with the Skill tool and use the base directory it prints. Pick the starting file by shape:
   - One part the reader steers: `<anatomy>/examples/dial-indicator/build.mjs`. Replace its two kit imports with the three lines at the top of the reference below.
   - Items moving through stages one after another: `${CLAUDE_PLUGIN_ROOT}/skills/explain-as-machine/reference/dedup-bench.mjs`. It has a beats list (one script of timed poses per item) and moves an item's `<g>` into a bin or tray group so the drawing order stays right as it passes walls.

   Copy it to `<scratchpad>/<slug>/build.mjs` and swap the machine. Keep: static parts built once, one `<g data-part>` per moving part, one `tick(dt)` loop with eased targets, an idle tour, and a readout computed from the model. Draw at `WIDTH` 900 or more and pass `theme: "light"` to `pageHtml` (ui-suite:ui-taste `## 6. Where the rest lives`, the explaining-pages line: near-white). Name the 3–5 parts that matter in the card's `keys` legend, not as text printed on the base, which renders too small to read. Before designing, read only the "Craft rules (short form)" section of `<anatomy>/SKILL.md`. Skip the audit, the 4× sweep, WebGL and 3D.
4. **Render and check.** Run `ANATOMY_DIR=<anatomy> node build.mjs`. If nothing serves the scratchpad yet, start `python3 -m http.server <port> --bind 127.0.0.1` there from the main thread in the background; reuse it after that. Open the page in the browser pane, take a screenshot, and read the console for errors. Fix anything that overlaps, clips, is too small to read at 1×, or doesn't move, then check again. A pane tab can report itself hidden and throttle the animation: if the parts look frozen, check `document.hidden` before changing code. The browser pane is where the user sees it.
5. **Say it in chat, short.**
   - One sentence for the analogy.
   - One line per part: `<machine part> = <code symbol>`.
   - One sentence on where the analogy breaks.

## Common mistakes
| Mistake | Fix |
|---|---|
| Lanes, dots or boxes, with the analogy only in prose | The machine is the picture. Name its parts after real objects. |
| Dark theme or a 640px drawing | Light theme, `WIDTH` 900 or more. |
| Building a full anatomy Figure | One connected machine, 60 solids at most. |
| Claiming it works without opening it | Step 4's screenshot and console check, every time. |
| A pretty analogy that teaches the wrong behaviour | Every part maps to a symbol. Say where it breaks. |
| A build that writes into a plugin folder (`${CLAUDE_PLUGIN_ROOT}` or `<anatomy>`) | Build only in the scratchpad copy. |
