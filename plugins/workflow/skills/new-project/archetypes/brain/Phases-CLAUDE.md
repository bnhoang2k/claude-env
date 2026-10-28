# Phases — Sector Context

## Overview

Each phase folder follows a standard six-zone structure. Every file in a phase folder must belong to exactly one zone. No ad-hoc subdirectories.

## Structure

```
Phase X/
├── Phase X.md                 ← Vision + sub-phase status table + links to version docs
├── Versions/
│   └── x.y - Feature Name.md
├── Research/
│   └── x.y - Problem Name/
│       ├── INDEX.md
│       ├── synthesis.md          ← c-suite-facing decision doc (see Synthesis Docs)
│       └── agent-reports, retros, etc.
├── Reference/
│   ├── INDEX.md
│   └── resource-catalog.md
├── Explainers/
│   └── topic-explainer.md
└── Design/
    └── topic-mockups.html
```

## Zone Definitions

| Zone | Purpose | Identity test |
|------|---------|--------------|
| **Phase X.md** | Vision document. Overall phase goals, sub-phase status table, links to version docs. If the phase involves a pipeline or data flow, include a top-level ASCII diagram showing how the major components connect. The 5-minute read for "what is this phase?" | "What is Phase X trying to accomplish?" |
| **Versions/** | One doc per sub-phase. Comprehensive reference for the feature — what was built, why, key decisions, architecture, constraints. Detailed enough to understand without reading the archived spec. | "What are we building in x.y?" |
| **Research/** | Problem-oriented investigation clusters. Each subfolder answers one question. Contains agent reports, retros, AHA moments, and a c-suite-facing `synthesis.md` once enough sub-reports exist to draw conclusions. | "What did we learn about X, and what should we do about it?" |
| **Reference/** | Cross-cutting resource catalogs that serve multiple sub-phases. Site format lists, source rosters, template variants (`config/templates/*`), prompt-version archives. Not tied to a single problem. | "Where do we find X?" |
| **Explainers/** | Plain-language walkthroughs of how something works. Educational, not prescriptive. For onboarding or debugging. | "How does X work?" |
| **Design/** | Visual brainstorming artifacts: HTML mockups, wireframes, dashboard layout comparisons, side-by-side variant explorations. Forward-looking — captures what something *should* look like before it's built. Once a design is chosen and shipped, the durable record moves to a Versions doc or Explainer; Design files become history of the exploration. | "What should X look like?" |

## Phase Vision Docs (`Phase X.md`)

**Location:** `Phases/Phase X/Phase X.md`

The phase vision doc is the **founder-facing entry point** for everything happening in a phase — same audience as every Version doc underneath it:

> **`Phase X.md` and every `Versions/x.y` doc are user-facing — c-suite level, plain English, layman's terms.** Technical detail lives in the active spec (`Superpowers/specs/`) or the archived spec + plan (`Superpowers/Archive/specs/`, `Superpowers/Archive/plans/`). Vision and version docs *link* to those — they never restate them.

The founder on a Tuesday morning, a future Claude session, or an outside collaborator should be able to skim `Phase X.md` in under 5 minutes and walk away with: what this phase is trying to do, where the work stands, what shipped most recently, what's blocked. If they want the technical depth, they click through.

### Writing rules

- **Plain English.** No code, no spec jargon, no internal acronyms without expansion. Translate "hexagonal architecture" to "core logic separated from I/O so adapters swap freely." Translate "tz-aware datetime" to "timestamps that always carry their timezone." If the phrase isn't in a non-developer's vocabulary, expand it inline.
- **Lead with the goal in 2-3 sentences.** What this phase is, why it exists, what it produces. Don't open with scope, methodology, or invariants.
- **One ASCII diagram for pipelines / data flows.** No more. The diagram answers "how do the pieces connect?"; the prose answers "why?"
- **Sub-phase table is the operational truth.** One row per shipped or planned version. Status markers (✅ / 🚧 / 🔲) visible at a glance.
- **Link out, don't restate.** Wiki-link to `Versions/x.y` for "what shipped." Wiki-link to the active or archived spec / plan for "how it was specified or built." If the wiki-link target doesn't exist yet, write the link anyway — Obsidian flags missing notes and the link survives the file being created later.
- **What we're NOT changing.** Short list of architectural invariants the phase commits to preserving. Future phases reread this before considering a deviation.
- **No walls of prose.** Paragraphs 2-4 sentences max. Bullets and tables for everything enumerable.

### Content template

(Match an earlier phase note, such as `[[Phases/Phase 1/Phase 1|Phase 1]]`, for shape.)

```markdown
---
type: phase-vision
status: in-progress | shipped | superseded
created: YYYY-MM-DD
phase: N
tldr: One-sentence c-suite summary — what this phase produces.
---

# Phase N — Title

## What this is
2-3 short paragraphs in plain English.

## The eagle view
ASCII diagram + one short paragraph per component.

## Sub-phase status
Table: Version | Track | State | Headline. Wiki-link the version cell.

## What we're NOT changing
Bulleted invariants.

## How we validate
1-2 sentences.

## Research
Links to Research/x.y subfolders, one line each. "None" if implementation-only.
```

## Version Docs

**Location:** `Versions/x.y - Feature Name.md`

Version docs are the **readable reference** for each sub-phase. Same audience as `Phase X.md` (above) — user-facing, c-suite level, plain English. A reader skims a version doc to know what shipped, then clicks through to the archived spec or implementation plan for technical depth. Think "patch notes with architecture context."

The spec and plan live in `Superpowers/specs/` and `Superpowers/plans/` during active work, and `Superpowers/Archive/specs/` and `Superpowers/Archive/plans/` once complete. **Every version doc must link to its spec and plan** — that's the bridge from the readable record to the technical artifact. The version doc is the living record that stays readable; the archived spec and plan are the technical record that stays accurate.

### Writing rules

- **Scannable first, deep on demand.** Status table + short summaries + bullets first; links out for anyone going deeper.
- **Plain English.** No spec-author jargon. A reader without recent project context should understand what shipped.
- **Patch-notes format for shipped work.** Short summary (2–4 sentences) → bullets for enumerable content → empirical outcome inline when applicable → Links block at the bottom.
- **Preserve empirical outcomes inline.** Numbers (LLM cost per recipe, parse success rate, weekly import count, week-two retention) only live in the version doc — archived specs describe the plan, not the result.
- **Drop what git and the archive have.** No commit SHAs, no files-touched lists, no full test enumerations.
- **No walls of prose.** Paragraphs are 2–4 sentences. Anything longer goes to bullets.
- **Date-stamp everything.** Every release-notes heading gets a parenthetical date; every Status row gets a state marker.
- **Link out to denser prose.** Architecture subsystems that deserve deep explanation go in `Explainers/`, not inline in the version doc.

### Content template

Not every sub-phase needs every section. Use the ones that apply. Order matters: context first, status second, detail last.

```markdown
# x.y - Feature Name

## What this is
2-3 paragraphs. What the sub-phase is, why it exists, what problem it solves.

## Scope (optional)
Terse counts — P0/P1/P2 issue counts, LOC estimate, duration.

## The eagle view
One top-level ASCII diagram + one short paragraph per component.
Must fit on one screen. Pipeline/data-flow sub-phases require this.

## Section 1..N — Subsystem breakdown (for multi-subsystem sub-phases)
Per-subsystem: What it is today / What's broken / What the fix is / Dependencies.
Link to Explainers/ for deep dives.

## Build sequence (for multi-spec sub-phases)
Week-by-week plan. Date-stamp shipped items inline.

## What we're NOT changing (optional)
Architectural decisions preserved through any rewrite.

## How we validate (optional)
One paragraph. What the harness does, what checkpoints matter.

## Status
Scannable table: Track | State | Headline.
One row per spec/sprint/milestone.

## Release notes
One ### block per shipped unit. For each:
  - Short summary (2-4 sentences)
  - Bullets for enumerable content (deleted components, plans, follow-ups)
  - Empirical outcome block when applicable (metrics, accuracy, deltas)
  - Links block at the bottom (Spec, Plan, Follow-ups)

## Research
Links to Research/ subfolders. One line each.
```

### Simple sub-phases

If a sub-phase shipped cleanly as one unit, skip the Build sequence / Status table / Release notes machinery. "What this is" + "Key decisions" + `Status: SHIPPED` + "Specs" is enough. Release notes structure is for sub-phases that ship incrementally across multiple specs.

### ASCII diagrams

Pipelines, data flow, routing logic, or multi-component architectures **must include ASCII diagrams**. Box-and-arrow style (`┌─┐`, `│`, `└─┘`, `─▶`). Place in "The eagle view" or at the top of a subsystem section.

## Synthesis Docs

> **OPTIONAL — requires a research-verifier agent in the code repo (the protocol itself is `Templates/research-integrity.md`); skip if absent.**

**Location:** `Research/x.y - Problem Name/synthesis.md`

A synthesis is the **decision-maker's view** of a research cluster. It tells the reader what to *do* differently, not what was investigated. The user-facing rule is plain:

> **Every synthesis doc must be c-suite facing and easy to read.**

That means: the user, a busy non-academic who hasn't been deep in the research, should be able to skim the synthesis on a Tuesday morning, decide what to change in the system, and close the doc — all in under 5 minutes. Sub-reports do the heavy lifting; the synthesis distills.

This is distinct from the sub-reports under it. Sub-reports are evidence corpora — verbose, cited, sometimes long. The synthesis is the deliverable a stakeholder reads.

### Writing rules

- **Lead with the decision, not the evidence.** First section after the header is "What changes because of this" — one or two sentences naming what the system or user behavior should do differently.
- **Top of doc = ranked action items.** Numbered list, each with `[ACTION]` + `Why:` + `Confidence:` (HIGH / MEDIUM / LOW). Each item fits in 3–5 lines. If you can't compress an action to that, it's two actions.
- **Evidence in tables, not paragraphs.** "Verified" vs "Unverified / inferred" goes side-by-side in a table near the bottom. Confidence labels visible at glance.
- **Sub-reports stay supporting.** The synthesis doesn't quote sub-reports inline. It links to them with one-line headlines: `[01-page-formats-2026.md] — JSON-LD pages parse cleanly; microdata pages drop quantities`. Click for depth.
- **Two-page rule.** Print or scroll-test the synthesis. If page 2+ contains new claims (not just supporting evidence), it's too long — split into a sub-report.
- **No academic prose.** Ban "this paper finds...", "the literature suggests...", "research indicates...". Replace with: "Microdata pages drop ingredient quantities" + citation. Direct sentences, named subjects.
- **Plain numbers and named names.** "$0.50/month at current volume" not "trivial cost." "Five named beta cooks, interviewed one by one..." not "multiple sources."
- **Open questions at the bottom, not the top.** If unresolved questions exist, list them, but the doc opens with what you DO know, not what you don't.
- **Verification status visible without reading.** A frontmatter `status:` of `draft` / `verified` / `superseded` plus a top-of-doc disclaimer when `draft` ("This synthesis has not been verified — do not bake into prompts yet").

### Frontmatter template

```yaml
---
type: synthesis
status: draft | verified | superseded
created: YYYY-MM-DD
phase: N
inputs: [list of supporting sub-reports]
tldr: One sentence — what changes in the system because of this doc.
verification: <path to verifier log, or "not yet">
---
```

### Body template

```markdown
# Phase N.V — [Topic] — Synthesis

> **What changes because of this:** 1–2 sentences. The "if you read nothing else" version.

## Top recommendations

1. **[ACTION verb phrase]** — what to do specifically. **Why:** one line. **Confidence:** HIGH/MED/LOW. [one-line citation if needed]
2. ...
3. ...
(3–7 items typical. More than 7 means you're under-distilling.)

## What's verified vs. what's not

| Verified | Inferred / unverified |
|----------|------------------------|
| [claim — primary source] | [claim — caveat why] |
| ... | ... |

## Decision matrix (when applicable)

When the synthesis is choosing between options, show them side-by-side.

| Option | Score | Trade-offs | Recommendation |
|--------|-------|------------|---------------|

## Evidence summary

One line per sub-report. No inline quotation; click through for depth.
- [01-...md] — finding in 6–12 words
- [02-...md] — ...

## Open questions

- ...

## Coverage Status

(per `Templates/research-integrity.md`)

## Provenance

(per research-integrity.md)
```

### Anti-patterns to avoid

- **Re-stating the sub-reports.** The synthesis is not a summary index of the evidence; it's the action plan that flows from it. If your synthesis reads like a literature review, rewrite.
- **Burying the action items.** Don't open with methodology, scope, or definitions. Open with what the user does next.
- **Confidence ambiguity.** Every actionable claim has a label. "It seems likely that…" is banned. Either HIGH/MED/LOW or it doesn't go in the synthesis.
- **Padding for completeness.** Three confident actions beat seven hedged ones. Cut the hedged ones to "open questions" or kill them entirely.

## Research Folders

**Location:** `Research/x.y - Problem Name/`

### Numbering rule (the `x.y` prefix)

- **`x` is the phase number** (e.g., `4` for Phase 4 Import Reliability).
- **`y` is the VERSION number within that phase** that the research is tied to — matching `Versions/x.y - Feature Name.md`. This makes the relationship between Versions and Research traceable by name alone.
- **`y = 0` is the default for any research that does not bind to a specific committed version.** This includes (a) foundational/pre-version research done before any `Versions/x.y - ...md` doc exists for the phase, (b) cross-cutting research that affects every version of the phase equally, and (c) phase-wide tooling or architecture decisions. **Milestones described in `Phase X.md` are NOT versions** — until a `Versions/x.y - ...md` doc is committed, the version doesn't exist for naming purposes.
- **Once versions exist, version-tied research uses the matching `y`.** If a `Versions/5.2 - Parser With Unit Checks.md` doc has been written, then research specifically for that version uses `5.2 - Problem Name/`.
- **Multiple research clusters can share a `y`.** If three independent investigations all serve Version 5.2 (or are all pre-version), the folders are `5.2 - Problem A/`, `5.2 - Problem B/`, `5.2 - Problem C/`. Distinguished by the Problem Name, not a sub-counter.

Examples:
- `4.0 - Format Survey/` — pre-version foundational research (Phase 4's Versions are not yet defined).
- `4.0 - Cook Interviews/` — could be a sibling pre-version cluster if user-side research grew enough to merit its own folder.
- `5.1 - Ingredient Parser v1/` — once Version 5.1 is committed, research specifically for it uses `5.1`.

Every multi-file research cluster has an INDEX.md.

### INDEX.md is a living dossier, not a retrospective

INDEX.md is **maintained continuously** across sessions and commits — not written once at archive time. It has two lifecycle stages:

| Stage | Sections actively maintained | Sections empty/draft |
|-------|------------------------------|----------------------|
| **IN PROGRESS** | Status, Problem, Current hypothesis, Session log, Files in this folder | What we tried that didn't work, How we solved it, Specs |
| **RESOLVED** | All sections; Session log distilled into "What we tried that didn't work" and "How we solved it" | — |

Triggers for when to update the INDEX are mechanical — agent report landed, hypothesis changed, commit pending — not judgment calls.

### INDEX.md template

```markdown
# x.y - Problem Name

## Status

IN PROGRESS | BLOCKED | RESOLVED

One line on why — e.g., "BLOCKED on microdata primary source" or "RESOLVED — synthesis verified, baked into config/prompts/parse_recipe.md v1, 2026-01-15".

## Problem

What question we were trying to answer. Context, and surrounding circumstances that caused this problem to surface. 3-5 paragraphs. This does NOT change across sessions — it's the founding charter.

## Current hypothesis

What we currently think is happening and why. This CHANGES as sessions accumulate. When it changes, update it in place and record the pivot in the Session log.

## Session log

Append-only, dated entries. One per session or per research round (dispatch → reports land → synthesize). Each entry states: what we did, what we learned, what the new hypothesis or next step is.

- **2026-01-12** — Example entry: dispatched market-researcher on six import-reliability questions. Six sub-reports landed (`01-page-formats-2026.md` through `06-cook-interviews.md`). Synthesis drafted (`synthesis.md`). Hypothesis: JSON-LD markup + a unit normalizer + a fallback scraper gate everything else.

## What we tried that didn't work

Finalized at RESOLVED. Bullet points on dead ends distilled from the Session log. Empty or sparse while IN PROGRESS — don't fabricate retro content mid-investigation.

## How we solved it

Finalized at RESOLVED. High-level summary of the winning approach.

## Files in this folder

Keep sorted by date. Date-prefix all agent reports (`YYYY-MM-DD-descriptive-kebab.md`).

| File | What it covers |
|------|---------------|
| `01-page-formats-2026.md` | Sub-report: how the top recipe sites mark up ingredients |
| `synthesis.md` | C-suite synthesis — top recommendations for parse_recipe.md |
| `synthesis.verification.md` | research-verifier STRICT pass log |

## Specs

Links to archived specs that solved this problem. Filled in at RESOLVED.
- [[archived-spec-name]] — one-line description
```

### Multi-agent dispatches share one folder

When an investigation is parallelized across N agents (e.g., dispatch 5 agents to scan different angles of the same question), **all N reports land in the same Research folder**. They do NOT each get their own subfolder, and the dispatch does NOT spawn N sibling folders at the phase root.

**The test:** if the reports would inform each other when read together — if a synthesis doc would weave them — they're the same problem investigated from different angles. Same folder.

**Mechanics:**
- One folder, named after the unifying problem (`x.y - Problem Name/`).
- One INDEX.md as the living dossier.
- Per-agent reports are date-prefixed sibling files inside that folder: `2026-01-12-page-formats-2026.md`, `2026-01-12-cook-interviews.md`, etc. The descriptive suffix names the angle, not the agent.
- The synthesis doc is `synthesis.md` — single canonical name, no date prefix (it gets revised in place; commits are the history).
- The Session log captures the dispatch as a single entry listing all reports produced in that round.

**Why:** Flat folders are scannable; nested per-angle subfolders are noise. Future-you wants to open one folder and see the whole investigation at a glance, not navigate a tree to reconstruct it. Anti-bloat is more important than anti-collision — date prefixes prevent collision without subfolders.

**When to split:** If a sub-thread of the investigation grows large enough to merit its own founding charter (its own Problem statement, its own hypothesis) and produces specs of its own, promote it to a sibling `x.y - Sub-Problem Name/` folder at that point. Splitting is a deliberate event, not a default.

## Reference Folder

**Location:** `Reference/`

Has its own INDEX.md listing all reference docs with one-line descriptions. New reference material goes here when it serves multiple sub-phases and doesn't answer a single research question.

Examples for a typical project:
- Vendor catalog (which vendors at what URLs, last verified dates)
- Source roster (named experts whose answers are high-tier)
- Template variants (`config/templates/*`, documented for cross-phase reuse)
- Prompt version archive (every shipped version of `summarize_report.md` with its synthesis pointer)

## Archive-to-Summary Process

When a Superpowers spec is archived (per the `workflow:archive-plans` skill), the corresponding Version doc and Research INDEX must be written or finalized:

1. **Version doc** — Create or update `Versions/x.y - Feature Name.md`. If the sub-phase already has a version doc, append a release-notes entry under `## Release notes` for the shipped spec. Follow the rules and template in the "Version Docs" section above.
2. **Research INDEX** — **Finalize**, don't first-write. Flip Status to RESOLVED, distill the Session log into "What we tried that didn't work", fill in "How we solved it", add spec link. The INDEX should already be maintained live — archive is the finalization pass, not the first pass.
3. **Synthesis doc** — If the research drove the spec, the synthesis must have a `status: verified` (research-verifier passed) before the spec ships. If it was `status: draft`, update or note why ship-without-verification was acceptable.
4. **Phase X.md** — Update the sub-phase status table.

This is the write-up step. Without it, the spec gets buried in Archive with no human-readable record.

## Naming Conventions

- **Version docs:** `x.y - Feature Name.md` (e.g., `5.1 - Ingredient Parser v1.md`)
- **Research folders:** `x.y - Problem Name/` (e.g., `4.0 - Format Survey/`)
- **Synthesis:** `synthesis.md` (single canonical name inside each Research folder; no date prefix — git history is the version log)
- **Verifier log:** sibling to artifact, `<artifact>.verification.md`
- **Reference docs:** descriptive kebab-case (e.g., `site-format-catalog.md`)
- **Explainer docs:** descriptive kebab-case (e.g., `mcp-server-explainer.md`)
- **Design files:** descriptive kebab-case `.html` (e.g., `import-page-mockups.html`); date-prefix when the same topic gets a follow-up exploration (`2026-01-15-import-revisit.html`)
- **Agent reports inside Research:** date-prefixed, required (e.g., `2026-01-12-page-formats-2026.md`) — temporal order must be scannable without metadata. Numbered prefixes (`01-`, `02-`) acceptable when reports are explicitly part of an ordered series within one dispatch round; pick one convention per folder and stay consistent.

## Subagent Dispatching

Any agent spawned to write files under `Phases/` must be briefed on this document's conventions before writing. The dispatch prompt must either include the relevant conventions inline (research folder naming, INDEX.md template, synthesis writing rules, version doc format) or explicitly instruct the agent to read `Phases/CLAUDE.md` first. Research-only agents that report findings back without writing files are exempt — the orchestrator applies conventions when persisting results.

## Lessons

- `Phase X.md` and `Versions/x.y` docs are user-facing — plain English, c-suite skim, no jargon. Technical content lives in `Superpowers/specs/` (and `Archive/specs/`, `Archive/plans/`); vision and version docs link to those, never restate them
- Synthesis docs are c-suite facing, sub-reports are not — never confuse the two
- Retrospectives are not a separate zone — they live inside the Research folder for the problem they diagnosed
- Specs belong in Superpowers/Archive lifecycle, not in phase folders — version docs link to them
- Cross-cutting research (site format lists, source rosters, prompt-version archives) goes in Reference, not Research
- Every Research subfolder must have an INDEX.md — orphaned agent reports are unnavigable
- INDEX.md is a living dossier maintained across sessions, not a retrospective written once at archive
- Phase X.md is the vision doc, not a dumping ground — keep it focused on "what" and "why", link out for "how"
- One folder per problem, not per sub-phase — multiple research problems can share the same `x.y` prefix
- Multi-agent dispatches on the same question share one folder — N reports become N date-prefixed (or numbered-prefix) siblings, never N subfolders or N flat sibling folders. Splitting a folder is a deliberate event, not a default
- A draft synthesis is not a shippable input — wait for the research-verifier STRICT pass before baking findings into prompts or system behavior
