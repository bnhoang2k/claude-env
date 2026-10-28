---
name: prior-art-check
description: Use before building a new tool, framework, pipeline, gate or check by hand, and when the user asks "does a tool like this already exist?", "surely it can't be a new idea", "how do people in industry solve this", "how do pros do it", "what would senior engineers see and miss", "are we reinventing this" or "are we wasting tokens on X, be honest". A quick web check, not a report. Not for a multi-source narrative research report (use anthropic-skills:deep-research), not for choosing between options already on the table (a plain tradeoff in chat does that), and not for how this repo's own code works (read the code).
---

# Prior-art check

## Why
A user can easily miss that a thing they are building is a solved problem. Users ask how
industry solves a problem, what senior engineers would see and miss, or whether the work is
a waste of tokens. Without a prompt, Claude designs before it searches. This skill puts the
search first, so the plan on hand does not win by default.

**Prior art** means work that already exists: a tool, a library or a standard practice.
Analogy: before you build a bridge, you check whether the town already has one that fits.

## When to run it
- The user uses one of the trigger phrases above.
- You are about to propose building infrastructure by hand: a pipeline, a gate, a
  checker, a harness, a framework, a generic tool for "all workflows".
- Skip it for a small fix, a one-off script or UI taste work. A search on a trivial thing
  is noise.

## Steps
1. **State the need in one sentence.** Say what the thing must do, not how the repo does
   it today. A search for the kit's own name finds nothing. A search for "turn a recorded
   web animation into a reusable component spec" finds neighbours.
2. **Search the web, standard mode.** Make 2-4 `WebSearch` calls in one turn, each from a
   different angle:
   - the need in plain words, plus "tool" or "library";
   - the same need in the industry's own words (name the practice, such as "contract
     testing" or "feature flags");
   - "alternatives to <thing>" or "<thing> best practices <current year>".
   If results are thin or all marketing, go to extended mode: 2-4 more searches, then stop.
   `WebSearch` may be a deferred tool. Load it with `ToolSearch` first.
3. **Optional GitHub check.** For a code tool, run `gh search repos "<need>" --sort stars
   --limit 8`. Note stars, last push date and license. A repo with no push in two years
   is a warning, not a recommendation.
4. **Open at most 2 pages** with `WebFetch` when a snippet is not enough to judge a tool.
   This is a quick check, not a report.
5. **Check the claims.** Every named tool or practice needs a link you saw this turn. If a
   claim has no link, mark it "from memory, unverified".
6. **Test the fit against the repo.** Read the project's constraints before you say
   "adopt": license, language, who else must run it, whether it needs a server. A tool
   that fits the need but breaks a constraint is a "borrow the idea" case.
7. **Answer in the shape below.** Do not defend the current plan by default. If the search
   shows the team is reinventing something, say so in the first sentence.

## Answer shape
Lead with the verdict. Keep it to about 25 lines, in Simplified Technical English.

1. **Verdict (first line).** One of:
   - **Adopt**: use the existing tool as it is.
   - **Borrow the idea**: build ours, copy their design.
   - **Build**: nothing fits. Say why in one line.
   Add the cost in hours for that path and for the next-best path.
2. **What pros use.** 2-4 named tools or practices, each with a link and one line on what
   it does. Say which one a team of one would pick, and why.
3. **How it works, one analogy.** The analogy first (from daily life, not from software),
   then the mechanism in 2-3 sentences.
4. **What an industry engineer would flag as missing here.** 2-5 bullets. Check the usual
   gaps: tests, CI, a real server versus a mock one, monitoring, rollback, secrets,
   licensing, a bus factor of one. Say which gaps matter for a team of one and which do not.
5. **Where the search was thin.** One line. Name what you could not find or verify.

## Example (illustrative: names and hours are not verified)
Bad: "Great idea! Here is the design for a custom retry-and-validate loop for model
output." (No search. It defends the plan.)

Good: "Verdict: borrow the idea, about 3 hours, against about 12 to build from scratch.
Libraries in this space already force model output into a schema [links]. They assume an
API model and ours is a local one, so copy their retry-on-schema-failure loop and keep
our runner. Analogy: a form with required fields. The clerk hands it back until every
box is filled. Missing here, by industry habit: a CI run of the schema tests, and a log
of every retry."

## Common mistakes
| Mistake | Fix |
|---|---|
| Searching for the repo's own name for the thing | Search the need in plain words, then the industry term |
| A list of 10 tools | Name 2-4 and pick one |
| A verdict with no hour cost | Give hours for the chosen path and the next-best path |
| "It depends" as the verdict | Pick one of the three. State the one fact that would change it |
| Praising the current plan to be kind | Say it plainly. The user asked for honesty |
| Treating a stars count as proof | Check the last push, the license and one open issue |
| Writing a report file | Answer in chat. Write a doc only if the user asks |

## Not for
- A long, multi-source, narrative report: use `anthropic-skills:deep-research`.
- A choice between options already named, with no outside facts needed: give a short
  tradeoff and a stated pick in chat.
- How this repo's own code works: read the code, or use `ui-suite:explain-as-machine` for a picture.
- Studying how a page moves so it can be rebuilt: use `motion:steal-mechanism`.
