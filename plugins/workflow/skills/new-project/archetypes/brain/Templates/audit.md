---
type: audit
status: draft | in-progress | complete
created: YYYY-MM-DD
tldr: "One sentence: the verdict. Healthy? Broken? What severity?"
phase: "Phase N — what phase was active when this audit ran"
trigger: "What prompted this — pre-phase gate, post-sprint review, bug cluster, refactor prep"
scope: "What was audited (files, systems, features) — and what was explicitly OUT of scope"
tags: []
---

# [Title — "X Audit" or "X Health Check"]

## Trigger & Context

Why this audit exists. Answer ALL of these:

- **What prompted this?** Pre-phase gate check? A cluster of bugs in one area? A refactor that needs confidence the system is sound? Shipping deadline approaching? Link the issue, plan, or conversation.
- **Project state at the time:** What phase were we in? What had just been built or changed? What was about to be built on top of whatever we're auditing?
- **Codebase state:** What's the current architecture of the thing being audited? What recent changes might have introduced issues? Reference specific files, PRs, or commits.
- **The concern:** What specifically worried us enough to audit? "Is the layout pipeline still sound after 4 sprints of changes?" is recoverable. "General health check" is not.
- **Stakes:** What breaks if issues go undetected? What's being built on top of this? Which phase or feature depends on this system being healthy?

## Verdict

**Overall:** [Healthy / Needs Work / Critical Issues]

Summary in 2-3 sentences: the state of the audited system, the most important thing found, and whether it's safe to proceed with whatever depends on this.

- **P0 (blocking):** N issues — must fix before proceeding
- **P1 (should fix):** N issues — creates risk if left
- **P2 (nice to fix):** N issues — quality/polish

## Issues by Priority

### P0 — Blocking

#### [Issue Title]
- **Where:** `file:line` or system area
- **What:** one-line description of the problem
- **Impact:** what breaks, degrades, or becomes risky
- **Why it's P0:** what specifically is blocked by this
- **Fix:** recommended approach (pseudocode or prose, scaled to complexity)

### P1 — Should Fix

#### [Issue Title]
- **Where / What / Impact / Fix** (same structure, omit "Why it's P0")

### P2 — Nice to Fix

#### [Issue Title]
- **Where / What / Impact / Fix** (same structure)

## What's Working Well

Don't skip this section. Future audits need to know what was solid, not just what was broken. This prevents re-auditing healthy systems and protects good architecture from unnecessary refactoring.

- [Thing that's solid] — why it's good and what design decision made it work
- [Another strength] — worth preserving because...

## Methodology

- **What was checked:** files, systems, code paths examined
- **How:** tools/agents used, manual review, automated checks
- **What was out of scope:** explicitly state what was NOT audited and why (time, relevance, separate audit planned)
- **Confidence:** how thorough was this? Quick spot-check, or exhaustive line-by-line?

## What This Unlocked

What decisions or actions followed from this audit? Link to the issues filed, PRs created, or plan adjustments made. Updated after the audit is consumed.
