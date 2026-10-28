---
name: workflow-fanout-budget
description: Use before authoring or launching any multi-agent fan-out — a Workflow script, a parallel()/pipeline() stage, a batch of subagent spawns, or an SDD implementer wave. Holds the launch checklist (worst-case statement, slice caps, the TIERS block, wave planning, the Condense stage, watching children), how nested fan-outs multiply invisibly, when a barrier beats a pipeline, and the incidents behind the caps. The caps are stated in the skill itself.
---

# Counting a fan-out before you launch it

The caps: at most 10 units AND at most 30 agents per stage, and about 15 units for an ordinary
workflow (25–30 for a deliberately thorough audit). A unit is an agent weighted by model:
fable 2.5, opus 1, sonnet 0.5, haiku 0.1. If the user keeps a rules file with different caps,
follow it. This skill holds the launch checklist, the *why*, and the tradeoffs.

The **tiering tell** used below: a stage is *reasoning* work (judging, synthesis, deciding,
debugging) and gets a strong model, or it is *mechanical* work (file moves, grep checks,
formatting, pings) and gets a cheap one. Pick the tier by the stage's shape, not by its cost.

## Launch checklist

1. **Pick the shape.** Workflow for many similar items with a shape known up front (review N
   files, migrate N call sites): visible progress tree, deterministic caps, resumable. One-off
   agents when step 2 depends on step 1's result, or for a single bounded investigation.
2. **Count the worst case** (arithmetic below) and **state it in the launch message** as units
   with headcount per model: `4 opus + 20 haiku = 6 units, 24 agents`. The worst case, not the
   typical one. If you cannot state the number, the script is not ready.
3. **Cap every fan-out stage** with an explicit `.slice(0, N)` and a `log()` naming what was
   dropped. An uncapped `.map()` over a model-generated array lets the model pick your agent
   count. Cap globally at a barrier, not per branch.
4. **Write the `// TIERS:` block.** Every inline Workflow script carries one line per stage:
   `<stage> -> <model> (reasoning|mechanical: <one-clause why>)`. The launch message restates it
   with the worst-case units and headcount. A script with a missing block, a missing model
   pin, or a Fable pin is not ready to launch (a user may run a hook that denies these; do
   not rely on one). "Mechanical" next to an opus pin, or
   "reasoning" next to a sonnet pin, is a contradiction.
5. **Pin `model` on every `agent()` call.** The orchestrator may run on Opus as often as Fable, so
   inheriting silently means "Opus everywhere" — the absence of a decision, not one. Pinning
   everywhere also makes a silent Fable fleet structurally impossible. Do not revert to the
   `Workflow` tool's "default to omitting it" on reading its description mid-task.
   The same holds for one-off Agent/Task dispatches: pin a model on each (except `fork`),
   and use `fable` only after the user approves it in that session. Write the approval into
   the prompt as `FABLE-APPROVED: <the user's words>` so it is on record.
6. **Prose-writing workflows end with a Condense stage** — one agent per file, after Verify,
   on the strongest tier: Fable, asked for at launch (it needs the user's approval), else opus. It is the
   last stage and holds everything the run found, and a dropped fact is invisible from its
   output, so it fails the tiering tell. Brief: *cut words, never facts.*
   It may delete restated reasoning, hedges, narration and dated storytelling; it may not
   delete a fact, path, number, link or caveat. Returns before/after line counts. Verify checks
   truth, not length — Opus runs long by default and will not cut its own prose, so this needs
   a fresh agent with nothing invested.

## Weights and prices

| Model | Weight | Why |
|---|---|---|
| fable | 2.5 | 2.5× Opus per token. Needs the user's approval anyway. |
| opus | 1 | The baseline. Slowest and most tokens per task. |
| sonnet | 0.5 | Half Opus per token. |
| haiku | 0.1 | 1/40 of Opus per token, weighted at 1/10 (see the per-stage cap below). |

Prices: Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0.10/$0.50, Fable 5.1 $10/$50 per MTok
in/out (from the claude-api skill). Re-derive the weights when the prices move.

Strongest tier for brainstorming, AR, adversarial review, plan-writing and Condense: review
strength catches shipped bugs; implementer strength doesn't. Haiku is for mechanical work —
file moves, formatting, lint fixes, doc shuffles.

## Dispatch waves: parallel by default

Derive the wave plan from the plan's per-task `**Files:**` blocks — `writing-plans` already
requires Create/Modify paths per task, so the dependency graph exists before execution
starts. Tasks with **disjoint** file sets go out in ONE message and run concurrently. Tasks
sharing a file serialize. State the waves in the launch message
(`wave 1: tasks 1, 8 · then 3 → 4 → 6 → 7, all on server.js`) so a plan that is
really one shared file is visible as such instead of trickling out one task at a time.

This **overrides** `superpowers:subagent-driven-development`'s blanket *"Never dispatch multiple
implementation subagents in parallel (conflicts)."* That ban names the right hazard and the
wrong scope: the conflict is a shared working tree, not parallelism. Overlapping file sets get
a worktree each (`superpowers:using-git-worktrees`) or a serial wave. Task reviewers are always
parallel with each other; they only read.

## Watching children

While children are live: do local work if there is any, otherwise wait in bounded 5–10 minute
stretches. Between stretches run `ListAgents` and chase anything silent past its estimate. An
agent quiet ~15 minutes gets a `SendMessage` probe; no reply means it is dead — re-dispatch a
fresh one pointed at the existing report file and the work already on disk. Do not keep
waiting. Git state and `ps` show what an agent *wrote*, not whether it is *alive*.

## The arithmetic that gets skipped

A `parallel()` nested inside a `pipeline()` stage **multiplies**:

```
10 reviewers × 4 findings each × 2 refuters = 80 agents
```

Not `10 + 4 + 2 = 16`. Every nested fan-out is a product, and the product is invisible in the
script's shape — it reads as three short lines of JavaScript. This is the single most common
way an intended 15-agent run becomes a 90-agent run.

Count it explicitly, on paper, before the script runs. If you can't state the worst-case
number, the script isn't ready.

## Why capping per-branch isn't capping

"Only 4 findings per reviewer" across 10 reviewers is a 40-agent cap, not a 4-agent cap. To
actually bound a run, rank across **all** branches at a barrier and take the global top N.
Cross-branch ranking is one of the few places a barrier genuinely beats a pipeline — most of
the time `pipeline()` wins because it has no barrier latency, but you cannot globally rank
what hasn't finished.

## Verification depth vs. finder width

One verifier per claim is the default. Escalate to a 2–3 refuter panel only for findings that
would block a merge. A three-judge panel on every candidate is how a review becomes a fleet —
and coverage, not verification depth, is what catches shipped bugs. Ten strong finders with one
checker each beats four finders with a three-judge panel.

## No silent caps

If a workflow bounds coverage — top-N, no-retry, sampling — `log()` what got dropped. Silent
truncation reads downstream as "we covered everything" when it didn't.

## Model tiering waste scales with the fleet

Correctable Opus-on-mechanical-work waste is a tiny share of tokens in single-agent
work — which is why tiering is a **quality** rule, not a cost rule, there. **That does NOT
hold inside a fan-out.** A workflow multiplies the tier by the agent count, so the waste scales with the
fleet. Tier by stage shape (the tiering tell above) before spawning, not after.

## Why the caps exist

An adversarial review of a small branch can launch at a worst case of **about 90 Opus
agents at high effort**: 10 reviewers, each fanning out to 4 findings × 2 refuters, with no
global cap and no tiering — because "adversarial review → strongest model" gets read as
applying to the whole fleet rather than per stage. The user has to stop it mid-run.

A running workflow **may not be killable with `TaskStop`** — neither the returned task ID nor the run
ID is guaranteed to resolve. The only lever was `/workflows` → stop, which is the user's keyboard, not the model's.

**An uncapped fan-out is effectively unrecallable once launched.** That is the real reason the
count gets computed before launch and not after: there is no undo.

## Recon is a judgment call; the per-stage cap is not

How wide a recon pass should be is yours to judge — a directed lookup is one agent, a sweep
across genuinely unrelated areas earns more. There is no number to hit there.

The **per-stage cap** is different: it is hard, and it is not really a preference. It has two
parts, and each one guards a different cost.

- **≤10 units** guards spend. Agents are weighted by model (opus 1, sonnet 0.5, haiku 0.1,
  fable 2.5), because a Haiku agent costs about 1/40 of an Opus agent per token. Ten Opus
  agents and thirty Haiku agents are not the same bill.
- **≤30 agents** guards everything the weight does not see. The `Workflow` runtime caps
  concurrency at `min(16, cores−2)` (6 on an 8-core machine), so a big stage queues instead
  of running wider. And every agent's result comes back to the orchestrator — usually Opus —
  to read. Haiku is weighted at 0.1, not the 0.025 its price implies, for that reason.

The weight never picks the model. A stage goes to Haiku only when it passes the tiering tell
(it is mechanical work); a cheap weight is not a reason to swarm a reasoning stage.

The instinct to add more agents is worth distrusting either way: current models over-delegate
by default, so treat that pull as a signal to recount, not as evidence the work needs it.

## Incidents behind the rules above

Each rule is kept short; the evidence lives here.

- **Parallel by default.** A long run of many agents can end up at an average parallelism
  barely above 1 and spend hours idle.
- **`**Files:**` blocks anchor on symbols.** Several tasks may edit the same large file while
  they run, so it grows by hundreds of lines. Every line number quoted for a later task is
  then wrong when that task starts.
- **Subagents skip the full gates.** Many subagents each running the full suite for several
  minutes is nearly all redundant.
- **Foreground gates in subagents** (a hook can enforce this). An implementer started the
  test suite in the background and waited hours for a notice that never came. SDD runs one
  task at a time, so the orchestrator sat idle too.
- **Probe silent children.** A dead fix-round agent went unnoticed for over an hour. A user
  caught it, not a poll. Git state and `ps` both looked healthy.
- **Opus refuters, and the TIERS labels.** The `// TIERS:` labels were once
  `bounded|open-ended`, and "verify one claim" was filed as bounded. That misfile kept
  producing sonnet refuters.
- **Agent model pins** (a hook can enforce this). Two Explore recon agents
  dispatched with no pin silently inherited the most expensive model. The Workflow-only gate had a hole where
  the Agent tool's own description says "omit and inherit".
