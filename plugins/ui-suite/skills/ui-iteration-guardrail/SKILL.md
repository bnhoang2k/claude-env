---
name: ui-iteration-guardrail
description: Use when iterating on UI, interaction, or visual behavior — animations, camera choreography, editors, drag/hover interactions, layout tuning — in any project (web, Swift, HTML mockups). Establishes the protected-behaviors list written before the first fix attempt and verified after each one, so a fix can't trade one bug for another. Inject into subagents doing UI iteration work.
---

# UI Regression Guardrail

When iterating on UI, interaction, or visual behavior — animations, camera choreography,
editors, drag/hover interactions, layout tuning — each fix attempt must protect what
already works. Applies to any project (web, Swift, HTML mockups) and to subagents doing
this kind of work (inject this rule into their prompts).

## The protocol

1. **Before the first fix attempt, write a protected-behaviors list.** 3–7 concrete,
   observable behaviors that currently work and must not change. Name them as checks,
   not vibes: "diving into a notebook still enters the interior," "chevron appears on
   hover within one frame," "reduced-motion path still skips the animation." Show the
   list to the user (or state it in-session) before touching code.
2. **Make the smallest change that could fix the target issue.** No opportunistic
   refactors or "while I'm here" cleanups inside an iteration round — overcorrection is
   the known failure mode.
3. **After each attempt, verify every protected behavior** before declaring the round
   done or moving to the next: Playwright DOM probes for web UI, a manual smoke walk for
   native/visual feel. "The target bug is fixed" is not done; "the target bug is fixed
   AND all protected behaviors pass" is done.
4. **If a protected behavior breaks, revert that attempt first, then rethink.** Never
   stack a second fix on top of a live regression — that's how one bug becomes two.

## Scope check before invoking

This is for iteration rounds on behavior that already works. A small, reversible fix with
a directly observable outcome does not need a protected-behaviors preamble — make the
change and look at it. Sizing the ceremony to the ask matters more than running the
protocol universally.

## Why

Typical failure: in a long UI iteration, each fix introduces a new regression, and a late round
can break a core interaction entirely. A fix for one visual detail overcorrects, or an unrelated
change introduces a race. In every case the fix trades one bug for another because nothing named
what had to stay working. DOM probing in a real browser (for example with Playwright) during the
iteration catches the breakage before shipping, so the verification step is the load-bearing
part, not ceremony.

## Relation to other rules

Pairs with a two-failed-fixes escalation rule (the project's own rules may state it; if not,
use this one): if two guarded attempts fail on the *target* bug, stop iterating and write the
diagnosis down as a plan.
The guardrail keeps rounds from regressing; the escalation rule caps how many rounds
happen at all.
