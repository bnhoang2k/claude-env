---
name: overnight
description: Use when the user says they are going to sleep or away for hours and wants work to keep running unattended — "run overnight", "I'm going to sleep", "work while I'm gone", "/overnight". Works alone or under a babysitter. Keeps executing a detailed plan without stopping; sets the unattended rules (no push, no questions, reversible work only); writes down every ambiguous or urgent item in one morning review file as the work goes; and ends by running the handoff skill and saving that prompt in the same file. Not for a single long command (just run it in the background) and not for a status check (use workflow:where-are-we).
---

# Overnight

The user is leaving. Work continues without them, and **it does not stop while a plan is laid
out**. Anything ambiguous or urgent gets written down in one file for the morning; it does
not stop the run. When they come back, that file tells them what happened, what needs their
attention, and how to continue. They read the file and the handoff; they do not dig through
sessions.

This skill works the same alone or under a babysitter. Under a babysitter, the babysitter
runs it and its sessions follow the same rules.

## The rules for the night

1. **Never push, publish, deploy, spend money or send anything outward.** Stage it, and write
   the exact summary the user would approve (branch, remote, commit list, what it changes).
   The user says yes in the morning, at that moment. An earlier "go" is not approval.
2. **Ask no questions.** Do not call AskUserQuestion; nobody is there, and a waiting card
   stops the session. Settle what data can settle and log the reason. Put every real
   decision in the file with a recommendation (see "Needs your attention").
3. **Reversible work only.** Commit locally, move files to the Trash (never delete), make no
   history rewrites, no force operations. If a step cannot be undone, stop before it and
   put it in the file.
4. **Do not start new scope.** With a detailed plan, run all of it. With no plan, finish what
   is running and what the user already named. Idle is a good result. Never invent extra
   work to fill the night.
5. **Respect the budget.** Check `get_usage` before starting anything. When the weekly percent
   used is more than 10 points ahead of the percent of the week gone, run one session at a
   time and queue the rest.
6. **Keep going; write it down.** Never stop the run to wait for the user. At an ambiguous
   point, pick the safest reversible reading, do that, and log the other readings. If no
   reading is safe, skip that item, carry on with the rest of the plan, and log it. A step
   that needs the user's word (a push, an unapproved merge, a spend) is staged, never done
   (rule 1), and logged. Something **urgent** (a failure that blocks the plan, data at risk,
   something expiring, a fault that gets worse with time) goes in the file at once, marked
   URGENT.
7. **Two failed tries on one item: park it.** Write what failed and what you tried, then move
   to the next step. Do not loop.

## Step 1: Start (one message)

1. Run `date`. Note the time and the plan for the night.
2. List what is alive: linked sessions (`list_sessions` with `linked: true`), running
   background commands, uncommitted work (`git status --short` in each checkout).
3. Make the morning file (see "Where the file lives"). Write the opening section now:
   time started, what is running, what each session will do, the rules above in one line.
4. Send each running session exactly one message: the rules, what it should finish, and
   "write your state in your results file so a successor can resume; send me 3 lines when
   ready; do not ask the user anything; do not archive yourself". Batch: one message per session.
5. Under a babysitter, keep the keep-alive cron running. A session waiting on the user is
   skipped by it, so tell sessions not to end on a question.

## Step 2: Run

- Work or wait. When a session reports, **verify before you log it**: check the commit exists
  (`git log`), re-run the one gate that proves it, read the artifact. A session's "done" is
  its report, not proof.
- After each verified result, append one line to the morning file: what landed, the proof,
  the path. Append as it happens, so a crash loses nothing.
- Settled calls: when you pick for the user, write the pick, the reason in one line, and how
  to undo it, under "What I decided for you".
- Ambiguity and urgency: the moment you hit one, append it to "Needs your attention" in the
  file (see below). Write the item so it can be read cold: what happened, what you did about
  it, what the options are, your recommendation. Then keep working.
- Do not wake idle sessions for news. One message per session per round.

## Step 3: Close (when nothing is running, or work has reached its gates)

1. Re-check every claim against the repo: `git log`, `git status`, the gate outputs. Mark
   anything not re-checked UNVERIFIED.
2. Write the final sections of the morning file (below).
3. Make sure "Needs your attention" is complete and ordered: URGENT first, then ambiguous.
   Run the `workflow:handoff` skill. It normally refuses to write a file. The user has asked
   for this one to be saved, so paste its prompt into the file under "Handoff prompt".
   Everything else in `workflow:handoff` applies: gather ground truth, never write from
   memory, always keep LOCKED DECISIONS and NEXT ACTION.
4. **Switch off whatever keeps the night alive**, once everything is done: every plan step is
   finished or parked, no session is working, and no background job is running. Then:
   - `CronList`, then `CronDelete` each job this run made (the babysitter's keep-alive cron
     is the usual one). Never delete a job you did not make.
   - Stop each background command or monitor this run started (`TaskStop`), after checking it
     is not still producing something you need.
   - Send no more keep-alive pings.
   Write what you stopped (job ids and names) under "Sessions" in the file. If work is still
   running at the end, leave the keep-alive on, say so in the file, and switch it off in the
   morning only on the user's word.
5. Stop. Do not archive sessions or clean up; those need the user's yes. List them under
   "Sessions" with what each is waiting for.
6. In chat, say in two lines that the file is ready and where it is.

## Where the file lives

`.planning/overnight/YYYY-MM-DD.md` in the project's notes repo (for example the brain repo).
With no notes repo, put it in the project at the same path and add `.planning/` to
`.gitignore`. Under a babysitter, also add one line to its log
(`.planning/babysitter/user-review.md`) pointing at the file. The file is untracked: write
it, do not commit it, unless the user asks.

## What the file holds (in this order)

Write in plain English, short sentences, every label spelled out the first time. Start with
the answer.

1. **Morning summary.** Three to five lines: what ran, what landed, what needs attention. If
   nothing went wrong, say so.
2. **Needs your attention.** URGENT items first, then ambiguous ones, each numbered. Each
   item: what happened or what was unclear, what I did about it, the options, my
   recommendation and why, and the safe default. One decision per item. This is the part the
   user acts on, and it is repeated in the handoff prompt so the morning session reads it
   cold.
3. **Waiting to push or publish.** Each item: branch, remote, commit list, what it changes,
   and the exact words to approve it. Nothing here has been pushed.
4. **Landed (verified).** What changed, with the proof: commit, gate output, file path.
5. **Gaps and unverified.** What was not checked and why, failed tries, anything that
   looks done but is not proven.
6. **What I decided for you.** Each pick, the one-line reason, how to undo it.
7. **Sessions.** Each session: id, name, state, what it waits for, whether to archive it.
   Only the user's yes archives. Also list what was switched off (cron jobs, monitors) or,
   if something is still on, what and why.
8. **Handoff prompt.** The fenced block from `workflow:handoff`. It must let a fresh
   session continue with no re-exploration, and it must carry every item from "Needs your
   attention" (URGENT ones first) so the morning session deals with them.

## In the morning

When the user returns and asks, read the file first. Give the Morning summary in two or
three lines, then take the items in "Needs your attention" one at a time with
AskUserQuestion, URGENT first, the recommendation first. After the decisions, do what they unlock. A push is asked in the
moment, naming branch and remote.

## Mistakes to avoid

- Asking a question "just in case". A pending card stops the night. Write it down instead.
- Stopping because something is unclear. Pick the safe reading, log it, keep going.
- Starting a second session because the first is slow. Wait; pace by budget.
- Trusting "done" from a child. Verify, then log.
- Writing the file only at the end. Append as you go.
- Calling the night a success because nothing broke. Say what actually landed.
- Leaving the keep-alive cron running after the work is done. It keeps pinging sessions that
  have nothing left to do.
