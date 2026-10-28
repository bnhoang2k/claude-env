---
name: where-are-we
description: Use when the user asks for status in the middle of a session or a run — "how's it looking", "did it die", "is it stuck", "stalled?", "is it done", "so did it work?", "what's taking so long", "how much longer", "now what", "what's next", "what have we done so far", "why are we doing this" — or says they lost the thread of why the work exists. Gives a short, evidence-based status card. Not for returning after time away (use workflow:recall), not for a coordinator's plan timeline (use workflow:babysitter), and not for setting an estimate before a job starts.
---

# Where are we

## Why
Users ask this question often, across many projects. Answers tend to fail in three ways. They guess instead of checking whether a job died or is only slow. They hedge instead of saying whether it worked. They leave the user without the goal of the work.

The card answers the question from evidence, in about 6 lines.

## Step 1: Check what is alive
Never answer a status question from memory. Collect the facts first. Run these in one step, in parallel.

- `date` for the current time. Every age below is measured against it.
- `ListAgents` for subagents and teammates.
- `mcp__ccd_session_mgmt__list_sessions` with `linked: true` for sessions this one started.
- For each background task: the mtime of its output file (`stat -f %Sm -t %H:%M:%S <file>`) and the tail of that file.
- For each Workflow run: the mtime of each agent's own transcript, `agent-<id>.jsonl`. That mtime is the sign that an agent is alive. The run's `journal.jsonl` sits beside the transcripts. It holds only "launched", "started" and "result" lines, so a healthy agent writes nothing there until it returns. Use the journal only to see which agents have started or returned. The directory is `~/.claude/projects/<project-slug>/<session-id>/subagents/workflows/wf_<run-id>/`. When the Workflow tool result does not show the path, `ls` that directory.
- `git log -3 --format='%h %cr %s'` in each worktree that work runs in, and `git status --short` for uncommitted edits.

Read the tool results before you write the card. A tool that errors is a gap. Say so in the card. Do not fill it with a guess.

## Step 2: Decide "stalled" from the evidence
A thing is **stalled** only when all three hold:
1. It claims to be running (the list shows it alive, or no exit is recorded).
2. Nothing new came from it for about 15 minutes. That means no new output, no new line in the agent's transcript, no commit and no edited file. A Workflow journal that does not change proves nothing.
3. Nothing explains the silence. A long test run, a solve or a render may be silent and still healthy. Check what command it is in.

Below 15 minutes, call it **quiet**, and show the age. Do not call it stuck.

Then say what you will do, and do it:

| What is silent | Action |
|---|---|
| A plain subagent or teammate | `SendMessage` a short probe: "Status in one line." No reply in a few minutes: it is dead. Re-dispatch fresh from the work on disk (workflow:workflow-fanout-budget). |
| A Workflow agent | Do not message it. A reply resumes a duplicate that edits the same worktree. Wait for its return. If it is truly dead, launch a fresh run over the missing items. |
| A background command | Read its output. If the process is gone, say it died and name the exit. Re-run only on the user's word if the run costs money. |
| A linked session | Read its last events with `mcp__ccd_session_mgmt__list_events` (`session_id`, a small `limit`). Do not ping a session that waits on the user. |

## Step 3: Write the card
Plain words, 5 to 7 lines, answer first. Write only the lines that have content.

1. **Goal.** One line: what and why, tied to the plan or spec. ("Plan 1 of 3: make the installer give the same setup on any machine.")
2. **Done.** What finished, with the count: "4 of 9 tasks".
3. **Running.** Each live thing, since when, and the age of its last output.
4. **Stalled.** Only what Step 2 proved, and what you are doing about it. Otherwise leave this line out.
5. **Waiting on the user.** The exact decision, or "nothing".
6. **Next.** The next step, in one line.
7. **ETA.** See below.

### ETA rule
Compute it from this session's own measured time: minutes spent, tasks finished, tasks left.

- Write: "4 of 9 done in 52 min, so about 65 more, if the rest are the same size." Keep it unpadded. Add what could stretch it, in one clause.
- Never give an estimate in human days or hours of human work. Never pad it.
- With no finished task to measure, write "no measured basis yet". Say what you would measure first.

## Step 4: A "did it work?" question
Start with one line: **worked**, **did not**, or **partly**. Then the one piece of evidence: a test result, a build line, a screenshot, a diff. For "partly", name what worked and what did not. Never answer with "should work". If you cannot verify, say so and name how you would.

## Example
Bad:
> Things are going well. The agents are working on the remaining tasks and it should finish soon.

Good:
> **Goal.** Plan 1 of 3: make the installer give the same setup on any machine.
> **Done.** 4 of 9 tasks, all committed (last commit 6 min ago).
> **Running.** Implementer 5: last output 3 min ago (a test run). Implementer 6: last output 22 min ago.
> **Stalled.** Implementer 6, transcript silent 22 min. It is a plain subagent, so I am sending a probe now.
> **Waiting on the user.** Nothing.
> **Next.** Review task 5 when it returns, then start task 7.
> **ETA.** About 65 min, from 52 min for 4 tasks. A stalled implementer would add one task's time.

## Not for
- Coming back after hours away, or "catch me up": use `workflow:recall`.
- A timeline across several plans in a coordinator session: use `workflow:babysitter`.
- Setting an estimate before work starts: that is a planning step, not a status card.
- Telling the user the run will keep going through task boundaries. That is already the default (a terse directive such as "go" means execute).
