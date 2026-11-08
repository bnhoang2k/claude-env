#!/usr/bin/env python3
"""PreToolUse gate on Workflow: enforce model-tiering discipline.

Denies a Workflow launch when the script:
  1. pins a Fable-class model anywhere (only when WORKFLOW_GATE_FABLE is on; requires
     asking the user first, every time),
  2. has agent() calls without a model pin for each (never inherit silently; always on),
  3. lacks a `// TIERS:` comment block stating stage -> model (reasoning|mechanical: why;
     only when WORKFLOW_GATE_TIERS is on).

The TIERS block is the point: it forces the tiering tell ("could a wrong answer be
caught by glancing at the output, without re-reading the code?") to be applied per
stage, in writing, at authoring time. Reasoning stages (find, verify/refute, review,
plan, synthesize) are opus however numerous; only shape-checkable mechanical stages
tier down (a weak refuter's mistakes are silent, so verify stages are never mechanical).

Named workflows / unreadable scripts pass through — this gate judges inline scripts.
"""

from __future__ import annotations

import json
import os
import re
import sys
from collections.abc import Mapping
from pathlib import Path


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


def check(data: dict, env: Mapping[str, str] = os.environ) -> tuple[str, str] | None:
    """Return ("deny", reason), ("allow", note), or None to allow quietly."""
    tool_input = data.get("tool_input") or {}
    script = tool_input.get("script")
    if not script and tool_input.get("scriptPath"):
        try:
            script = Path(tool_input["scriptPath"]).read_text()
        except OSError:
            script = None
    if not script:
        return None

    if switch_on("WORKFLOW_GATE_FABLE", env) and re.search(
        r"model\s*:\s*['\"](?:fable|claude-fable-[\w.-]+)['\"]", script
    ):
        return ("deny",
            "TIER GATE: script pins a Fable-class subagent. Fable agents in any "
            "fan-out need the user's OK first, every time. "
            "Ask via AskUserQuestion or re-tier to opus/sonnet/haiku."
        )

    agent_calls = len(re.findall(r"\bagent\s*\(", script))
    model_pins = len(re.findall(r"\bmodel\s*:\s*['\"](?:fable|haiku|sonnet|opus|claude-(?:fable|opus|sonnet|haiku)-[\w.-]+)['\"]", script))
    if agent_calls > model_pins:
        return ("deny",
            f"TIER GATE: {agent_calls} agent() call(s) but only {model_pins} model "
            "pin(s). Every agent() call needs an explicit model — never inherit "
            "silently (always pin a model on every agent() call). "
            "Pin each from the stage-shape rule: reasoning (find, verify, review, "
            "plan, synthesize) -> opus; shape-checkable mechanical work -> sonnet/haiku."
        )

    if switch_on("WORKFLOW_GATE_TIERS", env) and not re.search(r"//\s*TIERS:", script):
        return ("deny",
            "TIER GATE: script is missing its `// TIERS:` block. Before launching, "
            "add a comment block applying the tiering tell to EVERY stage:\n"
            "// TIERS:\n"
            "//   <stage> -> opus (reasoning: <what it must decide>)\n"
            "//   <stage> -> sonnet|haiku (mechanical: <how a wrong answer shows on its face>)\n"
            "Verify/refute stages are reasoning, not mechanical: a weak refuter's "
            "mistake is silent. Then restate this table in the launch message to the user."
        )

    opus_pins = len(re.findall(r"model\s*:\s*['\"]opus['\"]", script))
    if model_pins >= 4 and opus_pins * 2 > model_pins:
        return ("allow",
            f"TIER GATE note: {opus_pins}/{model_pins} pins are opus. "
            "Fine when those stages reason (find, verify, review, plan, "
            "synthesize). Only re-check a mechanical stage pinned opus."
        )
    return None


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)
    result = check(data)
    if result and result[0] == "deny":
        deny(result[1])
    if result:
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "allow",
                "additionalContext": result[1],
            }
        }))
    sys.exit(0)


if __name__ == "__main__":
    main()
