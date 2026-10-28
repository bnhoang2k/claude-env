# Intake procedure

This file is the whole procedure for intake mode of the `steal-mechanism` skill. It needs only a
clone (or fork) of https://github.com/bnhoang2k/motion-kit, called "the kit" below. Every kit path
below is relative to the kit's root, and `<skill>` is the folder that holds this file. Intake reads a graded bar page from the bar home and the
original capture from the captures folder. Both live outside the kit. Intake writes into the kit.

Words used here:

- **Bar:** a finished example of one motion. It is one folder, `bars/<slug>/`, holding a
  single-file page that opens from `file://`.
- **Kind:** the type of motion: `live` (a pointer drag), `idle` (a loop on a clock), `scroll`
  (scroll position), `choreo` (a staggered sequence after one tap, scroll or load) or `sim`
  (bodies moved by physics after a cause). The first kind in a bar's `kinds` list is its main kind.
- **Gate:** a check that runs the page headless and fails when the motion is wrong. Each gate
  must fail its planted faults before its pass is trusted.

## Which grades enter

| Grade | What happens |
|---|---|
| Pass | Enters. |
| Close, for assets only | Enters as a motion pass. The bar must carry an asset contract, so a copy can swap the pictures without touching the motion. |
| Close, for motion | Does not enter. It goes back to fix mode. |
| Needs kit | Does not enter. It waits for another kit. |

## What a bar folder holds

```
bars/
  INDEX.md             generated from every bar.json; never edit it by hand (pnpm gen:bars)
  moments.json         the fixed list of moment names
  <slug>/
    index.html         the page: one file, no build step, opens from file://
    bar.json           the public contract (fields below)
    bar.private.json   private: the source and the grade (fields below)
    study.md           private: the dissection of the original
    notes.md           how to reuse the page and what it teaches
    trace.json         values measured from the original capture (numbers only)
    gate.test.ts       the bar gate with its planted faults; one barGateSuite call
kinds/<kind>/
  rules.md             the rules every page of the kind must meet
  dials.json           the evidence list for the kit's public knobs
  gate.ts              the kind gate
```

- **Public files:** `index.html`, `bar.json`, `notes.md`, `trace.json`, `gate.test.ts`, and any
  font or file the page loads. They carry no personal name, no home or private path, no link to a
  private repository, chat or shelf, and no words about who graded or approved the page.
- **Private files:** `study.md` and `bar.private.json`. They hold no home paths and no names. One
  rule for committing them: if the kit has `scripts/check-public.mjs` (a private dev kit that strips
  private files at publish), commit them with the bar. Otherwise the kit is a public clone or fork:
  keep both untracked by adding `bars/<slug>/study.md` and `bars/<slug>/bar.private.json` to the
  clone's `.git/info/exclude`, and leave them out of the bar commit.
- **Never copied in:** the original's video, frames or pictures. They hold another site's content.

## `bar.json` fields

| Field | What it holds |
|---|---|
| `slug`, `title` | Folder name and a short title. |
| `kinds` | Main kind first. |
| `moments` | One or more names from `bars/moments.json`. |
| `rung` | The attention ladder: 1 quiet, 2 expressive, 3 immersive, 4 playable. A number, or `[lo, hi]` for a page that spans two. |
| `fits`, `wrongFor` | One line each. The index shows them. |
| `feel` | 1 to 3 sentences, at most 300 characters, on what the motion does in time, with its main numbers. |
| `dials` | 1 to 5 entries: `path` in the page's `MOTION` const, `value`, `unit`, `knob` (`<kind>.<field>`), and `row` (the `notes.md` row it came from). |
| `assetContract` | Per asset slot: `draw` (the selector or function that draws it), `aspect`, `view`, `facing`, `background` (`cutout` or `full-bleed`). |
| `clock` | The fixed-clock hook the page exposes, `__seek`. |
| `trace` | The channels in `trace.json`, in order, with the `tolerance` of each. |
| `faults` | The page's own planted faults, besides the standard ones: `name`, `find` (a string that occurs exactly once in `index.html`) and `replace`. |
| `superseded` | Optional: the slug of the bar that replaced this one. |
| `cover` | Optional: selectors of elements that move but that no trace channel reads, so the coverage check counts them. |

The `BarJson` interface in `src/core/bar.ts` is the exact contract. `node src/cli/motion-kit.ts
validate-bar bars/<slug>` checks a folder against it and lists every problem at once.

## `bar.private.json` fields

| Field | What it holds |
|---|---|
| `source` | `url` of the original reference and `captured`, the capture date. |
| `grade` | `verdict` (`pass` or `close-assets`), `date`, and `note` (the grade note). |

## Dials

A dial is a number in the page's `MOTION` const that sets how the mechanism feels in time. It is
not a position and not a time-step cap. A bar names 1 to 5 dials. Each dial copies the number; the
page keeps all its own numbers whole.

- The kit's `validate-bar` accepts a dial only when its `knob` is a key of `KNOB_FIELDS` in
  `src/core/kinds.ts`, and only when `kinds/<kind>/dials.json` holds an entry with the same bar
  slug and knob. That entry gives the `value` in the field's own shape and unit, the `path` (or
  a `from` map of raw values per path), and `convert` (`fromPhysics` turns a spring's omega and
  zeta into `visualDuration` and `bounce`). `kinds/live/dials.json` is the worked example. Adding
  a key to `KNOB_FIELDS` is a deliberate change to the kit, never part of intake.
- A kit that also keeps `kinds/<kind>/dial-set.json` files (one entry per concept: name, unit,
  one-line meaning) wants each dial named by an entry there. Reuse an entry whose meaning fits.
  Add a new one only when none fits, named for the concept, never for the page.
- A feel number that no key fits stays in `MOTION` and in `notes.md`. If `validate-bar` then
  rejects the bar because it has no valid dial, stop and report that line: it is a gap in the kit.

## Page hooks that intake adds

- **Fixed clock:** a `?seek` mode that runs no live loop, plus `window.__seek(ms)`, which draws the
  frame for that time. State on a drag or scroll page depends on what came before, so `__seek`
  re-runs the page from 0 to `ms` in fixed 1/60 s steps and feeds the recorded input
  (`window.__input`) on the way.
- **State read:** `window.__state()` returns the traced values and the events so far.
- **Motion timing:** all motion goes through the page's clock. Every `setTimeout`, `setInterval`,
  `performance.now()` and `Date.now()` in page script fails the audit unless its line carries
  `motion-kit:clock` (the page clock's own time read) or `motion-kit:not-motion` (a use that times
  no motion, such as a work budget).
- **Marker:** a copied bar carries `<meta name="motion-kit-bar" content="<slug>">`.

The page must still play exactly as before after the hooks go in.

## `trace.json`

Made from the original capture, with the measuring scripts of the rebuild run. It holds numbers
only, never frames.

- `input`: the pointer, scroll or key samples that drove the original, one per 1/60 s. A pointer
  sample is `[ms, x, y]` or `[ms, x, y, down]`; `down` 0 lifts the pointer until a later sample
  presses again. The live rules judge the first press.
- `channels`: 2 to 5 values, each with a name, a unit and how to read it from `__state()`.
- `samples`: those values every 1/60 s. Each row's time sits on the 1/60 s grid (k * 1000 / 60).
  Rows may be sparse. A channel not measured in a row holds `null`.
- `events`: named times in ms.

A channel the original capture cannot give is left out. Never trace a channel from the rebuild: the
bar gate would then only prove that the rebuild matches itself. The format is `TraceJson` in
`src/core/trace.ts`, and `TOLERANCE_FLOORS` there sets the lowest tolerance per unit.

## Gate A: the bar gate (one per bar)

Code: `src/gate/bar-gate.ts`, with `src/gate/harness.ts` and `src/gate/faults.ts`. It plays the
page in headless Chromium on the fixed clock, records the channels each frame and compares them
with `trace.json`.

**Pass:** every channel stays within its tolerance, and every event lands within 1 frame (17 ms).
Each tolerance is 2 times the rebuild's own measured error on that channel, never below the unit's
floor.

**Planted faults.** Each one must fail:

1. one dial off by 25%;
2. a curve swapped for linear;
3. reduced motion ignored;
4. each fault listed in `bar.json`.

## Gate B: the kind gate (every page of a kind)

Code: `src/gate/kind-gate.ts` and `kinds/<kind>/gate.ts`. It needs no original. It checks the rules
in `kinds/<kind>/rules.md` (read its "What the gate needs from the page" section whole before you
write the hooks), and a static audit: no duration, easing, spring or loop period is typed as a
literal outside `MOTION` and `KNOBS`. A copy of one of the kit's own bars is exempt, because it
keeps its measured numbers.

| Kind | Rules in short |
|---|---|
| all | No pop at the start of any motion. A pulse has a 40 to 120 ms attack. Fades only fall. One capped time step. The loop stops at rest. The console stays clean. Reduced motion: input still answers, the target is reached in 1 frame, and the still frame is not the blank start state. |
| scroll | Reduced motion gives at most 6 still states over a full sweep, with no continuous scroll-linked zoom, parallax or transform. Scrolling back reverses the motion. |
| idle | Pauses off screen. Resumes within one frame after coming back. |
| live | Follows the input. A release starts from the hand's speed. A regrab mid-settle picks up with no jump. |
| choreo | An interrupt 8 ms before and after every stagger boundary leaves every value continuous and nothing stuck. |
| sim | Energy only falls after the cause stops. Everything rests within 4 s. |

`kinds/<kind>/rules.md` is the full text. Each rule has a planted fault in the kit's tests.

### Checks on the gates themselves

1. A gate cannot pass on nothing: it must fail on a missing clock hook, a selector that matches 0
   elements, 0 recorded frames, and a `trace.json` with a channel missing.
2. Coverage: every element whose transform, opacity or filter changes must be read by a traced
   channel, a kind rule or `cover`.
3. No sudden jumps: no value goes from 0 to 1 in one frame unless `trace.json` marks a cut there.
   A smooth change halves when the seek step halves; a jump does not.
4. Real clock: each bar also runs once on the live animation-frame loop with a 2 s frame gap
   injected. No value may move more than its one-frame budget.
5. Every check exits non-zero on failure and prints `passed`, `partial` or `failed: n`. A partial
   run never passes.

## Intake procedure

1. **Confirm the grade.** Pass, or Close for assets only (see "Which grades enter"). Anything else
   stops here. The main kind must have a kind gate (`kinds/<kind>/gate.ts`).
2. **Copy the page** into `bars/<slug>/` with `study.md` and `notes.md`. Write the source and
   grade into `bar.private.json`. Scrub every private name, path, link and rating-file reference
   from the public files.
3. **Add the page hooks:** the fixed clock, the state read, and motion routed through the clock.
   The page must still match the graded page: `<skill>/scripts/intake/motion-diff.mjs` compares the
   `MOTION` numbers of the two.
4. **Write `trace.json`** from the original capture. Set each tolerance from the rebuild's own
   error: `<skill>/scripts/intake/rebuild-error.ts <page> <trace> --write` sets it to the larger of 2 times
   the error and the unit floor.
5. **Write `bar.json`:** moments from `bars/moments.json` (ask before adding one), `fits` and
   `wrongFor`, 1 to 5 dials, the asset contract, and the page's own fault. Write `gate.test.ts` as
   the one-line `barGateSuite` call that the bars in `bars/` use.
6. **Add the dials** to `kinds/<kind>/dials.json` (see "Dials"). The current base stays. Then run
   `pnpm gen:knobs`.
7. **Run the gates** in this order:
   - each planted fault, which must fail (`<skill>/scripts/intake/fault-effects.ts <bar dir>`);
   - `node src/cli/motion-kit.ts validate-bar bars/<slug>`;
   - the leak scan (`<skill>/scripts/intake/leak-scan.mjs <bar dir>`);
   - Gate A and the bar's own faults: `npx vitest run --config vitest.bars.config.ts bars/<slug>/gate.test.ts`;
   - Gate B: `node src/cli/motion-kit.ts gate bars/<slug>/index.html`;
   - the sheet: `node src/cli/motion-kit.ts sheet bars/<slug>/index.html --out <file>.png`. Read it
     beside the original's key frames. A sheet that does not read like the motion means the bar is
     not ready.
8. **Regenerate `bars/INDEX.md`** (`pnpm gen:bars`), run `pnpm typecheck`, `pnpm test` and
   `pnpm test:bars`, and commit (private files as the rule under "What a bar folder holds" says). The message states the problem, its implications and the solution.

If a gate mis-judges a legal motion, do not bend the page to hide it. Write the failing line, a
minimal repro and the reason the page is right into a note, and fix the gate in its own commit
with a planted-fault test.

`<skill>` is the folder that holds this file. `<skill>/scripts/intake/` holds the helper scripts. Run them with `MOTION_KIT` set to the kit, or let them find it at `$PROJECTS_ROOT/motion-kit`.
