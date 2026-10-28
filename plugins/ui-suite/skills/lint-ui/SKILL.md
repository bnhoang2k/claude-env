---
name: lint-ui
description: "Use before calling any web UI or HTML Artifact done, and whenever the user reports misaligned or overlapping text, text running off its box or the page, cramped or tiny buttons, low contrast, redundant on-screen text, or hint and instruction lines in a UI. Web pages only, not native SwiftUI."
---

# Lint a rendered UI

Three checks on the page as it renders. The **copy pass** judges wording, which no tool can. The **ruler** (lintapple) measures boxes and stock phrases. The **text-edge check** catches what the ruler cannot: text pushed out of line by an icon, a dot or padding. The ruler's alignment rule runs only on elements you mark, so an unmarked `Passed: 0 UI findings` says nothing about text edges. The text-edge check needs no marks, and the end-of-turn gate requires it. Together they enforce ui-suite:ui-taste principle 1 (form speaks, words don't) and principle 4 (order you can measure). They do not replace the real-target walk in ui-suite:ui-taste `## 5. Process`, step 1.

Serve the page first. The browser pane refuses `file://`. For loose HTML or an Artifact, run `python3 -m http.server 8765 & SRV=$!; <commands>; kill $SRV` in its folder, in one foreground command. For an app, use its dev server.

## 1. Copy pass (first: cuts change the layout)

1. Get every visible string: `get_page_text` in the browser pane, or the rendered DOM.
2. Mark each string that:
   - repeats what a control, label, icon, color or position already shows;
   - tells the user how to use the page (hint lines, instructional headings, "drag to reorder");
   - spells out an action a small icon button carries;
   - is an internal tag or enum value, or a second name for something already named.
3. Delete each marked string. If a real meaning would be lost, move it into a hover card.

## 2. Ruler: lintapple

1. Copy `ui-policy.json` from this skill's folder next to the page (project root, or the scratchpad for an Artifact). Set `fonts` to every family in the page's font stack, the generic one too. Set `fontSizes` to the project's type tokens. No tokens: keep the defaults. Never set them to the page's current sizes; that passes by definition.
2. Mark the layout:
   - `data-ui-align="start"` (or `center`, `end`) on each column whose items share a left, centre or right edge; `data-ui-align-item` on the element that holds each item's text. Horizontal only; an item belongs to its nearest group.
   - `data-ui-stack` on stacks, `data-ui-actions` on button groups, `data-ui-container` on surfaces with a visible edge (border or background) that hold buttons, `data-ui-content` on text boxes, `data-ui-number` on changing numbers, `data-ui-radius` and `data-ui-radius-inner` on nested rounded surfaces.
   - Icon buttons need a linked `role="tooltip"` element (`aria-describedby` or `data-ui-tooltip`).
   - `data-ui-embed` on the root of an embedded screen of another product: a facsimile, replica or live demo of that app, set in its own type and colors on purpose. The policy's one built-in exception skips its subtree for that product's design rules (type, contrast, clipping, spacing, number alignment, control sizing, copy). Accessibility and page-level rules still run, and every skipped finding prints as suppressed. Mark only a screen that copies another product; the page's own parts never get it.
3. Run it: `npx -y lintapple@0.1.20 http://localhost:8765/page.html --config ui-policy.json`. Add `--ready '<selector>'` for a page that loads late. The first run downloads Chromium (about 94 MB). Tally a long run with `grep -E '^[a-z-]+ \(' | sort | uniq -c`.
4. Read the exit code. 0 is a pass. 1 is findings. 2 means the check did not finish, which is not a pass. Keep the first output line (`Passed: 0 UI findings ...` or `Failed: N UI findings ...`) in what the command prints. The end-of-turn check (`lint-ui-gate.py`) lets a turn end only when it sees `Passed: 0 UI findings` from a lintapple run on the changed page **and** a passing text-edge check (section 3) or `data-ui-align` marks in the changed code.
5. Cover every changed state: empty, ui-suite:break-ui's worst-case data, menu or dialog open. A plain run does not test hover, focus or open states (the JSON says "not tested without an interaction plan"). Run a copy of the page with that state rendered, or pass `--interactions <plan.json>` (format: `src/interactions.js` in the package).

Fix the interface, never the policy. Do not add `exceptions` beyond the built-in `data-ui-embed` one, delete marks, or set `overflow: hidden` to get a pass. A policy change needs the user's request.

## 3. Text-edge check (required, no marks needed)

It checks both edges. Left: text blocks stacked in one column whose left edges almost line up. Right: text blocks at the right end of their row (right-aligned, or the last item of a `justify-between` or `flex-end` row) whose right edges almost line up. "Almost" means more than 1px apart, at most 32px. The usual cause is an icon, dot or avatar beside the text, or padding on some items only (a ghost button with 10px padding above values that end flush right). It compares where the text ends, not the box. It ignores centered text, `text-indent`, list markers, svg text, and an indent that repeats on both sides with nothing in the gap and no nested list or quote behind it. For the right edge it also skips text that wraps to several lines, unless it is right-aligned.

Run it headless, from the project folder, with the page served (or an `.html` path):

`npx -y -p lintapple@0.1.20 node ${CLAUDE_PLUGIN_ROOT}/skills/lint-ui/text-edge-auto.mjs http://localhost:8765/page.html`

It loads the page at 390px and 1440px, prints `Text edges: 0 near-misses` on success, and otherwise `Text edges: N near-misses` followed by each group's edges and items ("text starts at Apx and Bpx" or "text ends at Apx and Bpx"). Exit 0 is a pass, 1 is findings, 2 means the check did not finish, which is not a pass. Add `--ready '<selector>'` for a page that loads late. Keep the first output line in what the command prints; the gate reads it.

Or paste the whole of `text-edge-auto.js` into `javascript_tool` in the browser pane, at 390px and 1440px width (`resize_window`). It returns `{check: 'textEdgeAutoV1', line: 'Text edges: 0 near-misses', findings: []}`. Keep that result in view.

Fix a near-miss by moving the text, never the check. Put the icon after the text, hang it in the margin (absolute, negative left), or give every item in the column the same lead. For padding on the right end (a ghost button), hang it with a negative right margin equal to the padding. Do not add padding to the others to match, and do not hide the item from the check.

`text-edge.js` still reads marked groups (`data-ui-align`, `data-ui-align-item`) in the browser pane and returns `aligned` per group. Use it when you want a group's exact edges. It does not replace the automatic check.

## 4. Report

State the routes, states and viewports checked; the ruler's final exit code and `Passed:` line; the `Text edges:` line; the findings fixed; and the strings cut.

## What each check sees

| Check | Sees |
|---|---|
| Ruler, no marks | text size, font, contrast (light and dark), control size, gap between buttons, icon-button tooltips, off-screen and sideways scroll, banned phrases |
| Ruler, with marks | box alignment, text overflowing its box, tabular digits, button padding in a container, concentric corners |
| Text-edge (automatic) | text start of stacked blocks, and text end of blocks at the end of a row, off a shared edge by 1 to 32px: icon beside text, padding on some items |
| Text-edge, marked groups | the exact text start of each marked group |
| Copy pass | redundant, instructional or mislabeled text |

Adapted from lintapple (github.com/gholtzap/lintapple, MIT, see `LICENSE`), version 0.1.20. Measured: on a seeded page, a fresh agent using this skill went from 186 findings to `Passed: 0 UI findings across 4 page checks.` and cut all 4 seeded copy faults. The ruler passed a 6px padding offset that `text-edge.js` caught (`[340,346,340]`). The ruler also passes a page with a 16px icon before each heading, which puts the text 24px off the heading's edge; `text-edge-auto.mjs` fails it, and passes the same page with the icon after the text or hung in the margin. It also fails a ghost button with 10px padding at the right end of a heading above right-aligned values (text ends 10px apart), and passes it with `margin-right: -10px`.
