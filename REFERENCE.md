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
  Skills: `workflow:archive-plans`, `workflow:babysitter`, `workflow:blind-panel`, `workflow:handoff`, `workflow:llm-pipeline-spike`, `workflow:new-project`, `workflow:plan-review`, `workflow:prior-art-check`, `workflow:publish-public`, `workflow:recall`, `workflow:where-are-we`, `workflow:workflow-fanout-budget`, `workflow:writing-project-docs`.
- **figures**: isometric technical figures and product reveals built as interactive pages.
  Skills: `figures:anatomy`, `figures:anatomy-reveal`, `figures:hairline-create`.
- **bnhoang2k**: installs the five groups above. It has no skills of its own.

## What each skill needs

No install script exists. Each skill names the tools it needs, and the long or paid ones check for them first with a preflight (below). A tool is named by its exact command. An environment variable that overrides a command is named next to it. Every skill needs Claude Code itself.

Shared by many: `python3` (3.9 or newer; every hook runs with `python3` or `bash`), Node (`node`) and `git`. Two `workflow` hooks, `pre-push-confirm-main` and `pre-explore-guard`, need `jq` as well. Without `jq` each prints one line to stderr and lets the call through, so the push check does nothing. Download `jq` from https://jqlang.org/download/.

### Preflights

A preflight checks a skill's tools before the skill spends time or money. Three scripts serve four skills. All follow one contract:

- One stdout line per need: `ok <tool>` or `needs <exact tool name>: <where to get it>`.
- Exit 0 when every need is found, 3 when any is missing, never a stack trace.
- A preflight that takes a mode prints `usage: ... <a|b|c>` to stderr and exits 2 when run with none.
- When a skill gets exit 3 it stops and shows you the `needs` lines.

In a checkout of this repo, run them as:

```bash
node plugins/motion/skills/steal-mechanism/scripts/preflight.mjs <study|fix|intake>
node plugins/figures/skills/anatomy-reveal/template/scripts/preflight.mjs
python3 plugins/models/skills/break-models/scripts/preflight.py
```

`models:break-models` and `models:break-scene` share the last one. `tests/checks.d/26-preflights.sh` runs each with a PATH that holds only `node` and `python3`.

### Per skill

| Skill | Needs | Without it |
|---|---|---|
| `ui-suite:taste` | `python3`, to seed and check `~/.claude/taste/` | The taste folder cannot be seeded or checked; edit its files by hand |
| `ui-suite:ui-taste` | `python3`, for the `ui-taste-inject` hook and the seed script. Optional: the `taste-skill` plugin (see Plugins) | The hook does not paste taste in; read the skill by hand |
| `ui-suite:lint-ui` | Node and `npx`. The first run downloads `lintapple@0.1.20` from the npm registry and Chromium (about 94 MB), so it needs network. `python3` serves loose HTML pages | No measured lint, so a page cannot pass `lint-ui-gate` |
| `ui-suite:break-ui` | Nothing to install. A browser tool is optional, for screenshots | Findings are reasoned from the CSS and marked as not seen |
| `ui-suite:unify-ui` | `python3`, `rg` (ripgrep, https://github.com/BurntSushi/ripgrep#installation), Node, Google Chrome (https://www.google.com/chrome/) or Chromium (`CHROME_PATH`, else `google-chrome`, `chromium` or `chromium-browser` on the PATH, else the macOS app), Pillow (`python3 -m pip install Pillow`) for `crop.py` | The code scan needs `rg`; the screenshot step stops with `needs Google Chrome or Chromium: set CHROME_PATH`; `crop.py` prints `needs Pillow` |
| `ui-suite:ui-iteration-guardrail` | Nothing | Nothing |
| `ui-suite:show-me` | Claude desktop app tools `mcp__visualize__read_me` and `mcp__visualize__show_widget` | Builds the picture as an HTML file or Artifact and says where it is |
| `ui-suite:explain-as-machine` | The `figures` plugin (the `anatomy` skill), Node, `python3` to serve the page, Chrome (https://www.google.com/chrome/) for the check screenshot. The skill sets `ANATOMY_DIR` itself | No machine page without `figures`; see "Groups that use each other" |
| `motion:steal-mechanism` | Claude Code's Workflow tool, `ffmpeg` (https://ffmpeg.org/download.html), and Playwright or Puppeteer (an npm library an agent can drive). Intake adds a clone of https://github.com/bnhoang2k/motion-kit (`MOTION_KIT`), `pnpm` (https://pnpm.io/installation), `pnpm install` run once in the clone, Node inside the kit's `engines.node` range, and the `workflow` plugin's publish scripts (`PUBLISH_PUBLIC_SCRIPTS`). Preflight, with the mode | The skill stops before it launches and shows the `needs` lines |
| `models:break-models` | Blender 5.0 or newer (https://www.blender.org/download/; `blender` on the PATH, or `BLENDER` set to the executable, or the macOS app at `/Applications/Blender.app`) and Pillow (`python3 -m pip install Pillow`). Preflight | Stops with the `needs` lines |
| `models:break-scene` | Same as `models:break-models`, and the Agent tool for the blind cold read. Preflight | Stops with the `needs` lines |
| `workflow:archive-plans` | Nothing to run. Optional: the `superpowers` plugin, which writes the specs and plans it files | Files any spec and plan you name |
| `workflow:babysitter` | Claude desktop app session tools (`start_session`, `get_usage`), the `SendMessage` and `CronCreate` tools, and `git`. A notes repo is optional | Cannot start or watch other sessions; run the plans one at a time yourself |
| `workflow:blind-panel` | The Agent tool, for the reviewer subagents | No blind reviewers; review the artifact yourself |
| `workflow:handoff` | `git`, for the branch and status lines | The prompt carries no git lines |
| `workflow:llm-pipeline-spike` | Nothing to run. Optional: `superpowers`, and the built-in `anthropic-skills:deep-research` | Find the cause and write the test by hand; search the web directly |
| `workflow:new-project` | `bash`, `jq`, `python3`, `git`. The lint-preset step needs the `ui-suite` plugin. `NEW_PROJECT_PORTS` moves the ports file | `instantiate.sh` prints `needs jq: https://jqlang.org/download/` and exits 3 |
| `workflow:plan-review` | Claude Code's Agent tool. No third-party plugin | No reviewer agent; read the plan against the code yourself |
| `workflow:prior-art-check` | A web search tool. Optional: the built-in `anthropic-skills:deep-research` | The search step has nothing to run |
| `workflow:publish-public` | Node, `pnpm` (https://pnpm.io/installation), `gitleaks` on the PATH (https://github.com/gitleaks/gitleaks#installing), the `claude` command logged in with access to the opus model, and the config folder (`PUBLISH_PUBLIC_HOME`) with `deny/base.json`, `deny/base.samples.json`, `plants.json`, `identity.json` and `hooks/`. The private repo needs a `package.json` with `build` and `test` scripts, a `publish.json`, and no `docs/` folder. See "Set up publish-public" | A run stops partway: `no deny rules configured`, `gitleaks` not found, or a refused `docs/` folder |
| `workflow:recall` | `git`, and the built-in Explore agent. Optional: `superpowers` for the planning and execution stages, and `show_widget` for the card | The briefing works; write the plan yourself and get approval before code; the card is plain markdown |
| `workflow:where-are-we` | `git`, `ListAgents`, and Claude desktop app tools `mcp__ccd_session_mgmt__*` for sessions it started | The card skips linked sessions and says so |
| `workflow:workflow-fanout-budget` | Claude Code's Workflow and Agent tools, `ListAgents`. Optional: `superpowers` | The wave rules still hold; use one `git worktree` per overlapping task |
| `workflow:writing-project-docs` | Nothing to run. Optional: `superpowers` for specs and plans | Keep the docs in the project's `docs/`; write specs and plans by hand |
| `figures:anatomy` | Node, and Google Chrome (https://www.google.com/chrome/) or Chromium for the capture and check scripts (`CHROME_PATH`; Playwright's Chromium cache is also searched) | No screenshots or checks; the build scripts still run |
| `figures:anatomy-reveal` | Node 20 or newer, `npm`, Google Chrome (https://www.google.com/chrome/), Chromium or Edge (`CHROME_PATH`), `ffmpeg` (`FFMPEG`; https://ffmpeg.org/download.html), ImageMagick 7, the `magick` command (`MAGICK`; https://imagemagick.org/script/download.php). Preflight | Stops with the `needs` lines |
| `figures:hairline-create` | Node. `look.mjs` also needs Chrome (https://www.google.com/chrome/), or Playwright's Chromium, and network once: it installs `playwright-core` into a cache folder (`HAIRLINE_LOOK_CACHE` moves it) | Check with `validate.mjs` and do the look by hand, as `look.md` says |

### Plugins

Third-party plugins are not bundled with claude-env and nothing declares them. Install one with `claude plugin install <id>`. Each skill says what it does without the plugin.

| Plugin | Install id | Used by | Without it |
|---|---|---|---|
| `superpowers` | `superpowers@claude-plugins-official` | `workflow:archive-plans`, `workflow:llm-pipeline-spike`, `workflow:recall`, `workflow:workflow-fanout-budget`, `workflow:writing-project-docs` | Each skill works; do the Superpowers steps by hand, as the table above says |
| `taste-skill` | `taste-skill@taste-skill`; add its marketplace first with `claude plugin marketplace add Leonxlnx/taste-skill` | `ui-suite:ui-taste` | `ui-suite:ui-taste` is the whole design brief |
| `anthropic-skills` | Built in to some Claude apps; no install id | `workflow:llm-pipeline-spike`, `workflow:prior-art-check` | Search the web directly |

`tests/checks.d/27-plugin-needs.sh` fails when a skill names a plugin that is not in this table, when a row has no install id, and when a shipped skill has no row in the table above.

### Outside a skill

- Every hook runs with `python3` or `bash`.
- `jq` is needed by `pre-push-confirm-main`, `pre-explore-guard` and `workflow:new-project`.
- `gitleaks` on your PATH is needed by `workflow:publish-public`. Its secret scan runs the `gitleaks` command, and the first publish fails without it.
- The `name-lint` hook stays silent until you build the `publish-public` config folder.

## Groups that use each other

- `ui-suite:explain-as-machine` uses the `figures` plugin (the `anatomy` skill).
- The intake leak scan in `motion:steal-mechanism` uses the `workflow` plugin's publish scripts. It finds them beside the `motion` plugin, in a checkout of this repo and in the plugin cache. Set `PUBLISH_PUBLIC_SCRIPTS` only when that lookup fails (see the table below).

The `bnhoang2k` plugin installs all five, so the dependencies are met. If you install a single group, install the one it uses too.

## Optional settings

All of these are environment variables. Most have a working default. `MOTION_KIT` is needed for intake unless the kit sits at `$PROJECTS_ROOT/motion-kit`, and `ANATOMY_DIR` is set by the skill itself.

| Name | What it does | Default |
|---|---|---|
| `STEAL_BAR_HOME` | Folder for the pages that `steal-mechanism` builds | `.steal-mechanism/bars/` in the current folder |
| `STEAL_CAPTURES` | Folder for captures of other people's sites | `~/.claude/taste/captures/` |
| `STEAL_CAPTURES_LINK` | Link folder through which a review page reaches the captures | none (absolute paths are used) |
| `STEAL_TOOLS` | Folder holding `capture.mjs` and `drive.mjs` | none (agents write their own capture script) |
| `MOTION_KIT` | Your clone (or fork) of https://github.com/bnhoang2k/motion-kit. Intake mode commits into it | `$PROJECTS_ROOT/motion-kit`; with neither, intake stops and says to clone the kit |
| `MOTION_KIT_SPEC` | Intake procedure file that replaces the one shipped with the skill | `intake.md` in the `steal-mechanism` skill folder |
| `WORKFLOW_GATE_FABLE` | Makes `agent-model-gate` and `workflow-tier-gate` deny a Fable-class model pin without a `FABLE-APPROVED:` line in the prompt. On for `1` or `true` (any case) | off |
| `WORKFLOW_GATE_TIERS` | Makes `workflow-tier-gate` deny a Workflow script with no `// TIERS:` comment block. On for `1` or `true` (any case) | off |
| `NEW_PROJECT_PORTS` | File where `workflow:new-project` records the dev ports it has claimed. A new project may not claim a port that is already in it | `~/.claude/new-project/ports.md`, created on the first scaffold |
| `PUBLISH_PUBLIC_HOME` | Config folder for `workflow:publish-public` | `~/.claude/publish-public/` |
| `PUBLISH_PUBLIC_SCRIPTS` | Folder of the publish scripts, used by the leak scan in `steal-mechanism` | found for you: the sibling `plugins/workflow/skills/publish-public/scripts` in a checkout of this repo, else the newest `workflow` version in the plugin cache. Set it only when that fails. Find the folder with `ls -d ~/.claude/plugins/cache/*/workflow/*/skills/publish-public/scripts` |
| `CHROME_PATH` | Path of the Chrome, Chromium or Edge executable, for `figures:anatomy`, `figures:anatomy-reveal` and `ui-suite:unify-ui` | found in the usual places for your system |
| `FFMPEG` | The `ffmpeg` command that `figures:anatomy-reveal` runs | `ffmpeg` on the PATH |
| `MAGICK` | The ImageMagick 7 command that `figures:anatomy-reveal` runs | `magick` on the PATH |
| `BLENDER` | Path of the Blender executable, for `models:break-models` and `models:break-scene` | `blender` on the PATH, else `/Applications/Blender.app/Contents/MacOS/Blender` |
| `ANATOMY_DIR` | Folder of the `figures:anatomy` skill, read by the `ui-suite:explain-as-machine` build and bench scripts | set by the skill on each render; set it yourself only to run the bench script by hand |

Taste lives in `~/.claude/taste/`. The first `/ui-suite:taste` run seeds it from the plugin's starter. Captures go to `~/.claude/taste/captures/` and never leave the machine.

## Set up publish-public

`workflow:publish-public` checks a private repo and stages commits for a public one. Before the first run, build its config folder, `~/.claude/publish-public/`.

The example files and the `data/hooks/` folder live in the installed workflow plugin's folder, under `skills/publish-public/data/`. In a checkout of this repo that is `plugins/workflow/skills/publish-public/data/`. The scripts are in `skills/publish-public/scripts/` next to it, written below as `<scripts>`.

1. Install `gitleaks` (https://github.com/gitleaks/gitleaks#installing) and make sure the `gitleaks` command is on your PATH.
2. Copy the example files from that `data/` folder and edit them:
   - `deny.example.json` becomes `deny/base.json` (your deny rules).
   - `deny-samples.example.json` becomes `deny/base.samples.json` (one sample line per rule).
   - `plants.example.json` becomes `plants.json` (the fake leaks the reviewer must find).
   - `identity.example.json` becomes `identity.json` (the public name and email).
3. Copy that `data/hooks/` folder to `~/.claude/publish-public/hooks/`, then run `chmod +x` on the three files in it: `dev/pre-commit`, `dev/commit-msg` and `public/pre-push`. `install-guards.mjs` stops with "hook missing or not executable" without them. The hooks find the scripts through `scripts-dir`, which holds a plugin version folder. After a plugin update they pick the newest version folder themselves. Hook files you copied before v0.2.0 do not do this and stop at the first update with `scripts-dir missing`: copy the three files again from the new `data/hooks/`.
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
