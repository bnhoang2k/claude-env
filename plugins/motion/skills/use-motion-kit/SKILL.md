---
name: use-motion-kit
description: Use whenever the user asks to add, build, change, tune or fix any animation, transition, motion, hover or press feedback, entrance or exit, loading or idle loop, scroll effect, or drag-follow on a web page, web app or Artifact, in any project. Calls motion-kit without asking, then follows the kit's own AGENTS.md. Not for frame drops (use motion:animation-performance) or cutting motion (use motion:remove-animations). The specialist motion skills (choreograph, gestures) still take their numbers from motion-kit.
---

# Animate through motion-kit: do not ask

Every duration, easing, bounce and loop period on a web page comes from motion-kit. Do not ask whether to use it. Do not guess a number.

## 1. Install in the project

1. Find the newest tag: `git ls-remote --tags https://github.com/bnhoang2k/motion-kit`. Take the highest `vX.Y.Z`.
2. In the project folder, with a `package.json` present, run `npx github:bnhoang2k/motion-kit#<tag> init`. It installs the kit and Playwright, runs `npx playwright install chromium`, and adds one line to `CLAUDE.md`.
3. Skip step 2 when `node_modules/motion-kit/` already exists. Check its version against the newest tag and say so if it is older.
4. A project with no `package.json` and no folder of its own: make a scratch folder with `{"name":"t","private":true}` as `package.json`, and install there.

## 2. Follow the procedure

Read `node_modules/motion-kit/AGENTS.md` and follow its steps in order. Do not paraphrase them from memory; they change with the kit. In short: list the moments, decide whether each should move, check `bars/INDEX.md`, copy or adapt or build, use the kit's numbers, run `gate`, then read the `sheet` image.

Check what `bars/` holds before you plan to copy. In v0.5.0 it held only `INDEX.md` and `moments.json`, with no example page. When it has no example for your moment, take the Build path in AGENTS.md: read `kinds/<kind>/rules.md`, paste the block from `npx --no motion-kit knobs <kind>`, and tell the person that no example covers this moment.

## 3. After the gate

Run `ui-suite:lint-ui` on the page, like any web page. A gate result of `partial` is not a pass.

## 4. Artifacts

An Artifact has no project folder, so build the page in a scratch folder with step 1, then publish it.

What was observed with v0.5.0 (an idle page built from `knobs idle`, served as a plain static folder, Chromium via Playwright):

- A page that pastes the `KNOBS` block and has no imports needs no other file. It ran from `python3 -m http.server`: no failed requests, and the animated value changed between samples. Publish that one HTML file as the Artifact.
- The gate ran on the page. Under the kit's reduced-motion check it printed `failed: 1` for a page that reads its state through `__seek`; fix each failure line the gate prints before publishing.
- Compiled files in `node_modules/motion-kit/dist/src/core` and `dist/src/motion` import each other with relative paths only, no bare package names. So an import of `transition()` should resolve if the Artifact tool's `files` publishes those folders beside the page. That was not tested. Test it in the scratch folder first, and prefer the `knobs` path.
- Bar pages that copy `fonts/` and `trace.json` beside `index.html` should publish through `files` the same way. Not tested, because v0.5.0 shipped no bar page.
- The `motion-kit-kind` meta tag, `__seek` and `__state` are only for the gate. They are harmless in the published page.
