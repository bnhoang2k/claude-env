# Vendored capture tools

These tools come from reanimate, https://github.com/NiazMorshed2007/reanimate, MIT license (`LICENSE` in
this folder), at commit `3f7a55a2986a84ca2173e86ee9127eefe31d046d` (2026-10-31), folder `skills/reanimate/`.

## What they do

| Tool | Job |
|---|---|
| `capture` | Records a page headless at a fixed viewport and fps. Writes frames, video, `inspect.json` (every CSS and Web Animations API animation with its real duration, delay and easing), `track.json` (position, size, opacity and transform of chosen elements on every frame) and, with `--gl`, the WebGL trace. `--clock virtual` makes every frame exact and every capture identical. |
| `frames` | Extracts frames from a video or gif at a set fps, time range and crop. |
| `sheet` | Builds labelled filmstrip sheets, or reference / clone / diff comparison sheets. |
| `compare` | Pixel diff of two frame sets, auto-aligned, with timing error, activity curve and a report. |
| `easing` | Fits a named easing (or spring) to a tracked property, and diffs two tracks. |
| `gl` | Reads a `--gl` capture: shaders, uniforms, scene graph, animated channels; compares two. |

Run each one through `node run.mjs <tool> [args]`: it checks Node, the packages and ffmpeg first.
`docs/` holds reanimate's own guides to the outputs (`capture.md`, `analysis.md`, `verify.md`,
`webgl.md`). Read them as tool manuals; the bar page rules in `SKILL.md` and `workflows/run.js` win
where they differ.

## Changes from upstream

- Run under Node (22.18 or later strips the TypeScript types) instead of Bun, through `run.mjs`,
  which turns a missing need into one `needs ...` line.
- `gl.ts` runs its command line when `run.mjs` names it the entry, not only on `import.meta.main`.
- `lib.ts` `ffmpegPath` uses the system ffmpeg first; `ffmpeg-static` is dropped from `package.json`.
- Usage text and `docs/` say `node run.mjs <tool>` instead of `bun <tool>.ts`, and `<folder>/`
  instead of `.reanimate/<name>/`.
- Not vendored: `setup.sh`, `bun.lock`, the upstream `SKILL.md` and the demo site.

Bug fixes on top of upstream (each guarded by `tests/capture/run.mjs`; worth offering upstream):

- `frames.ts`: `-fps_mode passthrough` instead of `-vsync 0`, which ffmpeg 7 and later reject.
- `capture.ts` tracker: samples after the page's own frame callbacks, not before them, so JS-driven
  motion no longer reads one frame (16.7 ms) late while CSS motion reads on time.
- `inpage/clock.js`: `cancelAnimationFrame` during a frame now skips that frame's callback, as browsers do.
- `capture.ts`: `--pre-js` or `--pre-hover` with `--trigger load` stops with a message instead of being
  skipped silently.
- `easing.ts`: `--compare-selector` names the element in the other track; a selector missing there is
  one plain error, not a crash.
- `run.mjs` turns any tool error into one line (`CAPTURE_DEBUG=1` shows the stack).

## Updating

Clone upstream into a fresh folder, read the diff of `skills/reanimate/scripts/` since the commit
above, copy the changed files over, and redo the changes listed here. Update the commit line.
