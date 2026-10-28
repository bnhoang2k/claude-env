---
name: steal-mechanism
description: Use when the user likes a page, clip or site for how it moves and wants that motion studied and rebuilt ("steal the mechanism", "rebuild this motion", "add this to motion-kit", "make a bar page from this"), when bar pages graded Close need a fix run, or when a graded bar page is ready to enter motion-kit.
---

# Steal the mechanism

## Overview

A build copies motion well from a reference and badly without one. This skill turns a reference
the user liked into a **bar page**: a single-file rebuild of its motion, measured against the original
and shown side by side so the user can grade it. Graded pages later enter motion-kit as finished examples.

## Modes

| Mode | Input | Status |
|---|---|---|
| **study** | 1 or more references | Ready |
| **fix** | Pages graded Close for motion in `reviews.json` | Ready |
| **intake** | Pages graded Pass, or Close for assets only | Ready for live, idle and scroll. With the public kit, choreo and sim bars cannot pass `validate-bar` yet (no `KNOB_FIELDS` key for those kinds): list them as left out, like a hover or a tilt. Needs a clone or fork of https://github.com/bnhoang2k/motion-kit and follows `intake.md` in this skill's folder (the optional `spec` arg replaces it). |

Public kit gaps, as of 2026-10-27:

- It holds bars 04, 13 and 31 only, so a sim or choreo bar would have no worked example (the agents read the nearest kind).
- `src/core/kinds.ts` `KNOB_FIELDS` holds only `live.release`, `idle.period`, `scroll.smooth` and `scroll.maxStep`. Every dial must be one of them.
- It has no `CLAUDE.md`: the agents read its `AGENTS.md`.
- It has no `scripts/check-public.mjs`: the leak scan skips that pass and runs the publish deny list, and `study.md` and `bar.private.json` stay untracked (see Intake mode, step 5).
- It has no `kinds/*/dial-set.json`: `newDials` stays empty.

All three modes run one Workflow script, `workflows/run.js`. Needs Claude Code's Workflow tool.

## Before you start

Run `node "${CLAUDE_PLUGIN_ROOT}/skills/steal-mechanism/scripts/preflight.mjs" <mode>` with Bash. It
prints one line per need, `ok <tool>` or `needs <tool>: <where to get it>`. On exit code 3, stop:
show the user the `needs` lines and do not launch. Study and fix modes need `ffmpeg` and Playwright
or Puppeteer. Intake also needs the motion-kit clone and the `workflow` plugin's publish scripts
(see below), `pnpm` (https://pnpm.io/installation), the kit's dependencies (`pnpm install` in the
clone, which makes `node_modules`), and a Node version inside the kit's `package.json`
`engines.node` range. Plain `node` runs the kit's `.ts` files only on versions that strip types by
default, so the range is the rule; preflight compares it with the Node it runs on.

When `needs motion-kit checkout` is one of the lines, offer to fix it before you stop. Ask the user
one question: clone the public kit or their own fork (a fork if they want to push their bars), and
into which folder. Default to `$PROJECTS_ROOT/motion-kit` when `PROJECTS_ROOT` is set (intake finds it
there with no variable), else `~/motion-kit`. Never clone without their yes. On yes, run
`git clone <url> <folder>`, then `pnpm install` in it when `pnpm` is present. Unless the folder is
`$PROJECTS_ROOT/motion-kit`, tell the user how to set `MOTION_KIT` for good: add
`"MOTION_KIT": "<folder>"` to the `env` block of `~/.claude/settings.json` (it takes effect in the
next session), or export it in their shell profile. In this session, prefix each command with
`MOTION_KIT=<folder>`. Then run preflight again.

## Launch

Launch in two steps. The Workflow script has no filesystem and no environment, so a small Node
command resolves the paths first.

1. Run `node "${CLAUDE_PLUGIN_ROOT}/skills/steal-mechanism/workflows/args.mjs" '<json>'` with Bash.
   The JSON holds `mode`, `slugs` and any optional fields below. The command prints the resolved
   args: `root` (this skill's folder), `barHome`, `kit` (or null), `captures`, `capturesLink`
   (or null), `tools` (or null) and `spec` (the intake procedure's path). In intake mode it also
   prints `kitBars`, `kitDoc` and `kitDialSet`, which say what the kit holds.
2. Call Workflow with `scriptPath` set to `${CLAUDE_PLUGIN_ROOT}/skills/steal-mechanism/workflows/run.js`
   (expanded to an absolute path) and `args` set to that output. If the tool cannot read the plugin
   folder, ask the user to add it. Never re-send the script inline.

Where each path comes from:

- **Bar home** (`barHome`): `args.barHome`, else `$STEAL_BAR_HOME`, else
  `<current folder>/.steal-mechanism/bars/`. For the default, the command also makes sure
  `<current folder>/.steal-mechanism/.gitignore` holds the line `bars/*/capture/`, so side-by-side
  footage is never committed.
- **Captures root** (`captures`): `args.captures`, else `$STEAL_CAPTURES`, else `~/.claude/taste/captures`.
- **Captures link** (`capturesLink`, optional): `args.capturesLink`, else `$STEAL_CAPTURES_LINK`. A review
  page that reaches the captures through a link folder sets it, and `compare.json` then holds
  `original_video` as `<link>/<slug>/original/<file>`. With none, `original_video` is the absolute path.
- **motion-kit checkout** (`kit`): `args.kit`, else `$MOTION_KIT`, and in intake mode else
  `$PROJECTS_ROOT/motion-kit`. Study and fix modes do not need it. Intake mode needs a clone (or
  fork) of https://github.com/bnhoang2k/motion-kit and commits into that clone. Without one it stops
  with one line: "intake needs a motion-kit checkout: clone https://github.com/bnhoang2k/motion-kit
  and set MOTION_KIT to it".
- **Publish scripts** (intake leak scan): `$PUBLISH_PUBLIC_SCRIPTS`, else the `workflow` plugin found
  beside this one, both in a checkout of claude-env and in the plugin cache
  (`~/.claude/plugins/cache/<marketplace>/workflow/<newest version>/`). Set `PUBLISH_PUBLIC_SCRIPTS`
  only when that lookup fails. Find the folder with
  `ls -d ~/.claude/plugins/cache/*/workflow/*/skills/publish-public/scripts`.
- **Capture tools** (`tools`): `args.tools`, else `$STEAL_TOOLS`, a folder holding `capture.mjs` and
  `drive.mjs`. With none, the agents write their own headless-Chrome capture script.
- **Intake procedure** (`spec`, optional): `args.spec`, else `$MOTION_KIT_SPEC`, else `intake.md` in
  this skill's folder. That file holds the whole procedure and the field tables, so intake needs no
  other spec.

## Where captures go

The original captures (video, frames, downloaded source) of someone else's site are written to
`<captures root>/<slug>/` (`~/.claude/taste/captures/<slug>/` unless `STEAL_CAPTURES` says
otherwise), never into a plugin folder or a project repo. If a project
folder must hold one, the tool appends that path to the folder's `.gitignore` first. The public
export always drops `captures/`.

## What study mode needs installed

- `ffmpeg` (frame extraction and the side-by-side video).
- A headless-Chrome library the agents can drive, such as Playwright or Puppeteer, or a capture
  folder (`tools`) holding `capture.mjs` and `drive.mjs`.

## The review page is not part of this plugin

`gen-index.mjs` (builds the review page) and `serve-review.mjs` (saves the grades) are optional
tools that live in the bar home (`STEAL_BAR_HOME`). This plugin does not ship them.
Without them, grade by hand: open each page's `index.html` and `capture/side-by-side.mp4`,
then write `reviews.json` in the bar home yourself. Fix and intake modes read it. Its shape, one key
per slug:

```json
{
  "35-example": { "status": "close", "retries": 3, "note": "what is wrong, in your words", "at": "2026-01-01T00:00:00.000Z" },
  "36-example": { "status": "pass", "note": "", "at": "2026-01-01T00:00:00.000Z" },
  "37-example": { "status": "kit", "kits": ["paint", "model"], "note": "waits on a paint or model kit", "at": "2026-01-01T00:00:00.000Z" }
}
```

- `status` is `pass`, `close`, `fail` or `kit`. No mark means no key.
- `retries` is a whole number from 1 to 10, set only on `close`. It caps the fix tries.
- `kits` is set only on `kit`, from `paint` and `model`.
- `note` is the brief fix mode works from; `at` is an ISO date.

If your bar home has `gen-index.mjs` and `serve-review.mjs`, use them as the steps below say.

## Study mode

The bar home is the `barHome` folder resolved at launch (see above).

1. Add one entry per new reference to `refs.json` in the bar home. Required: `slug` (kebab-case,
   numbered after the last entry, such as `35-...`), `url`, `mechanism` (one line) and `note`
   (the user's words). Optional: `group`, `stars`, `study`, `members`, `section`. If another page
   already has the same `group`, add a `title` too: the review page shows the title (or the
   group), and `gen-index.mjs` refuses two pages with the same shown name.
2. State the cost before launch: **3.5 units and 4 agents per reference, worst case** (3 opus and
   1 sonnet). 10 references is 35 units. Above 15 units, ask the user first.
3. Launch `run.js` with the JSON `{ "mode": "study", "slugs": ["35-...", "36-..."] }`.
4. When it ends, clean the run's pages (see "After every run"). If your bar home has
   `gen-index.mjs`, run `node gen-index.mjs` in it, start a local preview that serves the bar pages, and tell the user which pages to grade. Otherwise tell the user which
   pages to grade by hand (see "The review page is not part of this plugin").
   Either way, let the user try each page, not only watch the video: serve the bar home over
   localhost (`python3 -m http.server <free port> --bind 127.0.0.1` in it; pick a port nothing
   listens on) and open two browser tabs, the imitation (`http://127.0.0.1:<port>/<slug>/index.html`)
   and the original (its `url` from `refs.json`). Say which tab is which. The in-app browser pane
   refuses `file://`, so a local file shows blank there. Stop the server once the user has graded.

Each page folder gets `study.md`, `trace-original.json`, `index.html`, `notes.md` and
`compare.json`. It also gets `capture/side-by-side.mp4` and `capture/strip.jpg`, which are git-ignored.
`trace-original.json` holds input samples and measured values from the original. Intake builds
motion-kit's `trace.json` from it.

## Fix mode

1. Pick the slugs graded `close` in `reviews.json` whose note is about motion or drawing. A note
   that says only the assets are wrong is a motion pass and gets no fix.
2. State the cost: **2 units and 2 agents per page** (Fix and Match, both opus).
3. Launch `run.js` with the JSON `{ "mode": "fix", "slugs": [...] }`. Fix reads the user's note as
   the brief and their `retries` number as the cap. Its own edit counts as try 1.
4. Clean the run's pages (see "After every run"). Check each page's `compare.json` `fix` field,
   then run
   `node <skill>/scripts/regrade.mjs <bar home> <slugs>`. It moves the old marks to
   `reviews-history.json`, so the review page shows those pages as unmarked.
5. If your bar home has `gen-index.mjs`, regenerate the review page. Tell the user which pages to re-grade.

## Intake mode

Intake carries a graded page into `<kit>/bars/<slug>/` as a bar. The three pilot bars
(04, 13, 31) are the finished shape. Agents do the per-bar work in parallel (steps 1 to 5 of the
intake procedure in `intake.md`, and the bar's own gates), each inside its own bar folder. Every shared file and every commit
is yours, one bar at a time.

1. **Pick the slugs.** Graded `pass`, or `close` with a note about assets only, and not yet in
   `bars/`. The main kind must have a kind gate: live (a pointer drag), idle (a loop on a clock),
   scroll (scroll position), choreo (a staggered sequence after one tap, scroll or load) or sim
   (bodies moved by physics after a cause). A hover with no press or a device tilt waits for its
   input kind; the agent returns `blocked` for those. With the public kit, choreo and sim bars
   cannot pass `validate-bar` yet (no `KNOB_FIELDS` key for those kinds): list them as left out,
   like a hover or a tilt.
   Screen each slug before you spend an agent, from its `study.md` Input and Feel sections and its
   `trace-original.json`. With the public kit, leave out a page that (a) answers a hovering pointer
   (`input.samples` have no press, `down` 0, from the first sample), even when a press also fires
   something: the live gate judges the first press, and finds none; or (b) has feel numbers that
   are not one of the four `KNOB_FIELDS` keys (a first-order ease, a trail life or a one-shot pulse
   fits none: only a spring release, an idle period or a scroll smoothing does). Say which rule
   left it out. A stranger's first hover page costs an agent for nothing otherwise (seen on a
   hover-and-press page: `engine-gap`, gate lines `follows: no value moves` and `regrab: cannot
   aim a regrab`, then `unknown knob "live.trail"`).
   The first time, run 3 (one per launchable kind: live, idle, scroll) and show the user before the rest.
2. **State the cost:** **2 units and 2 agents per bar** (Intake and Check, both opus), or **1 unit
   and 1 agent** with `"lean": true`. Lean drops the Check agent, reads one finished bar of the
   same kind instead of three, and has the Intake agent quote `rebuild-error.ts` and re-measure 5
   rows per channel itself. Use lean when the weekly limit is tight. Above 15 units, ask the user
   first. Don't launch a bar whose kind has no gate (a hover, a tilt), or a choreo or sim bar against
   the public kit (see step 1): list it as left out. Check the free disk space: frames are extracted from the originals.
3. **Launch** `run.js` with the JSON `{ "mode": "intake", "slugs": [...] }` (set `MOTION_KIT` first, unless the clone is `$PROJECTS_ROOT/motion-kit`). Wait for it to end.
4. **Read each result.** `blocked` stays out; say why. `needs-decision` holds a new moment: ask
   the user (one AskUserQuestion, a real recommendation first). Dials never reach the user. In a kit that keeps
   `kinds/<kind>/dial-set.json` files, each dial names an entry there, and `newDials` lists the entries
   a bar adds. The public kit keeps none: each dial names a `KNOB_FIELDS` key and `newDials` stays empty.
   Dedupe them across the batch (the same concept under two names becomes one, named for the
   concept, not the page). A public knob (`KNOB_FIELDS` in `src/core/kinds.ts`) changes only by a
   deliberate promotion, never during intake. `engine-gap` names a note under the bar home's `<slug>/intake/`: fix the
   kit's gate in its own commit (`Bar gate: ...` or `Kind gate: ...`) with its planted-fault test in
   `test/bars/`, then rerun that bar's checks. Fix for the class of motion, never for the one bar:
   add style-sweep cases (`test/bars/style-sweep.test.ts`, `loop-sweep.test.ts`, or a new sweep for
   a new class) where honest variants across the style's range pass and each planted fault fails
   at every point. A new or loosened rule then gets a blind class review: state the cost first
   (3 to 4 opus agents, 1 unit each), give them the rule and its class but not the bar, and have
   each write only to its own scratch folder. Every page a reviewer makes that breaks the rule
   becomes a sweep case and a fix before the bar goes on. Check the folder yourself before you trust `ready`:
   `git status --short bars/<slug>/` lists only that bar's files.
5. **Per bar, in slug order** (each step on one bar before the next bar starts):
   - Add its `newDials` entries to `kinds/<kind>/dial-set.json` (only in a kit that keeps those files). For a dial on a public knob, add
     its entry to `kinds/<kind>/dials.json` (`value` in the field's own shape; `from`, `convert`
     and `path` as the pilot entries do), keep the current base, then `pnpm gen:knobs`.
   - `pnpm gen:bars`, then `pnpm typecheck`, `pnpm test` and `pnpm test:bars`. Run `test:bars`
     in the background: it takes minutes.
   - `node src/cli/motion-kit.ts sheet bars/<slug>/index.html --out <scratchpad>/<slug>.png` and
     read it. A sheet that does not read like the motion means the bar is not ready.
   - Commit only that bar's files plus the shared files it changed, subject `Bar NN: <title>
     (<kind>)`, with a Problem / Implications / Solution body from the result's `commitNotes`.
     Private files, one rule: if the kit has `scripts/check-public.mjs` (a private dev kit that strips
     private files at publish), commit `study.md` and `bar.private.json` with the bar. Otherwise the
     kit is a public clone or fork: keep both untracked by adding `bars/<slug>/study.md` and
     `bars/<slug>/bar.private.json` to the clone's `.git/info/exclude`, and leave them out of the commit.
6. **Report** each bar, its gate result lines and its sheet, and the slugs left out with the
   reason. Never push without asking, naming the repo and branch.

After an intake run, clean each page's capture folder as below, and delete the bar home's
`<slug>/intake/check/` frame folders once the bar is committed.

## After every run: keep only the final results

Agents are told to delete their check pictures, and many do not, and leftover try folders pile
up to gigabytes over many pages. So after every study or fix run, run:

1. `node <skill>/scripts/clean-captures.mjs <bar home> <slugs>`. This is a dry run: it lists what
   it would delete.
2. The same command with `--apply`. It keeps `capture/side-by-side.mp4`, `capture/strip.jpg` and
   every tracked file, and deletes everything else under `capture/` plus untracked pictures and
   videos elsewhere in each page folder. The original captures are outside the bar home and stay,
   because intake needs them.

Only clean pages whose run has ended. A live agent's files vanish under it, and a scan that hits a
vanishing file means a run is still going.

## Grades and what follows

- **Pass:** run intake mode.
- **Close:** if the note says only the assets are wrong ("needs actual pictures"), it counts as a
  motion pass and enters by intake, with an asset contract. Otherwise run fix mode.
- **Fail:** restudy it, or swap in another member of the same group (`members` in `refs.json`).
- **Needs kit:** parked for another kit (paint or model). Spend no retries on it.

## Commits

Commit each page folder's `study.md`, `trace-original.json`, `index.html`, `notes.md` and
`compare.json`, plus `refs.json`, `reviews.json` and `reviews-history.json`. Leave out the agents' scratch folders (`check/`, `drive/`,
`match/`, `measure/`, `tools/`, `intake/` and loose `*.mjs` drive scripts) and `capture/`. Bars
enter motion-kit through intake mode, which commits there.

## Common mistakes

- **A resume re-runs finished agents.** To finish part of a run, launch a fresh run over only the
  missing slugs.
- **The disk fills up.** A study page can leave 400 to 750 MB of try folders until it is cleaned.
  Check the free space before a run of 10 or more.
- **An intake agent edits a shared kit file.** The prompt forbids it, but check `git status` in
  motion-kit after every intake run, before the first commit.
- **The same URL with only a new hash** does not reload the review page. Add `?v=N`.
