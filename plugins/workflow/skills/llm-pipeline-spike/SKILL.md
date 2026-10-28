---
name: llm-pipeline-spike
description: Use when about to change or trust a prompt, schema, template or parser on a pipeline whose model output is graded (a local 9B model, a hosted model, any future one), or when the user says "spike it", "spike both lever fixes", "test different ways we can reword the instruction", "are we overfitting", "it flagged 15 but what about the ones it didn't find?" or "is it a prompt issue? server issue? llm issue?" in that setting. Not for visual, taste or motion spikes judged by eye (use ui-suite:ui-taste), not for hardcoded counts in UI kits, and not for literature research (use anthropic-skills:deep-research).
---

# LLM pipeline spike

## Why
A spike often skips the checks that matter: survivor bias (it flagged 15, but what about the
ones it did not find?), overfitting, and which layer caused a failure (prompt, server or
model). This skill puts those checks first, so a spike answers one question and cannot
fool us.

A spike is a small, cheap experiment. It tests one change on a graded model pipeline before
anyone builds on it. Analogy: a taste test with a blindfold, run before you print the menu.

## Steps
1. **Ask whether code can do it.** Can a deterministic parser, regex or lookup find the
   answer? If yes, let the server do it and let the model judge only what the code hands it.
   Spike the code path first. Spike a prompt only for the part code cannot do.
2. **Write the question and the arms.** One sentence: "Does change X raise recall of Y?"
   Arms: the current baseline plus each variant. Change one thing per arm. A baseline arm is
   mandatory, because "it got worse?" has no answer without it.
3. **Pick N and say why.** Give a reason ("20 cases, because the gold set has 20, and 6 of
   them are the hard kind"). Split the cases first: a tuning set to design on, and a
   held-out set the change never saw. Report the held-out result as the result.
4. **Pre-flight the spend.** Before any paid batch, state per-job cost x count = total, and
   a ceiling. Get one confirmation. Local-model and gold-file runs cost nothing: say so.
   (Do this even if no rules file asks for it: a paid batch is hard to undo.)
5. **Score blind against gold labels.** The gold labels come from a calibrated judge (a
   stronger model's output, or a prior reviewed run), and the user spot-checks a sample of the
   yeses. The scorer must not see which arm made an output. Shuffle and strip the arm name.
6. **Report misses, not only hits.** For each arm, give precision and recall, and list the
   gold items it missed by name. "It flagged 15" is half a result. "15 of 22 real ones; the
   7 it missed are these" is the result.
7. **Run the overfit check.** List what is hardcoded in the change (a sentence copied from
   one case, a count, a name, a template slot) and what varies per case. If a hardcoded
   part only fits the tuning set, the held-out score is the test. If held-out is much
   worse than tuning, the change overfit. Say so.
8. **Attribute each failure to one layer.** For every miss or wrong hit, name the cause:
   - **prompt**: the wording did not ask for it.
   - **code**: the server fed the model the wrong text, or cut something off.
   - **schema**: the output shape cannot hold the right answer.
   - **model limit**: the model cannot do it at this size, even with a clear prompt.

   Test the claim when cheap: fix that one layer on that one case and re-run it. A "model
   limit" verdict needs that re-run, because it is the easiest layer to blame. (A paid
   re-run goes through step 4.)
9. **Write the README and end with a verdict.** Use the template below. The last two lines
   are always the verdict and one next step.

## Spike folder
Put each spike in its own folder, with the README, the case lists, the raw outputs and the
scoring script. Keep the raw outputs, so a later question needs no re-run.

README template, in this order:

```
# Spike: <name> (<date>)
Question: <one sentence>
Why code alone does not do it: <one sentence, from step 1>
Arms: <baseline + variants, one line each>
Cases: N = <n> because <reason>. Tuning: <ids>. Held-out: <ids>.
Cost: <per job x count = total; ceiling; confirmed by the user on <date>>
Scoring: <blind how; gold from where; the user checked which sample>
Results (held-out): <table: arm, precision, recall, misses by name>
Overfit check: <hardcoded vs varies per case; tuning vs held-out gap>
Fault attribution: <each failure -> prompt | code | schema | model limit>
Verdict: <ship arm X / do not ship / need more cases, and one sentence of why>
Next step: <one action>
```

## Example (made-up numbers, for shape only)
- **Bad:** "Variant B flagged 15 matches versus 11 for baseline. B is better." It has no
  held-out set, no misses, no gold, and the same cases tuned the prompt.
- **Good:** "On the 8 held-out cases, B found 7 of 9 real matches (baseline 4 of 9). It missed
  the two where the answer paraphrases the source text. Cause: code, because the server cut the
  text at 2,000 characters. Verdict: ship B and fix the cut. Next step: re-run the 2 cases."

## Not for
- Visual, taste or motion experiments judged by eye: use `ui-suite:ui-taste`. Judge by eye with
  the user; this protocol does not apply.
- A bug with a known cause and a clear repro: fix it (see `superpowers:systematic-debugging`).
- A plain code test: use `superpowers:test-driven-development`.
- Researching what others found: use `anthropic-skills:deep-research`.
- A project's own memories (its prompt-balance notes, its judge calibration) stay in that
  project. Read them as worked examples, and do not copy them here.
