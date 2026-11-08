---
name: recall
description: Use when the user returns after time away and wants a project briefing with optional action dispatch. Triggered by 'catch me up', 'where did we leave off?', 'what happened?', start of a new session after a break. Not for git log spelunking (use git directly) or detailed phase status (read the active phase doc in the brain repo).
---

You are helping the user catch up after being away, then optionally transitioning into supervised work. Two modes: **Briefing** (always) and **Action Dispatch** (user-initiated, with approval gates).

The briefing is produced by dispatching an **Explore** agent that reads the relevant surface area and returns **briefing JSON** — this keeps the main context window clean. The main loop renders that JSON with the fixed template `widget.html` (next to this file). If the Explore agent fails or is blocked, ask the user how to proceed; do NOT silently fall back to doing the same reads in the main context.

## Step 0: Derive the repo set

- `PROJECT_DIR` = toplevel of the current repo (`git rev-parse --show-toplevel`); `PROJECT` = its basename.
- `BRAIN_DIR` = sibling `${PROJECT}Brain` directory, included only if it exists. If there is no brain repo, all brain-sourced sections below fall back to the in-repo `docs/` folder (specs and plans there, if present) or are skipped. `workflow:new-project` can scaffold a notes repo.

Needs Superpowers: `superpowers@claude-plugins-official`, for Stages 3 and 4 only. Without it, the briefing (Stages 0 to 2) works as written. For Stage 3, write the plan yourself, one step at a time, and get the user's approval before any code.

## Stage 0: Dedup Guard

1. Compute today's date as `YYYY-MM-DD` (use the `currentDate` from session context if present; otherwise `date +%F`).
2. Check if `$BRAIN_DIR/Daily Briefings/YYYY-MM-DD.md` exists (skip this stage entirely if no brain repo).
3. **If it exists:** read its fenced `json` block and render it (see **Rendering**) with the line "You already have a plan for today — here's where you left off." Then use `AskUserQuestion`: **Continue with existing plan** (jump to Stage 2), **Run a fresh briefing**, or **Just show me the plan** (stop). No Explore agent on this path.
4. **If it doesn't exist:** proceed to Stage 0.5.

## Stage 0.5: Scope Selection

Use `AskUserQuestion` to ask what to focus on:

- **All** — full briefing (engineering + research + ideas)
- **Engineering** — current branch, recent commits, blockers, what's next to ship across the active phase
- **Research** — active research status: which research docs exist, which are verified, what's blocking synthesis
- **Ideas** — relevant ideas from `$BRAIN_DIR/Ideas/` for the active phase only (skip option if no brain)
- **Custom** — user specifies a topic in free text

The selection becomes a `SCOPE:` line prepended to the Explore agent prompt. Narrower scope means fewer filled fields, not padded ones.

## Stage 1: Briefing

Dispatch a single **Explore** agent (one synthesis voice), pinned to `model: "opus"` (synthesis is reasoning work, so use a strong model; always pin the model, because an unpinned agent silently inherits the session's model). Prepend the `SCOPE:` line. Prompt it to read:

- `$PROJECT_DIR/CLAUDE.md` (project rules)
- `$BRAIN_DIR/README.md` (canonical spec) and `$BRAIN_DIR/Development_Phases.md` (phase status) — or the in-repo equivalents when no brain exists
- The active phase folder(s) per the phase map's in-progress markers
- Recent git activity in both repos: `git -C <path> log --oneline -20` and `git -C <path> status`
- Open items in the specs/plans dirs (`$BRAIN_DIR/Superpowers/{specs,plans}/` or the same folders under the in-repo `docs/`)

Require of the agent:
- Honor the SCOPE. Omit (empty array) any section the scope excludes.
- Plain language: translate stack jargon, lead with what a thing does in this project. Short sentences. No em dashes or arrow glyphs in text fields.
- **No fluent confabulation:** every item carries `src` — the file path, SHA, or command it came from. An item with no real source is dropped, not guessed.
- Priorities tie to the project's north-star metric as written in the brain README / spec; don't invent one.
- Say each thing once. `phase` names only the active phase or sub-phase ("Phase 1.0: Client discovery"), not the ones that haven't started. `sister` holds only git state that needs attention (dirty, ahead, behind, diverged) for either repo, and is `""` when both are clean and in sync. No SHAs in either.
- `approach` (skill or workflow names) shows only on hover, so `what` and `why` must read in plain words without it.
- Return **only** a JSON object in this exact shape (all arrays may be empty):

```json
{
  "project": "myapp", "date": "YYYY-MM-DD", "branch": "main",
  "phase": "Phase 3: playback", "sister": "myappBrain: 2 commits ahead",
  "priorities": [{"what": "", "why": "", "size": "S|M|L", "approach": "skill or workflow", "src": ""}],
  "blockers":   [{"text": "", "state": "blocked|waiting", "src": ""}],
  "recent":     [{"feature": "", "commits": [{"sha": "", "msg": ""}]}],
  "active":     [{"text": "", "state": "done|active|blocked|waiting", "src": ""}],
  "research":   [{"text": "", "state": "done|active|blocked|waiting", "src": ""}],
  "questions":  [{"text": "", "src": ""}],
  "ideas":      [{"text": "", "ice": 7.2, "src": ""}],
  "flags":      [{"text": "proposed phase-status change", "src": ""}]
}
```

Limits: 1–3 priorities, last 5–10 commits grouped by feature, 3–5 ideas ranked by ICE where present. `waiting` means waiting on the user; `blocked` means blocked on something else. `flags` are proposals only — never apply them.

Then:
1. **Render** the JSON (see below).
2. **Save** it, if a brain repo exists: write `$BRAIN_DIR/Daily Briefings/YYYY-MM-DD.md` (create the dir if missing) holding a short markdown version of the briefing plus the raw JSON in a fenced `json` block. This is what Stage 0 reads back. Don't commit it — `/commit` handles that.

## Rendering

**Widget path** (a `show_widget` tool is available, e.g. the desktop Code tab):
1. Read `widget.html` from this skill's base directory.
2. Replace the literal `/*__DATA__*/null` with the JSON object. Change nothing else — the template is the design; don't restyle, re-lay-out, or add prose inside it.
3. Pass the result as `widget_code`. Call the tool's `read_me` first if this session hasn't. Put any commentary outside the widget, in one or two sentences at most.

**Fallback path** (no widget tool, e.g. a plain terminal): render the same JSON as markdown, under 100 lines — header line (project, branch, phase), numbered priorities with why / size / approach, then blockers, recent work, in flight, research, open questions, ideas, flags. Skip empty sections.

The widget's buttons type into chat for the user:
- **Do this ↗** on priority N sends `recall: approve action N (<what>)` — treat it as Gate 1 approval for that action.
- **Talk it through ↗** on an open question sends `recall: talk through open question: <text>` — answer it; it approves nothing.

## Stage 2: Triage & Proposal

The rendered priorities are the proposals (What, Why now, Scope, Approach are already on each row). Don't restate them in prose.

**APPROVAL GATE 1:** `AskUserQuestion` — approve one or more, modify, reject all (briefing stands alone), or add their own. A **Do this ↗** click counts as approving that one action. **If the user doesn't want to proceed with any actions, stop here.**

## Stage 3: Planning (requires Stage 2 approval)

For each approved action needing implementation, invoke `superpowers:writing-plans`. Present plans **one at a time**. For research actions, dispatch the project's research agent directly with a tight prompt instead — research is gathered, not implemented.

**APPROVAL GATE 2:** the user must explicitly approve each plan before code is written. **No code is written, no implementing agents dispatched, no files touched until a plan is approved.**

## Stage 4: Execution (requires Stage 3 approval)

For each approved plan, invoke `superpowers:executing-plans` (its own checkpoints apply). After execution, the user decides whether to commit, modify, or discard. Use `/commit` when ready.

## Gotchas

- The Explore agent reads across both repos so the main context stays clean. Do NOT also read those files yourself — duplicate token spend.
- The template costs ~5.6 KB of output per render because `show_widget` takes inline HTML only. Don't "improve" it per run; edit `widget.html` once instead (honoring the ui-suite:ui-taste brief).
- **Never skip approval gates.** Even if the action seems obvious, always ask.
- **One plan at a time.** The user reviews each before the next.
- **If the user just wants the briefing, stop after Stage 2.**
- **Pushing to main needs per-push permission.** Earlier "go" tokens don't carry forward.
- **Follow-up questions on the briefing:** answer from context; for deep research or architecture questions, dispatch the project's research/architecture-review agents.
