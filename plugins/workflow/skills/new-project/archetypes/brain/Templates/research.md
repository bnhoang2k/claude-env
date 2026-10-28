---
type: research
status: draft | in-progress | complete
created: YYYY-MM-DD
tldr: "One sentence: the conclusion, not the topic. What did we learn and what should we do?"
phase: "Phase N — what phase was active when this research happened"
trigger: "What prompted this — a blocker, a spike, a question, a user request"
tags: []
---

# [Title — phrase the question we were answering]

## Trigger & Context

Why this research exists. Answer ALL of these:

- **What prompted this?** The specific blocker, question, spike, or decision that couldn't be made without more information. Link the GitHub issue, plan step, or conversation that triggered it.
- **Project state at the time:** What phase were we in? What had just shipped? What were we about to build? This lets a future reader judge whether the findings still apply.
- **Codebase state:** What existed in the code that's relevant? What architecture was in place? What constraints were we working within? Reference specific files/systems.
- **The gap:** What didn't we know? What assumption were we operating on that needed validation? What decision was blocked?
- **Stakes:** What depends on the answer? What would go wrong if we guessed instead of researching? Which future phases or features are affected?

Keep this section factual and specific. "We needed to understand search" is useless. "Phase 2 search took 4 s at 10k rows because the ORM ran one query per row, and we needed to decide between 3 fixes before building the results page" is recoverable.

## Bottom Line

- **Finding 1** — what we learned and why it matters to the decision
- **Finding 2** — second most important takeaway
- **Finding N** — as many as needed, ordered by importance
- **Recommendation** — the decision this research enables. What should we do, and why this option over the alternatives?

## Key Evidence

Every claim needs a linked source. If you can't link it, flag it as "unverified" — don't present it as fact.

| Evidence | Source (with link) | Confidence | Why it matters |
|----------|-------------------|------------|----------------|
| [Specific claim] | [Name](url) — page/section/timestamp | High/Med/Low | How this supports or contradicts a finding |

- **High confidence:** linked to official docs, WWDC session with timestamp, peer-reviewed source, or verified open-source code
- **Med confidence:** linked to community post, forum thread, or blog with code samples that can be verified
- **Low confidence:** reasoning from first principles, extrapolation, or source no longer available — say so explicitly

## Full Analysis

### [Subtopic A]

Deep analysis. Include:
- Data, quotes, code samples, comparisons
- What we tested or prototyped (if applicable)
- What we considered and rejected, and why

### [Subtopic B]

Continue as needed. Each subtopic should be a distinct line of investigation, not just a different source.

### Approach Comparison

If the research compared multiple approaches:

| Approach | Complexity | Quality | Trade-offs | Best For |
|----------|-----------|---------|------------|----------|
| A | ... | ... | ... | ... |
| B | ... | ... | ... | ... |

## What This Unlocked

What decisions were made based on this research? What was built? Link to the PR, commit, plan, or spec that consumed these findings. If nothing was built yet, say what's next.

This section gets updated AFTER the research is consumed — it closes the loop.

## Sources

Every source must be a clickable link. No "Apple documentation says..." without the URL. If a source is paywalled, archived, or offline, note that. If you used a WWDC session, include the session number AND a timestamp for the relevant segment.

- [Source name](url) — what it contributed to our understanding
- [WWDC YYYY, Session NNNNN](https://developer.apple.com/videos/play/wwdcYYYY/NNNNN/) — timestamp MM:SS, specific claim it supports
- [GitHub repo or file](url) — what pattern or code we referenced

**Not a source:** your own reasoning, "common knowledge," or anything you can't link. If the finding came from reading our own codebase, reference the file path and line numbers instead.

## Provenance

Required for any research artifact that may inform an architecture decision, ship in a pitch deck, or be cited by another agent. See `Templates/research-integrity.md` for the protocol.

- **Research date:** YYYY-MM-DD
- **Author / agent:** human or agent name
- **Tier applied:** STRICT / STANDARD / LIGHT (per `research-integrity.md` Per-Domain Strictness Tiers)
- **Sources consulted:** N (raw count of everything looked at)
- **Sources verified:** N (subset that survived URL check / direct read)
- **Sources rejected:** N (dead links, paywalled-and-unreadable, contradicted by primary source)
- **Verification method:** [direct read / cross-source triangulation / search-tool query / memory recall + verification]
- **Verifier pass:** [not run / PASS / PASS WITH NOTES / FAIL] — if `research-verifier` agent ran, link its verification log
- **Known gaps:** what could not be confirmed and why; what would change the conclusion if it could be verified
- **Externalization status:** [internal only / cleared for external use / blocked pending verification]
