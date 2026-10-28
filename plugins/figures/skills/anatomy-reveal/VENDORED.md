# Vendored: anatomy-reveal

Source: https://github.com/annnguyentt/anatomy-reveal-skill at dd01e1c04559d79002da07862e26f8a5c2a07644 (2026-10-15), MIT, copyright (c) 2026 Ann Nguyen. It is a fork of `anatomy` (vendored next to it in `../anatomy`).

Kept: SKILL.md, LICENSE, THIRD_PARTY_NOTICES.md, references/, scripts/, template/. `template/.gitignore` ships as a normal dotfile.
Dropped: README.md (its Credit section is promotional), the root .gitignore, and demo/ (two PNGs and an MP4, about 2.5 MB; no code reads them).

Safety read before install (read-only, no code run): no agent-directed instructions, no hidden or encoded text, no runtime network calls. Every page loads from `file://`. Only `npm install` reaches the npm registry. `child_process` is used only in `scripts/new-project.mjs` (npm, node) and `template/motion/encode.mjs` (magick, ffmpeg, fixed argument arrays, no shell). The headless browser gets `--no-sandbox` on Linux only.

## Local patches (reapply on every upstream refresh)

1. `SKILL.md` description: narrowed to real physical objects. Dropped "an anatomy figure" as a trigger, and added pointers to `anatomy`, `explain-as-machine` and `artifact-diagramming`.
2. `SKILL.md`, Workflow step 9: the full blur render runs in the background from the main thread only. A helper process runs it in the foreground with an explicit timeout, or hands it back. Reason: a background task started by a helper process can finish after that process ends, and no one is told.
3. `template/package.json`: `puppeteer-core` pinned from `^23.0.0` to `23.11.1`.
4. `template/package-lock.json`: added, from the first install with `--ignore-scripts` (84 packages).
5. `scripts/new-project.mjs`: `npm install` gets `--ignore-scripts`.
6. `template/scripts/chrome-path.mjs` (new) holds `CANDIDATES` and `chromePath()`, moved out of `browser.mjs` so they load before `npm install`; Linux commands `google-chrome`, `chromium` and `chromium-browser` are also looked up on the PATH. `browser.mjs` imports and re-exports `chromePath()`.
7. `template/scripts/preflight.mjs` (new): checks Node, `npm`, a browser, `ffmpeg` and ImageMagick 7. `SKILL.md` gains a "Before you start" section that runs it, and its Files table lists both new files.

Related patches outside this folder: `../anatomy/SKILL.md` description points exploded views and reveal films here (anatomy's VENDORED.md, patch 4). The ui-suite taste hook triggers on `anatomy-reveal`.

## The kit compared with ../anatomy/kit

`template/kit` holds 6 of anatomy's kit files, and `new-project.mjs` copies it into every project. It is kept as its own copy so an upstream refresh of either skill stays a plain copy.
- `iso-kit.mjs`, `lathe.mjs`, `tube.mjs`, `turn-build.mjs`: byte-identical to `../anatomy/kit` at anatomy 240a9bf.
- `turn.mjs`: adds 11 material ramps (glass, pcb, sensor, signal, coffee, bean, milk, smoke, porcelain, lavender, knit) and two debug collectors (`globalThis.__t3forced`, `globalThis.__t3unsep`). THIRD_PARTY_NOTICES.md names 7 of the ramps and leaves out coffee, bean, milk and smoke.
- `audit.mjs`: 72 changed lines against anatomy 240a9bf, but 2 against upstream anatomy at e948829 (2026-10-15). The fork took newer upstream fixes. THIRD_PARTY_NOTICES.md does not mention them.

## Known issues (upstream, not patched)

- In the scaffolded example's `object/figure-light.html` at 1280 px, the hint line ("Drag to turn · Hover to take apart …") overlaps the live readout on the right while the object is at rest.
- `motion/encode.mjs` needs ImageMagick 7 (`magick`). The MP4 step was not tested for this reason. The scaffold, the figure pages and the motion page were.
