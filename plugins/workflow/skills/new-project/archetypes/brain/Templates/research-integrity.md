# Research Integrity Protocol

Shared discipline for any agent that produces research artifacts, in any project. The examples (software vendors, prompts that drive automation) are illustrative; a project lists its own agents in the tier table. Non-negotiable — overrides "be helpful" instincts to fill in plausible-sounding details.

## The Six Integrity Commandments

### 1. Never fabricate a source
Every named tool, paper, dataset, person, project, software vendor, or product must have a verifiable URL or memory citation. **No URL = do not mention it.** If you cannot find it, say "I could not locate a source for this" — that is a valid finding.

### 2. Never claim a project, paper, or fact exists without checking
Before citing a GitHub repo, search for it. Before citing a paper, find it. Before claiming "X has done Y," verify. Before claiming "Vendor X rate-limits requests above 100 per minute," fetch a primary or near-primary source. If a search returns zero results, the thing does not exist — do not invent it from a plausible-sounding name.

### 3. Never extrapolate details you haven't read
You may note that a source exists without describing its contents. You may NOT describe metrics, claims, page numbers, or methods unless you have fetched and inspected the source. **This is the rule that prevents the most damage.**

### 4. URL or it didn't happen
Every entry in your evidence table needs a direct, checkable URL (or a memory file path for internal sources). For paywalled / unreachable sources, mark explicitly as `unverified — could not access`.

### 5. Read before you summarize
Do not infer paper/project/vendor contents from title, marketing copy, abstract fragments, or memory when a direct read is possible. If a direct read is NOT possible (paywall, dead link, vendor docs behind login), note the source's existence but mark its claims as inferred or unverified.

### 6. Mark status honestly
Distinguish three categories in every artifact:
- **Verified** — read directly, URL/path provided
- **Inferred** — pieced together from multiple secondary sources, label inline
- **Unverified** — exists but you couldn't read it; do not describe contents

If you cannot complete an assigned task, mark it `blocked` or `superseded` with a one-line reason. **Never silently drop a task** — see Task Ledger Discipline below.

## Source Quality Tiering

When evaluating a source, place it in one of four tiers. Default to the highest tier available; reach for lower tiers only when the higher ones are exhausted.

| Tier | Examples | When to use |
|------|----------|-------------|
| **Prefer** | Software vendor official docs, academic papers in the field, patent records, primary engineering blog posts from the companies that build the product, government filings, GitHub repos (direct reads of code/README) | Always first choice. Required for FATAL claims (named vendor behavior, customer-facing assertions). |
| **Accept with caveats** | Well-cited secondary sources, established trade press, Q&A from named senior practitioners at known companies, tenured expert technical blogs | OK for context and triangulation. Label as secondary in the evidence table. |
| **Deprioritize** | SEO-optimized listicles ("top 10 tips"), undated how-to blogs, content aggregators, podcast transcripts without primary backing | Only if higher tiers are exhausted. Triangulate against a Prefer or Accept source before citing. |
| **Reject** | Sources with no author and no date, AI-generated content with no primary backing, unsourced Reddit/LinkedIn/Twitter claims, "industry rumor", marketing pages making bold claims about parsing accuracy without methodology | Do not cite. Period. |

When initial searches return mostly Deprioritize or Reject results, **re-search with a domain filter** targeting authoritative sites (`.edu`, `.gov`, vendor official domains, github.com for project-existence checks) before accepting low-quality sources.

## Task Ledger Discipline

When you're given multiple research questions, every assigned task must end in one of three explicit states:

| State | Meaning |
|-------|---------|
| `done` | Answered, with sources cited |
| `blocked` | Could not answer because [specific reason — paywall / no source exists / out of scope]. Includes a recommended next step. |
| `superseded` | Another finding made this question moot. Includes a one-line explanation of what replaced it. |

Silently merging two questions, dropping a question because it was hard, or returning "I focused on the others" without marking the dropped one is forbidden. The orchestrator dispatching you needs to know what was actually covered.

In your output, include a **Coverage Status** section listing every assigned question with its state.

## Provenance Sidecar Pattern

For substantial research outputs (anything that could become the basis for a prompt change, an architecture decision, or a memory file other agents will rely on), produce a small provenance record alongside it.

```markdown
## Provenance
- **Date:** YYYY-MM-DD
- **Sources consulted:** N (list paths/URLs)
- **Sources verified:** N (subset that survived URL check / direct read)
- **Sources rejected:** N (dead links, paywalled, contradicted)
- **Verification method:** [direct read / cross-source triangulation / memory recall + verification]
- **Known gaps:** what you could not confirm
```

## Per-Domain Strictness Tiers

Different research domains warrant different bars.

**Tier definitions:**
- **STRICT** — every claim cited, any unverified claim is FATAL and must be removed or downgraded before delivery. Used when output drives a prompt or automation that runs on every item (for example vendor research → a production prompt).
- **STANDARD** — commandments 1–6 enforced, secondary sources OK with explicit `secondary` label, single-source critical claims must be flagged in Coverage Status. Used for internal research that informs decisions but doesn't directly drive automation.
- **LIGHT** — rumor and oral-history acceptable IF explicitly labeled as such, single-source claims OK for non-critical context.

| Agent | Tier | Why |
|-------|------|-----|
| Vendor-behavior researcher (example) | **STRICT** | Output becomes a production prompt, applied to every item. Wrong claims propagate to every run. |
| `market-researcher` (example) | **STANDARD** for context, **STRICT** for any specific vendor behavior or customer-facing assertion | Named vendor behavior is fact-checked by anyone who has used the system. |

**Default for any new research-producing agent not listed:** STANDARD.

**Tier escalation:** If a STANDARD or LIGHT agent produces a finding that will be quoted in a production prompt or in user-facing copy, the orchestrator must re-run the relevant claims through a STRICT verification pass before the artifact ships.

## Severity Grading for Research Reviews

| Severity | Definition | Disposition |
|----------|------------|-------------|
| **FATAL** | A claim is fabricated, unsupported, contradicts a primary source, or rests on a dead/unverifiable URL. Any FATAL issue means the artifact cannot ship as-is. | Must fix before delivery. After fix, run at least one more verification pass — do not assume one fix solved everything. |
| **MAJOR** | A critical claim rests on only one source, confidence level overstates evidence quality, or a key question was silently dropped from the task ledger. | Must be noted in the artifact's "Open Questions" or "Coverage Status" section. Acceptable to ship with disclosure. |
| **MINOR** | Style issues, missing tier labels in evidence tables, secondary sources where primary would be available with more effort, formatting inconsistencies. | Accepted. Logged in the verification record but not fixed unless trivially easy. |

**Tier sensitivity:** A claim that would be MAJOR for a STANDARD-tier agent may be FATAL for a STRICT-tier agent.

**Verifier verdict format:**
- **PASS** — zero FATAL, zero MAJOR
- **PASS WITH NOTES** — zero FATAL, ≥1 MAJOR (disclosed in artifact)
- **FAIL** — ≥1 FATAL (artifact blocked until fixed)

After a FAIL → fix → re-verify cycle, if any FATAL was found in the original pass, run **at least one additional verification round** even if the fixes look complete.

## Agent Output Requirements

Every research artifact must include:
1. Evidence table with numbered sources and tier labels
2. Coverage Status section (every assigned question + state)
3. Provenance block (date, consulted/verified/rejected counts, gaps)
