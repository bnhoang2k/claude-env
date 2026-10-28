---
name: plan-review
description: Use when the user asks for a review of a spec or plan before code is written ("review the plan", "poke holes in this spec", "check the plan against the code", "is this plan safe to build?"). Dispatches one general-purpose agent to read the real files the plan touches, and returns findings ranked Blocker, Major and Minor, each with quoted evidence, a failure story and a fix. Not for several independent reviewers on one artifact (use workflow:blind-panel), a correctness review of a code diff (use code-review), or UI breakage (use ui-suite:break-ui).
---

# Plan review

A plan review is one reader who checks the plan against the real code before anyone builds it. Analogy: a surveyor walks the lot before the builder pours the foundation. A wrong claim about the ground is cheap to fix on paper and costly after the concrete.

**Why:** a plan names files, functions and an order of work. Those claims are often wrong in small ways. A cheap read finds them before they become rework.

## When it fires

Only when the user asks, or when the user's own project instructions say to review plans before code. One review per spec or plan. Do not loop: fold the fixes in, then stop.

## Inputs

Collect these before dispatch. Ask for the artifact and the locked decisions if they are missing; propose the lenses; default the depth.

1. **The artifact.** The path of one spec or plan. Do not edit it while the review runs: the agent reads that exact file.
2. **The locked decisions.** A pasted list, or a path. The agent must not reopen these.
3. **One to three lenses.** A lens is a question the reviewer holds while it reads. Examples: data integrity, process lifecycle, plan claims against the code, release order, cross-platform paths. Propose lenses that fit the plan, with a one-line reason for each. The user may change them.
4. **Depth.** It sets the model, the lens count and how much the agent reads.

| Depth | Model | Lenses | Reading |
|---|---|---|---|
| `quick` | `sonnet` | 1 | The plan and the files it names most often |
| `standard` | `opus` | up to 3 | The plan and each file it changes |
| `thorough` | `opus` | 3 | Every file the plan names, and the callers of each changed symbol |

Default to `standard`. State the depth, the model and the lenses in one line before you dispatch.

## Dispatch

Call the Agent tool once with `subagent_type: "general-purpose"`. Pin `model` to the value in the table: `sonnet` for `quick`, `opus` for `standard` and `thorough`. Never use a typed agent, and never leave `model` unset. Wait for its reply before you edit the plan.

Fill the placeholders in this prompt and send it. Write one line for each lens you chose, and no more:

```
You are reviewing a plan before any code exists. Find what is wrong with it.

ARTIFACT: <path to the spec or plan>
LOCKED DECISIONS (do not reopen these):
<pasted decisions, or a path to read>
LENSES (read the plan through these, in order):
<one line per lens>
DEPTH: <quick | standard | thorough>
READING: <the reading column for this depth>

Rules:
1. Read the real files the plan touches. Do not trust the plan's description of them.
   At thorough depth, read every file the plan names and the callers of each changed symbol.
2. Quote what you found. Every finding needs a file and a symbol, with the text you read.
   A finding with no quote is dropped. For a missing file or symbol, quote the plan line
   that names it and say what you searched.
3. Find what is wrong. Do not praise. Do not summarize the plan.
4. Do not reopen the locked decisions. If a decision causes a real failure, report the
   failure as a finding and say which decision it comes from.
5. Rank each finding:
   Blocker: the plan cannot work as written, or it destroys data or state.
   Major: the plan works but fails in a likely case, or the order of work is wrong.
   Minor: a wrong detail that costs a little rework.
6. For each finding give: rank, a one-line claim, the quoted evidence (file and symbol),
   a failure story (who does what, and what breaks), and a fix.
7. If there are no findings, reply with exactly this line and nothing else: no findings
8. Do not edit any file. Do not ask questions back. Do not run the project's tests.
9. When you have findings, start your reply with one line that lists the files you read.
```

## After it returns

1. **Check the claims.** Open the file behind each Blocker and Major. A finding whose quote does not match the file is wrong: reject it and say so. For a missing-file finding, confirm the file is absent.
2. **Fold in accepted fixes.** Edit the plan or spec in place. Do not add a dated "review" section to it.
3. **Tell the user** which findings you took and which you rejected, with one reason for each. If a finding needs a locked decision to change, do not change it. Name the decision and ask the user.
4. **Stop.** Do not run a second review of the same artifact unless the user asks.

If the reply is `no findings`, tell the user in one line. A clean result from a `quick` run reads little, so offer a `standard` run only if the plan is large or risky.
