#!/usr/bin/env python3
"""PreToolUse speed bump on Edit/Write/MultiEdit: a subagent editing an EXISTING test.

Why: ImpossibleBench (Zhong, Raghunathan, Carlini) found that when Claude models
cheat on a coding task, they mostly (>79%) do it by modifying the tests. Making
tests read-only blocked that without hurting legitimate work. Anthropic's
prompting guide says the same: "It is unacceptable to remove or edit tests."

Why a speed bump and not a lock: plans legitimately change tests (stale test
fakes are one of the most common things plan review catches). The hook
cannot see the files your task names, so it cannot tell a planned edit from a
cheat. It denies the FIRST edit to each existing test file per subagent
transcript, with the reason below, and allows the retry. The agent has to read
the reason and decide on purpose.

Decision table (existing test file only; new test files always pass):
  subagent, first edit to this file  -> deny with reason
  subagent, later edits              -> allow
  main loop / unknown                -> allow (the user sees main-loop edits)
"""

import hashlib
import json
import os
import re
import sys

TEST_PATH = re.compile(
    r"(?:^|/)(?:tests?|__tests__|spec|specs|Tests|[A-Za-z0-9_]+Tests)/"
    r"|(?:^|/)test_[^/]+\.py$"
    r"|_test\.(?:py|go|rb|exs?)$"
    r"|\.(?:test|spec)\.[cm]?[jt]sx?$"
    r"|Tests?\.swift$"
    r"|_spec\.rb$"
)

STATE_DIR = os.path.expanduser("~/.claude/state/test-edit-gate")


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    if data.get("tool_name") not in ("Edit", "Write", "MultiEdit"):
        sys.exit(0)

    path = (data.get("tool_input") or {}).get("file_path") or ""
    if not path or not TEST_PATH.search(path) or not os.path.isfile(path):
        sys.exit(0)

    transcript = data.get("transcript_path") or data.get("transcriptPath") or ""
    if "/subagents/" not in transcript:
        sys.exit(0)

    key = hashlib.sha256(f"{transcript}\0{os.path.realpath(path)}".encode()).hexdigest()[:32]
    marker = os.path.join(STATE_DIR, key)
    if os.path.exists(marker):
        sys.exit(0)
    try:
        os.makedirs(STATE_DIR, exist_ok=True)
        with open(marker, "w") as fh:
            fh.write(path + "\n")
    except OSError:
        sys.exit(0)  # never block on a state-write failure

    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": (
                f"TEST EDIT: {os.path.basename(path)} is an existing test. Agents that "
                "cheat on a task mostly do it by editing tests. Edit it only if "
                "the files your task names include this test, or the spec changed what it must "
                "assert. If the test looks wrong, do not edit it: stop and report it. "
                "To proceed on purpose, retry the same edit (this gate stops only the "
                "first edit per file), and list every test you changed, with the "
                "reason, in your report."
            ),
        }
    }))
    sys.exit(0)


if __name__ == "__main__":
    main()
