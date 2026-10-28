#!/usr/bin/env python3
"""PreToolUse warning on Edit/Write/MultiEdit: an absolute home path entering a tracked file.

Why: when a projects folder moves, every tracked file that names a project by its
absolute home path has to be found and rewritten, and templates copy those paths into
each new repo. A path written relative to the repo root, or from an env var such as
$PROJECTS_ROOT, survives the next move with no edit.

Why a warning and not a deny: some files must record a real path (a ledger entry, a test
that plants one on purpose). The agent reads the warning and decides.

What counts:
  - the current user's literal home folder followed by a slash
  - a Documents folder under the home folder, written with a tilde or a HOME variable
Only text the edit ADDS counts: an Edit whose old_string already held the same path is quiet.
Only files inside a git work tree and not ignored count; scratch and memory files are skipped.
"""

import json
import os
import re
import subprocess
import sys

HOME = os.path.expanduser("~").rstrip("/")
PATTERNS = [
    re.compile(re.escape(HOME) + r"/"),
    re.compile(r"(?:~|\$HOME|\$\{HOME\})/Documents/"),
]


def hits(text: str) -> list:
    return [m.group(0) for p in PATTERNS for m in p.finditer(text or "")]


def added_matches(tool: str, inp: dict) -> list:
    """Matches in the new text that the old text did not already hold."""
    if tool == "Write":
        pairs = [("", inp.get("content"))]
    elif tool == "Edit":
        pairs = [(inp.get("old_string"), inp.get("new_string"))]
    else:
        pairs = [(e.get("old_string"), e.get("new_string")) for e in inp.get("edits") or []]
    added = []
    for old, new in pairs:
        before = hits(old)
        for h in hits(new):
            if h in before:
                before.remove(h)
            else:
                added.append(h)
    return added


def is_tracked_target(path: str) -> bool:
    """Inside a git work tree and not ignored. The file itself may not exist yet."""
    probe = os.path.dirname(os.path.abspath(path))
    while probe and not os.path.isdir(probe):
        probe = os.path.dirname(probe)
    try:
        inside = subprocess.run(["git", "-C", probe, "rev-parse", "--is-inside-work-tree"],
                                capture_output=True, text=True, timeout=5)
        if inside.returncode != 0 or inside.stdout.strip() != "true":
            return False
        ignored = subprocess.run(["git", "-C", probe, "check-ignore", "-q", os.path.abspath(path)],
                                 capture_output=True, timeout=5)
        return ignored.returncode != 0
    except (OSError, subprocess.SubprocessError):
        return False


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    tool = data.get("tool_name")
    if tool not in ("Edit", "Write", "MultiEdit"):
        sys.exit(0)
    inp = data.get("tool_input") or {}
    path = inp.get("file_path") or ""
    if not path:
        sys.exit(0)

    added = added_matches(tool, inp)
    if not added or not is_tracked_target(path):
        sys.exit(0)

    shown = ", ".join(f"`{h}`" for h in sorted(set(added))[:3])
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "additionalContext": (
                f"ABS PATH: this edit writes {shown} into {os.path.basename(path)}, a tracked "
                "file. A home path breaks when the projects folder moves. Write the path "
                "relative to the repo root, or from an env var such as `$PROJECTS_ROOT` if "
                "you keep one. Keep it only if the file must record a real path "
                "(a test that plants one, a ledger entry), and leave old ledger entries alone."
            ),
        }
    }))
    sys.exit(0)


if __name__ == "__main__":
    main()
