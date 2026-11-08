#!/usr/bin/env python3
"""PreToolUse warning on Edit/Write/MultiEdit: the owner's name or email entering a shared file.

Why: a file that publish-public exports must not carry the owner's name or email. The publish
run has a blocking deny scan, but it runs late. This hook is the early layer: it warns while the
text is being written, when the fix is one edit and not a hunt through a release.

Why a warning and not a deny: a file may name the owner on purpose (a license, a credit line). The
agent reads the warning and decides. The publish-time scan is the layer that blocks.

A warning needs all three of these:
  - the file sits in a git repo whose HEAD holds a publish.json, and publish-public would export
    the file (shareable.mjs answers "yes": allow matches, no keep rule, not a never-export file)
  - the edit ADDS a match of the rule "personal name" or "personal email" (only text the edit adds
    counts: an Edit whose old_string already held the same match is quiet)
  - those rules exist in <config folder>/deny/base.json, where the config folder is
    $PUBLISH_PUBLIC_HOME or ~/.claude/publish-public
With no config folder, no base.json, no publish.json, no node, or any error, the hook stays silent.
It never blocks and always exits 0. The warning names the file, the line and the rule. For an Edit or
MultiEdit entry the line is where old_string starts in the file (the file is unchanged when the hook
runs) plus the match's offset inside new_string; for a Write it is the line in the new content.

The hook reads publish.json at HEAD, as the export does, so an uncommitted edit of publish.json does
not change the answer until it is committed.
"""

import json
import os
import re
import subprocess
import sys

RULE_NAMES = ("personal name", "personal email")


def config_dir() -> str:
    return os.environ.get("PUBLISH_PUBLIC_HOME") or os.path.join(os.path.expanduser("~"), ".claude", "publish-public")


def load_rules() -> list:
    """[(rule name, compiled regex)] for the two personal rules in base.json. Empty when absent or unreadable."""
    try:
        with open(os.path.join(config_dir(), "deny", "base.json"), encoding="utf-8") as f:
            entries = json.load(f)
    except (OSError, ValueError):
        return []
    rules = []
    for e in entries if isinstance(entries, list) else []:
        if not isinstance(e, dict) or e.get("name") not in RULE_NAMES:
            continue
        flags = re.IGNORECASE if "i" in (e.get("flags") or "") else 0
        try:
            rules.append((e["name"], re.compile(e["pattern"], flags)))
        except (re.error, KeyError, TypeError):
            continue
    return rules


def hits(text: str, rules: list) -> list:
    """[(line number, rule name, matched text)] for every match in text."""
    out = []
    for n, line in enumerate((text or "").split("\n"), start=1):
        for name, rx in rules:
            out.extend((n, name, m.group(0)) for m in rx.finditer(line))
    return out


def added_matches(old: str, new: str, rules: list) -> list:
    """Matches in new that old did not already hold, as (line in new, rule name). Counts matches, so a second copy is added."""
    before = [(name, text) for _, name, text in hits(old, rules)]
    added = []
    for line, name, text in hits(new, rules):
        if (name, text) in before:
            before.remove((name, text))
        else:
            added.append((line, name))
    return added


def edit_pairs(tool: str, inp: dict, path: str) -> list:
    """[(old text, new text)] the tool call would change."""
    if tool == "Write":
        try:
            with open(path, encoding="utf-8") as f:
                current = f.read()
        except (OSError, ValueError):
            current = ""
        return [(current, inp.get("content") or "")]
    if tool == "Edit":
        return [(inp.get("old_string") or "", inp.get("new_string") or "")]
    return [(e.get("old_string") or "", e.get("new_string") or "") for e in inp.get("edits") or []]


def line_in_file(path: str, old: str, line_in_new: int) -> int:
    """Line of a match in the file. A PreToolUse hook runs before the edit, so the file still holds
    old_string: the answer is the line where old_string starts plus the match's line offset inside
    new_string. When old_string is empty or not found, it is the line inside new_string.
    For MultiEdit this runs per entry against the file as it stands before any edit, so a later
    entry may be off by the lines that earlier entries add or remove."""
    try:
        with open(path, encoding="utf-8") as f:
            content = f.read()
    except (OSError, ValueError):
        return line_in_new
    at = content.find(old) if old else -1
    return line_in_new if at < 0 else content.count("\n", 0, at) + line_in_new


def repo_and_rel(path: str):
    """(repo root, path relative to it) for a file inside a git work tree that is not ignored. None otherwise."""
    absolute = os.path.abspath(path)
    probe = os.path.dirname(absolute)
    while probe and not os.path.isdir(probe):
        probe = os.path.dirname(probe)
    try:
        top = subprocess.run(["git", "-C", probe, "rev-parse", "--show-toplevel"],
                             capture_output=True, text=True, timeout=5)
        if top.returncode != 0:
            return None
        ignored = subprocess.run(["git", "-C", probe, "check-ignore", "-q", absolute],
                                 capture_output=True, timeout=5)
        if ignored.returncode == 0:
            return None
    except (OSError, subprocess.SubprocessError):
        return None
    root = os.path.realpath(top.stdout.strip())
    real = os.path.join(os.path.realpath(probe), os.path.relpath(absolute, probe))
    rel = os.path.relpath(real, root)
    return None if rel.startswith("..") else (root, rel.replace(os.sep, "/"))


def plugin_root() -> str:
    return os.environ.get("CLAUDE_PLUGIN_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def is_shareable(root: str, rel: str) -> bool:
    script = os.path.join(plugin_root(), "skills", "publish-public", "scripts", "shareable.mjs")
    try:
        r = subprocess.run(["node", script, root, rel], capture_output=True, text=True, timeout=5)
    except (OSError, subprocess.SubprocessError):
        return False
    return r.returncode == 0 and r.stdout.strip() == "yes"


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)
    tool = data.get("tool_name") if isinstance(data, dict) else None
    if tool not in ("Edit", "Write", "MultiEdit"):
        sys.exit(0)
    inp = data.get("tool_input") or {}
    path = inp.get("file_path") or ""
    if not path:
        sys.exit(0)

    rules = load_rules()
    if not rules:
        sys.exit(0)
    found = []  # (line in the file, rule name)
    for old, new in edit_pairs(tool, inp, path):
        for line, name in added_matches(old, new, rules):
            found.append((line if tool == "Write" else line_in_file(path, old, line), name))
    if not found:
        sys.exit(0)

    where = repo_and_rel(path)
    if where is None or not is_shareable(*where):
        sys.exit(0)

    shown = "; ".join(f"line {line}, rule \"{name}\"" for line, name in found[:3])
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "additionalContext": (
                f"NAME LINT: this edit adds the owner's name or email to {where[1]} ({shown}). "
                "publish-public would export this file, and its publish-time scan blocks on "
                "these names. Use a generic phrase such as \"the user\" instead. Keep the name "
                "only if the file must carry it on purpose (a license or credit line)."
            ),
        }
    }))
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:  # a warning hook never breaks an edit
        sys.exit(0)
