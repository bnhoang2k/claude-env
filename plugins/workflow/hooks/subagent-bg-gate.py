#!/usr/bin/env python3
"""PreToolUse gate on Bash: no backgrounded test/build gates inside a subagent.

Origin: a subagent finished its code, started the test suite with run_in_background,
and waited for a completion notice that never arrived. It sat idle for hours. The
orchestrator sat idle too, because it ran one task at a time and nothing else was in
flight. Nobody noticed until the user came back.

In the MAIN thread, run_in_background is fine — the harness re-invokes Claude when
the command exits. Inside a subagent that notification path is what failed, so a
gate there must run in the foreground. That is the only case this hook denies.

Decision table (gate command + run_in_background only):
  subagent   -> deny  (foreground it)
  main loop  -> allow (harness re-invokes on exit)
  unknown    -> ask   (fail safe, never fail open)

Set CLAUDE_BG_GATE_DUMP=/path to append each payload for debugging.
"""

import json
import os
import re
import sys

# Test/build gates, matched only at a command position (start, or after ; && || | newline).
GATE = re.compile(
    r"(?:^|[;&|]\s*|\n\s*|\(\s*)(?:sudo\s+)?(?:"
    r"make\s+(?:-\S+\s+)*(?:test|check|ci|build|lint)\b"
    r"|npm\s+(?:run\s+)?(?:test|build|typecheck)\b"
    r"|(?:pnpm|yarn|bun)\s+(?:run\s+)?(?:test|build|typecheck)\b"
    r"|npx\s+(?:vitest|jest|tsc|playwright)\b"
    r"|(?:python3?\s+-m\s+)?pytest\b"
    r"|uv\s+run\s+(?:pytest|ruff)\b"
    r"|go\s+test\b"
    r"|cargo\s+(?:test|build|clippy)\b"
    r"|swift\s+test\b"
    r"|xcodebuild\b"
    r"|(?:gradle|gradlew|\./gradlew)\s+\S*test\b"
    r"|mvn\s+\S*test\b"
    r"|bundle\s+exec\s+rspec\b"
    r"|node\s+--test\b"
    r"|node_modules/\.bin/(?:tsc|vitest|jest)\b"
    r")",
    re.IGNORECASE,
)

FOREGROUND_FIX = (
    "Re-run it in the FOREGROUND — plain Bash, no run_in_background, with an "
    "explicit `timeout` (up to 600000 ms). If the suite genuinely needs more "
    "than 10 minutes, run a targeted suite here and report that the full gate "
    "must run from the orchestrator."
)


def respond(decision: str, reason: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision,
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def context_of(data: dict) -> str:
    """'subagent', 'main', or 'unknown' — from the transcript path Claude Code passes.

    Subagent transcripts live at <project>/<session-id>/subagents/agent-*.jsonl;
    the main session's transcript is <project>/<session-id>.jsonl.
    """
    path = data.get("transcript_path") or data.get("transcriptPath") or ""
    if not path:
        return "unknown"
    return "subagent" if "/subagents/" in path else "main"


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    dump = os.environ.get("CLAUDE_BG_GATE_DUMP")
    if dump:
        try:
            with open(dump, "a") as fh:
                fh.write(json.dumps(data) + "\n")
        except OSError:
            pass

    if data.get("tool_name") != "Bash":
        sys.exit(0)

    tool_input = data.get("tool_input") or {}
    if not tool_input.get("run_in_background"):
        sys.exit(0)

    command = tool_input.get("command") or ""
    hit = GATE.search(command)
    if not hit:
        sys.exit(0)

    gate = hit.group(0).strip(" ;&|(\n")
    where = context_of(data)

    if where == "subagent":
        respond("deny", (
            f"BACKGROUND GATE: `{gate}` was launched with run_in_background from "
            "inside a subagent. A subagent's background-completion notice is not "
            "reliable — one never arrived and the agent idled for hours. Never run a "
            f"gate in the background inside a subagent. {FOREGROUND_FIX}"
        ))

    if where == "unknown":
        respond("ask", (
            f"BACKGROUND GATE: `{gate}` with run_in_background, and this hook could "
            "not tell whether it is running in a subagent (no transcript path in the "
            "payload). Allow only if this is the main session, where the harness "
            f"re-invokes on exit. In a subagent: {FOREGROUND_FIX}"
        ))

    sys.exit(0)


if __name__ == "__main__":
    main()
