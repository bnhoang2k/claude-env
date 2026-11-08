---
name: writing-project-docs
description: Use before writing or editing ANY project doc — CLAUDE.md, MEMORY.md, INDEX/README, roadmaps, sector and phase-status docs, research docs, audits, validation reports, archived specs/plans, and GitHub issues/issue-comments — including when a subagent is dispatched to write one. Covers the living-state vs ledger classification (edit-in-place and prune, vs append-only), the required templates, frontmatter and YAML quoting, section structure, sourcing rules, the ban on file:line code maps, and Obsidian link format for brain-repo vaults.
---

# Writing and editing project docs

Two rules, in order. **Classify the doc first**, then apply the template if one exists.

---

## 1. Doc hygiene: living-state vs. ledger

Before writing to ANY doc, classify it. The default instinct — append the new
finding to the bottom and move on — is wrong for half of all docs, and it is the
half that gets loaded into context every single session.

### Living-state docs — edit in place, prune on sight

`CLAUDE.md`, sector docs, `MEMORY.md`, phase-status docs, architecture notes,
`README.md`, `INDEX.md` files, roadmaps, active specs/plans.

These make a claim about **how things are right now**. They must read as if
written today by someone who knows the current state and nothing else.

- **Read the doc before adding to it.** Ask: does this new entry supersede
  something already here? If yes, the edit **replaces** the old entry. It does
  not sit next to it.
- **Delete stale entries when you notice them** — even if you're in the file for
  an unrelated reason. Passing a corpse and not burying it is a choice.
- **Banned:** `Update (2026-07-13):` / `EDIT:` / `Note: this section is now
  outdated, see below` stanzas stapled to the bottom. If a section is outdated,
  fix the section.
- **Git history is the trail.** A prose changelog inside a living-state doc is a
  worse version of `git log` that drifts, contradicts itself, and costs tokens
  on every load. Don't duplicate git's job.
- **Contradiction is the real cost.** Two entries that disagree don't just waste
  tokens — they make the doc *unreliable*, and an unreliable doc gets ignored,
  which means the whole thing was wasted effort.

### Ledger docs — append-only, never rewrite

Archived specs/plans (`Archive/`), research corpus, version docs, session
records, audit/validation reports, `Ideas/` captures.

These record **what was true at a point in time**. Rewriting them destroys the
thing they exist for.

- Append. Never edit a past entry's substance.
- When a finding is overtaken, add the new entry and mark the old one:
  `> Superseded by [[2026-07-13-new-finding]]` — a pointer, not a deletion.
- A research index gets a new row; it does not get its old rows rewritten.

### The tiebreaker

Ask: *"If a new person read only this doc, would they be misled?"* If yes, it's
living-state and needs the edit. If the doc is explicitly dated/scoped to a past
moment ("what we found in July"), it's a ledger and stays.

### Doc GC

When a doc has visibly accumulated (a status file with three "current" phases, an
index whose entries supersede each other), say so and offer a GC pass: walk it,
delete what's no longer true, collapse superseded entries into their successors.
Don't do it silently mid-task — surface it, then do it.

### Applies to subagents

Subagents are the worst offenders: an agent told to "update the status doc" has no
idea what's already in the file and will append by reflex. Per
the usual practice of briefing a subagent with the rules that bite for its task, inject the living-state/ledger rule
into the prompt of any agent that will write or update a doc.

**Why:** the append trail is nice for archaeology, but stale entries confuse future
agents and eat tokens on every load. A memory index that holds both an old entry and a
newer entry that *supersedes* it loads both, every session.

---

## 2. Document templates

When writing a **research**, **audit**, or **validation report** document, read the
matching template in the current project's brain repo (e.g. `<Brain>/Templates/`)
first and follow its structure. With no brain repo, keep these docs in the project's
`docs/` folder; `workflow:new-project` scaffolds a notes repo with the templates.
Specs and plans are handled by Superpowers skills — don't use templates for those.
Needs Superpowers: `superpowers@claude-plugins-official`, for those skills only;
without it, write a spec or plan by hand and still classify it with section 1.
External inspiration/ideas go in the brain repo's ideas folder (`<Brain>/Ideas/`).

Specialized document types (e.g. a brain's Validation Reports) have their own
CLAUDE.md inside the relevant directory — read it before drafting.

Every templated document must have:
1. YAML frontmatter with `type`, `status`, `created`, `tldr` (the conclusion, not
   the topic), `phase`, and `trigger`
2. **Trigger & Context section** — what prompted this, project/codebase state, the
   gap, and the stakes. Without this, findings are orphaned facts that can't be
   judged for relevance later.
3. Inverted pyramid: conclusion/verdict first, evidence second, details last
4. **Linked sources** — every factual claim needs a clickable URL. No "Apple says..."
   without the link. Unverifiable claims must be flagged as such.
5. **What This Unlocked** — updated after the doc is consumed, closing the loop to
   decisions/PRs/specs.

When creating or commenting on **GitHub issues**, follow the templates in
`<Brain>/Templates/`:
- **`github-issue.md`** — for issue bodies (`gh issue create`). All sections present;
  omit Out of Scope only if nothing to exclude.
- **`github-issue-comment.md`** — for closing comments and investigation updates
  (`gh issue comment`). Captures the journey: Root Cause, Struggles (what didn't
  work), Ahas (surprises), Solution (what did). Scale to complexity: a trivial
  one-liner fix can skip Struggles/Ahas, but any non-obvious fix gets the full
  structure.

This applies to agents too — subagents writing docs or issues must follow templates.

**Obsidian link format** (inside any Obsidian notes vault):
Wiki-links (`[[filename|display text]]`) for intra-brain cross-references and
`![[image.png]]` for image embeds. Standard markdown links (`[text](path.md)`) are
only for external URLs. This applies to all templates, skills, and agents that
create or edit files in a brain vault. **Exception: any `Explainers/` folder** —
use relative markdown links (`[display text](../relative/path.md)`) so links work
on GitHub and in VS Code, not just Obsidian.

---

## 3. Two rules that bite on every doc

### No code maps in CLAUDE.md / sector docs

Don't create or maintain "Where to Look" tables (file:line references) in CLAUDE.md or
sector-level docs. Line numbers drift after every refactor, creating maintenance
debt and actively misleading future agents (a wrong line sends an agent to the wrong code, and
the resulting "fix" can preserve the wrong reference). Describe *what* exists and *how it
works*, not *where* it lives by line number; name a specific function or method if it matters
(e.g. "the `merge_similar` function in `core/grouping.py`") without pinning a line. Use grep/LSP for
symbol lookup instead.

File *inventories* are a different thing and are fine — the sector-doc convention deliberately
owns directory layout and file→type tables. It is line numbers that rot, not filenames.

### YAML frontmatter quoting

Always quote YAML frontmatter values containing colons (e.g. `tldr: "Done: synthesis passes
STRICT pass."`). Unquoted colons break GitHub's YAML parser ("mapping values are not allowed in
this context") and render a red error banner instead of the document. Applies to any markdown
file with frontmatter — research docs, audits, validation reports, GitHub issues, memory files.
`tldr`, `description`, and URL fields are especially prone. Templates already quote by default;
enforce it in `/capture` and manual edits too.
