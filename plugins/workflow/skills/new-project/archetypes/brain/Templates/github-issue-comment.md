## [Status — "Fixed", "Investigation Update", "Closed — reason"]

[One-line summary with commit hash if applicable: "Fixed in `abc1234` — what changed."]

### Root Cause

What was actually wrong — the cause, not the symptom. Be specific enough that someone encountering a similar symptom can pattern-match: "The price cache key left out the locale, so `getPrice()` served the first locale's cached value to everyone" not "the prices were wrong."

### Struggles

What we tried that didn't work, and why. This is the "don't repeat this" section — future debuggers hitting similar symptoms should skip these dead ends.

- **Round 1:** what was attempted → what happened → why it failed
- **Round 2:** next approach → outcome → insight gained

Scale to complexity. A one-line fix can skip this entirely. A multi-day investigation needs the full timeline.

### Ahas

Surprising discoveries that changed our mental model. Things that weren't obvious from reading the code. These are the highest-value lines in the comment — they're what makes prior art search worthwhile.

- [Non-obvious insight] — why this was surprising
- [Mental model shift] — what we assumed vs. what was actually true

Skip for trivial fixes. Required for any fix that took more than one attempt.

### Solution

What finally worked. Include:
- Files changed and why each change was needed
- For parameter tuning: table with before/after values
- For architectural changes: prose explaining the design decision
- Link to the PR or commit

### Residual Risk

Is there anything left that could regress? Related issues that should be watched? Conditions under which this fix might not hold? Skip for clean fixes with no loose ends.
