# [Title — verb phrase: "Rendering: X does Y" or "Fix: X fails when Y"]

## Problem

What's wrong or missing. 2-3 sentences max. Include specific file and line references if a rendering bug.

**How we got here:** What were we doing when we found this? What investigation, audit, or user action surfaced the problem? Link the research doc, audit, or conversation if applicable. This prevents future readers from asking "where did this issue come from?"

## Evidence

Screenshots, file references, test file + line numbers, or concrete examples. Skip section if self-evident from the Problem description.

## Impact

Who/what is affected? Is this blocking other work? Does it affect a specific phase, feature, or demo gate? This helps prioritize without re-investigating.

## Proposed Solution

How to fix it, or the approach to take. Scale detail to complexity:
- Simple: "increase clearance by 2pt in `file:line`"
- Moderate: numbered steps with file references
- Complex: pseudocode, data structure changes, architectural approach

If multiple approaches exist, list trade-offs briefly. The person picking this up should understand WHY this approach was chosen.

## Out of Scope

What this issue deliberately does NOT cover. Omit section only if there's genuinely nothing to exclude. Usually there's adjacent work that should be a separate issue — call it out here to prevent scope creep.

## Priority

[P0 (demo blocker) / P1 (should fix) / P2 (nice to fix) / future-phase]

**Why this priority:** one sentence justifying the rating. "P1 because it breaks checkout for every guest user" is useful. "P1" alone is not.
