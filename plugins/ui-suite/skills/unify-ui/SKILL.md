---
name: unify-ui
description: "Use when the user asks to check or fix visual consistency across screens, says pages or components look different from each other, asks to merge duplicate components into shared blocks, and before any plan that touched UI is called done. Finds drift that lint allows (the same job built twice, one role with several looks, blocks missing from the catalog) and merges it through impeccable extract with their approval."
---

# Unify a UI

Lint (the ui-lock preset) stops raw values and raw controls. This skill finds what lint allows: the same job built twice, one role with several looks, and blocks nobody approved. ui-suite:lint-ui checks one page; ui-suite:break-ui feeds one page worst-case data; this checks across pages.

## 1. Read the UI system

Two terms used below:
- `<lint-dir>` is the folder that holds `.ui-lock/`. Find it with `find . -name .ui-lock -not -path '*/node_modules/*'`.
- "The lint command" is the repo's lint script that runs eslint and stylelint.

1. Read the `## UI system` block in the repo's DESIGN.md: stack, token home, component home, catalog, preset.
2. Run `python3 "${CLAUDE_PLUGIN_ROOT}/ui-lock/bin/ui-lock.py" status <lint-dir>`. Exit 1: say the preset is behind and offer `sync`. Exit 2 or 3: say what is missing or what failed; the code scan still runs. Exit 4: say the plugin is behind the repo and tell the user to update the ui-suite plugin; do not offer `sync`.

## 2. Scan the code

1. **Disables:** `rg -n "eslint-disable|stylelint-disable|swiftlint:disable" <source dirs>`. List each with its reason. A disable without a reason is a finding.
2. **Catalog gaps:** list each block in the component home with no catalog entry (Storybook: no `<Name>.stories.*` beside it).
3. **Same job twice:** list components outside the component home (`rg -l "export (default )?function [A-Z]"` in feature folders). Group candidates by name. Read each group and decide whether it is one job built twice. Section 3 adds a second check on these groups.

## 3. Render (web only)

1. Start the dev server. List every route from the router or the sitemap.
2. Set the browser pane to 1440 wide. On each route, run `collect-styles.js` (this folder) with `javascript_tool`. Save each result to `<scratchpad>/unify-ui/<route-slug>.json`.
3. Run `node <this folder>/summarize.mjs <scratchpad>/unify-ui/*.json`. Each `DRIFT` line is a role with more than one look, with the properties that differ, and the route, `box`, and `vp` (viewport), `ph` (pageHeight) and `dpr` of one example per look.
4. **One role, several looks:** match each `DRIFT` role to the candidate groups from section 2, step 3. Two groups for one role is the same job built twice. Add it to the findings.

A look that matches a variant of a component-home block is not drift.

Native stacks skip this section for now. Check one role with several tokens by grepping token use per component.

## 4. Report and choose

1. Build one local HTML page. For each drift group: the role, each look side by side as a real crop, its count and routes, and the proposed merge. The look to keep is the most common one unless DESIGN.md says otherwise.
2. Make each crop from an example's `box` (page coordinates, in CSS pixels). Use it as-is with the scale-1 screenshot. Collect styles in a window at device scale 1 too, because layout at DPR 2 can shift boxes by a few pixels.
   - Screenshot the route with headless Chrome. Use the example's `viewport` and `pageHeight`: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --force-device-scale-factor=1 --hide-scrollbars --window-size=<viewport>,<pageHeight> --screenshot=<file>.png <url>`.
   - Crop with `sips --cropOffset <y> <x> -c <height> <width> <file>.png --out <crop>.png`. Careful: sips takes Y before X, and height before width.
   - Embed the crops in the page.
3. Serve it and open it in the browser pane.
4. Ask the user with AskUserQuestion (multiSelect) which merges to do.

## 5. Merge

For each chosen merge, run the `impeccable` skill with `extract`. Tell it:
- the target is the component home from DESIGN.md, and the catalog entry is required;
- two implementations of the same job is enough to merge (override its 3-use default);
- ui-suite:ui-taste applies.

The user approves the new block in the catalog. Then switch every old copy to it and delete the copies.

## 6. Verify

- The lint command passes.
- Before and after screenshots of each migrated screen match, except for the approved merge.
- ui-suite:lint-ui passes on the touched pages.

Report: the routes scanned, each drift group and what happened to it, every disable and its reason, the catalog gaps, and the lint exit code.
