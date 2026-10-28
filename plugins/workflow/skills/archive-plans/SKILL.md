---
name: archive-plans
description: Use immediately after completing any task that had a Superpowers spec or plan, when finishing a development branch, or when the user says a phase/version/campaign is done. Moves the spec and plan into the brain repo's Archive and writes the human-readable record. Non-negotiable — every completed task, no exceptions.
---

## Archive Completed Plans & Specs

When the current project has a sister "brain" repo (e.g. `myapp` ↔ `myappBrain`), specs and plans live in the brain, not the code repo.

After completing any task that had a Superpowers spec or plan:

### 1. Archive the spec and plan

- Move the spec from `<Brain>/Superpowers/specs/` → `<Brain>/Superpowers/Archive/specs/`
- Move the plan from `<Brain>/Superpowers/plans/` → `<Brain>/Superpowers/Archive/plans/`
- Both files stay in git history. Brain repos have no `.claudeignore` — archived specs
  and plans remain visible to Claude for future lookups.

**No completed spec or plan should ever remain in the active directories.** The active
folders should only contain work that is in-progress or not yet started.

### 2. Write the human-readable record

The archive is dead weight without a readable summary. The shape of that summary
depends on what the brain repo already tracks — read `<Brain>/CLAUDE.md` for its
specific record-keeping conventions (e.g. one brain tracks Versions, Research
INDEX, and Phase status; other brains may track different things).

For research-driven work (bug investigations, algorithm surveys, design explorations):
the spec still gets archived, but the brain's research index is the primary record.
A version doc only gets written if the research produced a shippable unit — otherwise
the research index alone is sufficient.

This is non-negotiable. Every task, no excuse.
