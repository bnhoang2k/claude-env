---
name: new-project
description: Use when the user starts a new project or notes repo and wants it scaffolded with a standard Claude Code config (CLAUDE.md skeleton, sector convention, wired hooks, DESIGN.md). Triggered by 'new project', 'scaffold a project', 'set up a repo like my others'. Instantiates the archetypes in this skill with parameter fill.
---

Scaffold a new project from the archetypes in this skill. In this file, `<skill base>` means `${CLAUDE_PLUGIN_ROOT}/skills/new-project`. The heavy lifting is `<skill base>/instantiate.sh`, which needs `jq` (https://jqlang.org/download/) and `python3` on the PATH; your job is gathering parameters, running it, and walking the verification checklist.

## Step 1: Pick the archetype

Use AskUserQuestion (one decision): **flagship** (full app: CLAUDE.md skeleton, sector convention, wired hooks, DESIGN.md — pairs with a brain repo), **brain** (docs-only knowledge vault: six-zone Phases framework, Templates, Superpowers dirs), or **thin-site** (single CLAUDE.md, in-repo specs/plans, no brain). Flagship and thin-site both get `DESIGN.md` with a `## UI system` block.

## Step 2: Gather parameters

Read `<skill base>/archetypes/PARAMETERS.md` for the full token table. Collect values for every token the chosen archetype uses (discover with `grep -rhoE '{{[A-Z_]+}}' <skill base>/archetypes/<archetype>/ | sort -u`; for flagship and thin-site, also search `<skill base>/archetypes/_shared/`).

- Ask via AskUserQuestion, ONE decision per question; batch related free-text values into a single question with sensible defaults offered.
- Path tokens (`PROJECT_PATH`, `BRAIN_PATH`, `BRAIN_SPEC_PATH`, `PHASE_MAP_PATH`): write them from the projects root, e.g. `$PROJECTS_ROOT/<name>` and `$PROJECTS_ROOT/<name>Brain`, never a literal home path. Create the repos themselves under `$PROJECTS_ROOT` (run `echo $PROJECTS_ROOT` to get the folder).
- `DEV_PORTS`: propose ports NOT present in the ports registry (read it first if it exists). The registry is the file named by `NEW_PROJECT_PORTS`, default `~/.claude/new-project/ports.md`. The script hard-fails on collisions (exit 3).
- `UI_STACK`: `react-web`, `swiftui`, `html` or `none`. A preset exists only where `presets/<id>/` exists in the ui-lock folder that Step 3b finds.
- Defaults are fine for infra choices (lint/typecheck/test commands follow the stack); present them as "defaulting to X".

Write the collected values as JSON (keys = token names) to a temp file.

## Step 3: Instantiate

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/new-project/instantiate.sh" <archetype> <target_dir> <params.json> --dry-run   # show manifest first
bash "${CLAUDE_PLUGIN_ROOT}/skills/new-project/instantiate.sh" <archetype> <target_dir> <params.json>            # then write
```

For **flagship with a brain**: run twice — once `flagship` into the project dir, once `brain` into the sibling `<project>Brain` dir (brain tokens: PROJECT_NAME, PROJECT_PATH, BRAIN_PATH, VAULT_NAME = brain dir name, PALETTE_ACCENT — confirm the full set with the Step-2 grep).

Exit codes: 2 = missing/unfilled tokens (fix params), 3 = port collision (pick another port) or `jq` missing (the message says which).

Then `git init` the target(s) if not already a repo, and make the initial commit.

## Step 3b: Install the ui-lock preset

ui-lock ships in the sibling `ui-suite` plugin. Find it first. The ui-lock folder (`<ui-lock root>`, which holds `bin/` and `presets/`) is, in a checkout, `<skill base>/../../../ui-suite/ui-lock`. In the plugin cache it is `<skill base>/../../../../ui-suite/<newest>/ui-lock`, where `<newest>` is the highest version folder by numeric compare (1.10.0 is newer than 1.9.0). This script prints the folder, or a not-found message:

```bash
SB="${CLAUDE_PLUGIN_ROOT}/skills/new-project"
UL="$(python3 - "$SB" <<'PY'
import glob, os, re, sys
sb = sys.argv[1]
tail = os.path.join("ui-lock", "bin", "ui-lock.py")
checkout = os.path.join(sb, "..", "..", "..", "ui-suite", "ui-lock")
if os.path.isfile(os.path.join(checkout, "bin", "ui-lock.py")):
    print(os.path.normpath(checkout)); sys.exit(0)
def key(p):
    ver = os.path.basename(os.path.dirname(os.path.dirname(os.path.dirname(p))))
    return [int(n) for n in re.findall(r"\d+", ver)]
cache = glob.glob(os.path.join(sb, "..", "..", "..", "..", "ui-suite", "*", tail))
if cache:
    print(os.path.dirname(os.path.dirname(os.path.normpath(max(cache, key=key)))))
PY
)"
echo "${UL:-ui-suite plugin not found}"
```

If it prints the not-found message, skip Step 3b and tell the user that the preset install needs the `ui-suite` plugin. Otherwise call the printed folder `<ui-lock root>`. If the preset folder `<ui-lock root>/presets/<UI_STACK>/` exists, run:

    mkdir -p <lint-dir>
    python3 "<ui-lock root>/bin/ui-lock.py" install <UI_STACK> <lint-dir>

`<lint-dir>` is the folder that will hold the lint config: the repo root, or the front-end folder when the front end lives in one. A fresh flagship has no front-end folder yet, so `mkdir -p` creates it; without it, install exits 3. Show the user the wiring steps it prints.

- If `<lint-dir>` already has an eslint config, follow the printed wiring steps now.
- If not, keep the stamp. Add `<!-- fill: wire ui-lock when the lint config exists -->` under the `## UI system` block in `DESIGN.md`.

If no preset exists for the stack, leave `| Preset | none |` and say so.

Then commit `DESIGN.md` and `<lint-dir>/.ui-lock/`. The initial commit in Step 3 does not hold them.

## Step 4: Verification checklist (print this for the user; run what you can)

1. `jq -e . .claude/settings.json` — valid wiring.
2. Every hook referenced in `.claude/settings.json` exists under `.claude/hooks/` and is executable.
3. If the archetype shipped `.githooks/`: `git config core.hooksPath .githooks` (per-clone, not committed).
4. Open a Claude Code session in the new repo: confirm the hooks fire (edit a file → pre-edit reminder; `git push` → confirm prompt) and CLAUDE.md loads.
5. Fill the `<!-- fill: ... -->` guidance comments in CLAUDE.md before the first real feature. Fill `Token home` and `Component home` in the `## UI system` block of `DESIGN.md` now: the preset's lint throws while they hold fill markers.
6. Run the project's gates once (`{{LINT_CMD}}`-equivalents from the params) to confirm the commands are real.
7. `python3 "<ui-lock root>/bin/ui-lock.py" status <lint-dir>` (the folder from Step 3b) prints `<stack>@<n> is current.` (skip when no preset).

## Gotchas

- Never scaffold over a non-empty directory without showing `--dry-run` output and getting explicit confirmation.
- The ports registry is the file named by `NEW_PROJECT_PORTS` (default `~/.claude/new-project/ports.md`). The script creates it on the first real run. If the user keeps it inside a repo, commit the updated registry after a successful scaffold.
- Brain repos get NO agents/hooks/rules — those live in the paired code repo.
