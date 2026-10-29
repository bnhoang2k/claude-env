---
name: blind-panel
description: Use when the user asks for blind reviewers on a spec, plan, design, script or finished change ("send blind reviewers", "get three blind reviewers", "have blind reviewers check the plan", "see what they agree on", "do a quadruple check", "look for blind assumptions", "what did the original agent assume or make up?", "make sure it didn't change more than it needed to"). Runs one panel per artifact as one ultracode Workflow and returns an agreement table. Not for a correctness review of a code diff (use code-review), UI breakage (use ui-suite:break-ui), 3D models (use models:break-models), the leak review before a public push (use workflow:publish-public), or a second round on an artifact that already had its panel.
---

# Blind panel

A blind panel is a small group of reviewers who see only the artifact and the criteria. They never see why the author chose what they chose. The author's reasoning is the thing that fools a reviewer: a reviewer who hears "I did X because Y" tends to agree with Y.

Analogy: a taste test where the judges do not see the labels. If two judges pick the same dish without knowing the chef, that pick means something.

**Why:** users ask for this on specs, plans and clearance checks: to see what independent reviewers agree on, to find assumptions nobody is considering, and to confirm a change did not touch more than it needed to.

## When it fires

Only on the user's explicit ask. Do not start a panel on your own. The panel counts as the artifact's one check: one panel per artifact, never a loop.

If the user asks for blind reviewers on a spec and later on its plan, those are two artifacts and two panels. That is fine.

**The call is an ultracode opt-in.** Run the whole panel as one Workflow script, never as separate background Agent calls. Separate agents leave the verify step to the author, who is the one person a blind panel exists to route around; a script puts adversarial verification in the same run.

## The workflow

Four stages, one script:

1. **Find** (barrier): the N reviewers, the assumption hunter and the scope check, in one `parallel()`. Each returns findings through a schema (`claim`, `quote`, `severity`, `context_seen`).
2. **Merge** (one opus agent): groups the findings by meaning, counts who raised each, and drops any finding with no quote or symbol and any reviewer whose `context_seen` names the plan or the chat. It needs every finding at once, which is why stage 1 is a barrier.
3. **Verify** (refuters): for each merged Broken finding, two opus refuters; for each other singleton, one. Each reads the cited place in the artifact (and the code, for a plan or a change) and tries to refute the claim. A finding survives when no refuter refutes it. Cap this stage at 10 units with an explicit `.slice()`, and `log()` every finding the cap dropped; the author checks those by hand.
4. **Return** the merged rows with their votes and verdicts. The author builds the agreement table from that.

Worst case at N=3: `4.5 (find) + 1 (merge) + 10 (verify) = 15.5 units, 15 agents`. State it, with the `// TIERS:` block, in the launch message.

## Before launch

1. **Load `workflow:workflow-fanout-budget`.** Do this before you write any launch call.
2. **Fix the artifact.** Name one file (or one commit range) and freeze it. Reviewers read that exact version.
3. **Write the criteria.** Five to eight plain questions about the artifact, taken from the user's request and the artifact's own goal. Examples for a spec: "Can an engineer build this with no questions?", "Does any section contradict another?", "Which claims have no source?" Do not put the author's reasons in the criteria.
4. **Write the original request in the user's words** (one short quote). Only the assumption hunter and the scope check get it.
5. **State the worst case in the launch message.** Default N=3:
   `3 opus reviewers + 1 opus assumption hunter + 1 sonnet scope check = 4.5 units, 5 agents`.
   N=4 is 5.5 units. Never go above N=5. Cap the list with an explicit slice.
6. **Pin `model` on every agent.** Reviewers and the assumption hunter run on opus, because review strength catches bugs. The scope check compares a diff to a request and runs on sonnet. The merge agent and the refuters judge, so they run on opus. Write the script's `// TIERS:` block.
7. **Check the sandbox.** Copy the frozen artifact into the scratchpad and give reviewers only that path. A subagent starts in the project cwd, where CLAUDE.md, plan docs and design notes can leak the author's reasoning. Tell them not to read git log, commit messages, chat transcripts, plan history, memory files or sibling review notes. Ask each reviewer to start its findings with one line that states what context it could see. Drop a reviewer that names the plan or the chat.

## The panel

| Role | Sees | Question |
|---|---|---|
| Reviewer 1..N | artifact + criteria | Where does this fail the criteria? What is wrong, missing or contradicted? |
| Assumption hunter | artifact + original request | What did the author assume, invent or leave unstated? Each invented number, name, path or rule counts. |
| Scope check | artifact (or diff) + original request | Does the artifact do more than the request needs? List each extra file, section or behavior. |

Give each reviewer a different angle in one line, so they do not all find the same thing: for example "read as the person who must build it", "read as the person who must break it", "read as a newcomer who knows none of the project". Use the same criteria for all.

Reviewer rules, put them in every brief:

- Return findings as a list. Each finding has: a one-line claim, a quote or symbol from the artifact that proves it, and a severity (Broken, Weak, Nit).
- A finding with no quote or symbol is dropped.
- Say "no findings" when there are none. Do not invent some to look useful.
- Do not edit the artifact. Do not ask questions back.

A reviewer that asks a question is a sign the artifact is unclear. Log it as a finding, then answer nothing. Replying to a live workflow agent resumes a duplicate that edits the same files.

## The agreement table

When all agents return, merge their findings by meaning, not by wording. Build one table:

| Finding | Reviewers | Severity | Author response |
|---|---|---|---|
| Section 3 contradicts section 5 on the retry limit | 3 of 3 | Broken | Accept. Fixed in section 5. |
| The migration has no rollback step | 2 of 3 | Weak | Accept. Added a rollback line. |
| "100 ms" timeout has no source | hunter only | Weak | Reject. Measured in `bench.py`. |

Group the rows in three blocks: **agreed** (most reviewers), **split** (some reviewers, some silent or opposed), **singletons** (one reviewer). Put the assumption hunter and scope check rows in their own block, since they work from a different brief.

Do not just count votes. A singleton that cites a real line is worth more than three vague agreements. The verify stage marks each singleton and each Broken finding "verified" or "not reproduced"; read the refuters' reasons, and check by hand any finding the cap dropped.

The **author response** is yours, and it comes after the table. For each row pick one:

- **Accept.** Change the artifact. Say what changed.
- **Reject.** Give one sentence of evidence. The user can overrule you.
- **Defer.** The finding is real but outside this task. File it as an issue in the project's own repo.

For a finished code change, accept only Broken rows and defer the rest. For a spec or plan before build, you may fix any accepted row.

## After the table

- Apply the accepted fixes once. Prove them with the artifact's own gates or tests. Do not send the fixed artifact back to the panel.
- Show the user the table, then the fixes. Lead with the Broken rows.
- Keep the table in the task's log or the PR description, not in a new doc.

## Good and bad

Good: the reviewer brief holds the spec path, six criteria and one angle line. Three reviewers return. Two both flag a missing error case with the same quoted sentence. That row reads "2 of 3, verified".

Bad: the brief says "we chose a queue because the API is slow; check the design". Every reviewer now judges the queue idea, not the spec. That panel is no longer blind.

## Not for

- Correctness of a code diff, bugs, edge cases in code: use `code-review`.
- A UI that may break on bad data: use `ui-suite:break-ui`.
- A 3D model or a scene: use `models:break-models` or `models:break-scene`.
- The leak review before a public push: use `workflow:publish-public`.
- A second round after fixes: one check per artifact. File what remains as issues.
- A quick sanity check the user did not ask to be blind: ask one reviewer or read it yourself.
