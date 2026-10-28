# Archetype Parameters

Every `{{UPPER_SNAKE}}` token used anywhere under `archetypes/`. When instantiating an archetype
for a new project, resolve every token below before deleting the `.tmpl` suffix (or rendering
into its final filename).

Token discovery is mechanical: `grep -rhoE '\{\{[A-Z_]+\}\}' archetypes/ --include='*.tmpl' --include='*.sh' --include='*.html' --include='Phases-CLAUDE.md' | sort -u`
must be a subset of this table. The claude-env repo's tests enforce this.

| Token | Meaning | Example | Consumed by |
|-------|---------|---------|-------------|
| `{{PROJECT_NAME}}` | The project's short slug/name — used in paths, `/tmp` sentinel filenames, plugin ids, titles. | `myapp` | flagship `CLAUDE.md.tmpl`, `settings.json.tmpl`, all 3 `hooks/*.sh`; `_shared/DESIGN.md.tmpl` (flagship and thin-site); brain `CLAUDE.md.tmpl`; brain `Templates/synthesis-dashboard.html`; thin-site `CLAUDE.md.tmpl` |
| `{{PROJECT_PATH}}` | Path to the code repo, written from the projects root. | `$PROJECTS_ROOT/myapp` | flagship `CLAUDE.md.tmpl`; brain `CLAUDE.md.tmpl` |
| `{{BRAIN_PATH}}` | Path to the sibling "brain" knowledge repo, written from the projects root (specs, phases, decisions). Omit this token's consumers entirely for the thin-site archetype — it has no brain repo. | `$PROJECTS_ROOT/myappBrain` | flagship `CLAUDE.md.tmpl`, `hooks/post-edit-rules.sh`, `hooks/pre-edit-mistakes.sh`; brain `CLAUDE.md.tmpl`; brain `Templates/synthesis-dashboard.html` |
| `{{BACKEND_STACK}}` | One-line backend stack summary (language, framework, DB, key libraries). | `Python 3.12+, FastAPI, SQLite, Playwright` | flagship `CLAUDE.md.tmpl` |
| `{{FRONTEND_STACK}}` | One-line frontend stack summary. | `Vite + React 18 + TypeScript strict + Tailwind` | flagship `CLAUDE.md.tmpl`; thin-site `CLAUDE.md.tmpl` |
| `{{TOOLCHAIN}}` | The package/environment manager or build tool that provisions and runs everything. | `uv` | flagship `CLAUDE.md.tmpl`, `gitignore.tmpl`; thin-site `CLAUDE.md.tmpl`, `gitignore.tmpl` |
| `{{LINT_CMD}}` | The canonical lint/format command. | `ruff check && ruff format` | flagship `CLAUDE.md.tmpl`; thin-site `CLAUDE.md.tmpl` |
| `{{TYPECHECK_CMD}}` | The canonical strict type-check command. | `mypy --strict` / `tsc -b` | flagship `CLAUDE.md.tmpl`, `hooks/pre-edit-mistakes.sh`; thin-site `CLAUDE.md.tmpl` |
| `{{TEST_CMD}}` | The canonical test-suite command. | `pytest` / `vitest run` | flagship `CLAUDE.md.tmpl`; thin-site `CLAUDE.md.tmpl` |
| `{{DEV_PORTS}}` | Local dev server port(s), for CLI-entrypoint documentation. | `127.0.0.1:8765` | flagship `CLAUDE.md.tmpl` |
| `{{ARCHITECTURE_BOUNDARY}}` | The one non-negotiable architectural boundary in this codebase, stated as a rule (what may not import/call what). | `core/ imports nothing from adapters/ or pipeline/` | flagship `CLAUDE.md.tmpl` (used twice — the rule statement and the "Banned in X" heading target), `sector-CLAUDE.md.tmpl`, `hooks/post-edit-rules.sh`, `hooks/pre-edit-mistakes.sh` |
| `{{BANNED_IMPORTS}}` | The exact import paths/modules forbidden from the pure/core layer. | `src.adapters.*, src.pipeline.*, src.api.*` | flagship `CLAUDE.md.tmpl` |
| `{{BRAIN_SPEC_PATH}}` | Path to the canonical product/technical spec doc. | `$PROJECTS_ROOT/myappBrain/README.md` | flagship `CLAUDE.md.tmpl`, `sector-CLAUDE.md.tmpl`, `hooks/pre-edit-mistakes.sh` |
| `{{PHASE_MAP_PATH}}` | Path to the high-level phase map doc. | `$PROJECTS_ROOT/myappBrain/Development_Phases.md` | flagship `CLAUDE.md.tmpl` |
| `{{UI_STACK}}` | The UI stack id that picks the ui-lock preset: `react-web`, `swiftui`, `html`, or `none` for a project with no UI. | `react-web` | `_shared/DESIGN.md.tmpl` (flagship and thin-site) |
| `{{VAULT_NAME}}` | The Obsidian vault name registered for the brain repo — must match exactly what Obsidian has registered (folder name is the default), since it's used in `obsidian://` deep links. | `myappBrain` | brain `CLAUDE.md.tmpl`; brain `Templates/synthesis-dashboard.html` |
| `{{PALETTE_ACCENT}}` | The accent hex/oklch color for the synthesis-dashboard HTML template's light/dark themes. | `#2563eb` | brain `Templates/synthesis-dashboard.html` |

## Notes

- Path tokens (`PROJECT_PATH`, `BRAIN_PATH`, `BRAIN_SPEC_PATH`, `PHASE_MAP_PATH`) are written
  from `$PROJECTS_ROOT`, never as a literal home path. The rendered files then
  survive a move of the projects folder. `settings.json` sets `$PROJECTS_ROOT` for every
  session; an agent expands it with `echo $PROJECTS_ROOT` before a Read.
- The thin-site archetype deliberately has no `{{BRAIN_PATH}}`, `{{BRAIN_SPEC_PATH}}`, or
  `{{PHASE_MAP_PATH}}` consumers — it has no sibling brain repo. Its `CLAUDE.md.tmpl` points at
  `docs/superpowers/{specs,plans,Archive}` in-repo instead.
- Tokens that don't resolve cleanly to a single value (e.g. a project with no locked frontend
  stack yet) should stay as an explicit `<!-- fill: ... -->` marker in the rendered file rather
  than being deleted — an empty rule is worse than a visible gap.
