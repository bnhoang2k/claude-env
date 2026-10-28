---
name: handoff
description: Produce a copy-pasteable continuation prompt that transplants a task into a fresh context with zero re-orientation tax. Use when the user asks for a "handoff" / "continuation prompt" / "hand this off", when context is filling mid-task (compaction looming), or when a large task naturally spans sessions. The output is a prompt the user pastes into a new session — not a summary for the current one.
---

# Writing a Handoff

A handoff transplants a task into a fresh context so the next agent takes the **next
concrete action immediately** — without re-exploring the codebase, re-deriving facts you
already established, or re-litigating decisions already made. Multi-session tasks carry a
measured ~2x re-orientation tax; a good handoff is how you avoid paying it twice.

The deliverable is a **prompt the user pastes into a new session**, fenced so it copies
clean. It is NOT a recap addressed to the current user.

**Deliver it inline in this chat, as a fenced block. Do NOT write it to a file.** Creating
a `.md` for the handoff (a `Handoffs/` doc, a brain-repo artifact, anything on disk)
defeats the purpose — the user copies from chat, and a stray file just adds repo clutter
and a second source of truth that drifts. The archive/document standing rules are about
specs, plans, and research artifacts; a handoff is none of those. Only persist it if the
user **explicitly** asks you to save it.

## When to write one
- The user asks: "handoff", "continuation prompt", "hand this off", "/handoff".
- You're mid-task and context is filling — write it BEFORE compaction garbles state.
- The task is naturally multi-phase (research → implement → verify → deploy) and you're
  ending a phase.

## Step 1 — Gather ground truth (do NOT write from memory)
Working memory drifts; the repo doesn't. Before drafting, collect the actual state. Run
what's relevant — don't guess at any of it:
- `git branch --show-current` · `git status --short` · `git log --oneline -5`
- What's pushed/deployed: relevant remote branches, last deploy/release commit, CI state
- The live task list (if one exists) — done vs in-progress vs pending
- Exact paths of files touched, plus any scratch artifacts written (docs, plans, playbooks)
- **Verification state**: what is *proven* (build/test/screenshot/device evidence) vs what
  is *assumed*. This is the single most-lost fact across a handoff — capture it explicitly.

If a claim can't be confirmed from the repo/tools right now, mark it UNVERIFIED in the
handoff rather than asserting it.

## Step 2 — Write the prompt (scale to task size)

**Small task (≤ ~3 files, one seam):** the 4-line opener is enough —
*item · what "done" looks like · active constraints · locked decisions ("do NOT re-litigate").*

**Large/multi-phase task:** use the full structure below. Put it in one fenced block:

```
CONTINUE: <one-line task identity — what this is>

DONE (verified): <shipped + how it was proven — build/test/device. Cite commits/paths.>
DONE (unverified): <applied but NOT yet confirmed — name the gate that would confirm it>
IN PROGRESS: <the thing half-finished, and exactly where it stopped>
NOT STARTED: <remaining work, in priority order>

NEXT ACTION: <the single first thing to do — concrete enough to start without exploring>

WHERE THINGS LIVE:
- <key source files + the symbol/line that matters>
- <scratch artifacts: plans, research docs, playbooks — with paths>
- <git: current branch, what's pushed where, deploy mechanism if non-obvious>

LOCKED DECISIONS — do NOT re-litigate:
- <settled choices + the one-line reason, so they aren't reopened>

ACTIVE CONSTRAINTS:
- <non-obvious rules: secrets/build steps, "don't push to main", platform limits, etc.>

GOTCHAS:
- <traps the next agent would otherwise fall into — wrong-file edits, flaky steps,
  things that LOOK broken but aren't>
```

Drop any section that's genuinely empty — but never drop LOCKED DECISIONS or NEXT ACTION.

**Note to another agent** ("short handoff", "fold this into another agent's work", or the
reader is a live agent, not a fresh session): skip the template. Write four short parts:
what I did, what I found, the problems I hit, and the files I touched (with commits). No
NEXT ACTION; the receiving agent owns its plan.

**Review in the morning** ("for me to review", "for discussion", "once everything is
finished" before the user steps away): the user reads it first. Open with what they must look at
and decide, one line each, in plain words. Then give the full resume block above for the
agent that continues.

In a forked side session, deliver the handoff for the main session: the user cannot see the
fork's widgets or artifacts there.

## What makes it load-bearing (vs AI slop)
- **Locked decisions with reasons.** A decision listed without its "why" gets reopened the
  moment the new agent disagrees. The reason is what makes it stick.
- **Verified vs assumed, kept separate.** "Fixed" that's only *predicted* must not read as
  *confirmed*. The handoff is where this distinction is usually lost — guard it.
- **A next action concrete enough to execute.** "Continue the refactor" fails. "Edit
  `foo.ts:42`, change X to Y, then run `npm test`" succeeds.
- **Paths, commits, line numbers — not vibes.** The new agent can't see your scrollback.

## Anti-patterns
- Writing the handoff to a file instead of delivering it inline. It's a chat deliverable,
  not a persisted document — don't invent a `Handoffs/` folder for it unless explicitly asked.
- Writing a feel-good summary of accomplishments instead of an actionable resume point.
- "Should be working" / "probably done" — replace with the evidence or mark UNVERIFIED.
- Re-explaining the whole codebase. Point to where things live; don't transcribe them.
- Burying the next action under narrative. It goes near the top.
- Inventing a deploy/build step from memory — confirm the mechanism before encoding it.

## After delivering
Offer the standing-rule reminder: **one task per session** — the user should `/clear` (or
open a fresh session) and paste the handoff, rather than continuing in the saturated one.
