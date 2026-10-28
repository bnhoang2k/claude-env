#!/usr/bin/env python3
"""PreToolUse gate on Agent: enforce model-tiering on one-off subagent dispatches.

The workflow-tier-gate covers Workflow scripts; this covers the plain Agent tool,
where the tool's own description says "default to omitting model" and rule-recall
loses to that under context pressure (observed repeatedly: recon agents dispatched
with no pin, silently inheriting the session's most costly model).

Denies an Agent dispatch when:
  1. (only when WORKFLOW_GATE_FABLE is on) it pins a Fable-class model without a
     `FABLE-APPROVED:` line in the prompt (the user approves Fable subagents each time),
  2. it has no `model` pin at all — never inherit silently. Exception: the `fork`
     subagent type, whose model parameter is ignored by design (always inherits).

The deny message restates the stage-shape rule so the fix is one edit away.
"""

from __future__ import annotations

import json
import os
import sys
from collections.abc import Mapping


def switch_on(name: str, env: Mapping[str, str] = os.environ) -> bool:
    """True when env[name], stripped and lower-cased, is `1` or `true`."""
    return env.get(name, "").strip().lower() in ("1", "true")


def deny(reason: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def check(data: dict, env: Mapping[str, str] = os.environ) -> str | None:
    """Return a deny reason, or None to allow."""
    if data.get("tool_name") not in ("Agent", "Task"):
        return None
    tool_input = data.get("tool_input") or {}

    model = tool_input.get("model")
    prompt = tool_input.get("prompt") or ""

    if model == "fable":
        if switch_on("WORKFLOW_GATE_FABLE", env) and "FABLE-APPROVED:" not in prompt:
            return (
                "AGENT TIER GATE: Fable-class subagents need the user's OK first, "
                "every time. Add a line `FABLE-APPROVED: <the user's words>` to the "
                "agent prompt and retry. "
                "Otherwise re-tier: open-ended judgment -> opus, bounded checking -> "
                "sonnet, mechanical -> haiku."
            )
        return None

    if not model and tool_input.get("subagent_type") != "fork":
        return (
            "AGENT TIER GATE: no `model` pin on this dispatch — it would silently "
            "inherit the session model (often Fable). Pin one explicitly "
            "(never inherit silently). Stage-shape rule: "
            "open-ended judgment (design/review/synthesis) -> opus; bounded "
            "checking (recon, verify a named claim, classify) -> sonnet; "
            "mechanical (moves, formatting) -> haiku. Can't tell? Pin opus."
        )
    return None


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)
    reason = check(data)
    if reason:
        deny(reason)
    sys.exit(0)


if __name__ == "__main__":
    main()
