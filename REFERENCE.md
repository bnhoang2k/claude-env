# Reference

The details behind [README.md](README.md).

## Install one group

The plugin `bnhoang2k` installs all five groups below. To install one group instead, name it:

```
claude plugin install ui-suite@claude-env
```

To try a working copy of a group for one session, run `claude --plugin-dir plugins/<group>`.

## Every skill

Call a skill as `<group>:<skill>`.

- **ui-suite**: UI taste, lint, break-test and consistency skills, with the hooks that inject taste rules and gate unlinted pages.
  Skills: `ui-suite:taste`, `ui-suite:ui-taste`, `ui-suite:lint-ui`, `ui-suite:break-ui`, `ui-suite:unify-ui`, `ui-suite:ui-iteration-guardrail`, `ui-suite:show-me`, `ui-suite:explain-as-machine`.
- **motion**: study how a page or clip moves, then rebuild the mechanism.
  Skill: `motion:steal-mechanism`.
- **models**: check 3D models and rooms for geometry and layout defects before they ship.
  Skills: `models:break-models`, `models:break-scene`.
- **workflow**: planning, review, documentation and hand-off skills for long agent-driven work.
  Skills: `workflow:archive-plans`, `workflow:babysitter`, `workflow:blind-panel`, `workflow:handoff`, `workflow:llm-pipeline-spike`, `workflow:prior-art-check`, `workflow:publish-public`, `workflow:recall`, `workflow:where-are-we`, `workflow:workflow-fanout-budget`, `workflow:writing-project-docs`.
- **figures**: isometric technical figures and product reveals built as interactive pages.
  Skills: `figures:anatomy`, `figures:anatomy-reveal`, `figures:hairline-create`.
- **bnhoang2k**: installs the five groups above. It has no skills of its own.

## Requirements

- `python3` for the hooks.
- Node for the scripts.
- `gitleaks` on your PATH, for `workflow:publish-public`. Its secret scan runs the `gitleaks` command, and the first publish fails without it.
- `motion:steal-mechanism` needs Claude Code's Workflow tool. Study mode also needs `ffmpeg` and a headless-Chrome library that an agent can drive, such as Playwright or Puppeteer. The skill's SKILL.md lists this under "What study mode needs installed".

## Groups that use each other

- `ui-suite:explain-as-machine` uses the `figures` plugin (the `anatomy` skill).
- The intake leak scan in `motion:steal-mechanism` uses the `workflow` plugin's publish scripts. When you install from the marketplace, set `PUBLISH_PUBLIC_SCRIPTS` (see the table below).

The `bnhoang2k` plugin installs all five, so the dependencies are met. If you install a single group, install the one it uses too.

## Optional settings

All of these are environment variables. Most have a working default. `MOTION_KIT` has none and is needed for intake, and `ANATOMY_DIR` is set by the skill itself.

| Name | What it does | Default |
|---|---|---|
| `STEAL_BAR_HOME` | Folder for the pages that `steal-mechanism` builds | `.steal-mechanism/bars/` in the current folder |
| `STEAL_CAPTURES` | Folder for captures of other people's sites | `~/.claude/taste/captures/` |
| `STEAL_CAPTURES_LINK` | Link folder through which a review page reaches the captures | none (absolute paths are used) |
| `STEAL_TOOLS` | Folder holding `capture.mjs` and `drive.mjs` | none (agents write their own capture script) |
| `MOTION_KIT` | Checkout of a motion kit | none; intake mode refuses to run without it |
| `PUBLISH_PUBLIC_HOME` | Config folder for `workflow:publish-public` | `~/.claude/publish-public/` |
| `PUBLISH_PUBLIC_SCRIPTS` | Folder of the publish scripts, used by the leak scan in `steal-mechanism` | the sibling `plugins/workflow/skills/publish-public/scripts` in a checkout of this repo; for an installed plugin, set it to that folder inside the workflow plugin |
| `ANATOMY_DIR` | Folder of the `figures:anatomy` skill, read by the `ui-suite:explain-as-machine` build and bench scripts | set by the skill on each render; set it yourself only to run the bench script by hand |

Taste lives in `~/.claude/taste/`. The first `/ui-suite:taste` run seeds it from the plugin's starter. Captures go to `~/.claude/taste/captures/` and never leave the machine.

## Set up publish-public

`workflow:publish-public` checks a private repo and stages commits for a public one. Before the first run, build its config folder, `~/.claude/publish-public/`.

The example files and the `data/hooks/` folder live in the installed workflow plugin's folder, under `skills/publish-public/data/`. In a checkout of this repo that is `plugins/workflow/skills/publish-public/data/`. The scripts are in `skills/publish-public/scripts/` next to it, written below as `<scripts>`.

1. Install `gitleaks` and make sure the `gitleaks` command is on your PATH.
2. Copy the example files from that `data/` folder and edit them:
   - `deny.example.json` becomes `deny/base.json` (your deny rules).
   - `deny-samples.example.json` becomes `deny/base.samples.json` (one sample line per rule).
   - `plants.example.json` becomes `plants.json` (the fake leaks the reviewer must find).
   - `identity.example.json` becomes `identity.json` (the public name and email).
3. Copy that `data/hooks/` folder to `~/.claude/publish-public/hooks/`, then run `chmod +x` on the three files in it: `dev/pre-commit`, `dev/commit-msg` and `public/pre-push`. `install-guards.mjs` stops with "hook missing or not executable" without them.
4. Run `node <scripts>/install-guards.mjs dev <privateRepo>` and `node <scripts>/install-guards.mjs public <privateRepo>`. Both take the private repo, because it holds `publish.json`. The skill's SKILL.md has the full steps and the `publish.json` fields.

## Credits

Five skills come from other projects. All are MIT licensed, and each LICENSE file ships unchanged in the skill's own folder (`plugins/<group>/skills/<name>/`).

- `lint-ui` (in `ui-suite`): adapted from [lintapple](https://github.com/gholtzap/lintapple) by Gavin Holtzapple
- `break-ui` (in `ui-suite`): from Emil Kowalski's design-engineering work. The skill folder records no upstream link, only his name in the LICENSE and SKILL.md.
- `anatomy`: [wheresryan22/anatomy](https://github.com/wheresryan22/anatomy)
- `anatomy-reveal`: [annnguyentt/anatomy-reveal-skill](https://github.com/annnguyentt/anatomy-reveal-skill)
- `hairline-create`: [lucasmarkes/hairline](https://github.com/lucasmarkes/hairline)

## ui-lock

`ui-lock` installs a stack's UI lint preset into a repo and keeps it in sync. The one preset today is `react-web` (ESLint and Stylelint).

```bash
python3 <ui-suite plugin>/ui-lock/bin/ui-lock.py install react-web <lint-dir>
python3 <ui-suite plugin>/ui-lock/bin/ui-lock.py status <lint-dir>
python3 <ui-suite plugin>/ui-lock/bin/ui-lock.py sync <lint-dir>
```

`<lint-dir>` holds the repo's lint config, and the preset lands in `<lint-dir>/.ui-lock/`. It reads the nearest `DESIGN.md` at or above `<lint-dir>`. The rules it adds are listed in the preset's `RULES.md`.
