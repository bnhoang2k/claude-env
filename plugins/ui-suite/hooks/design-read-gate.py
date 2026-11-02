#!/usr/bin/env python3
"""PreToolUse hook (matcher: Edit|Write|MultiEdit): read the repo's DESIGN.md before editing UI.

Why it exists: ui-taste-inject points at DESIGN.md ("Read <path>"), and a pointer can be
skipped. On 2026-11-02 a session built a hand-joined split button that DESIGN.md's
Components section and its Don'ts both ban, without having opened the file. This hook
turns the pointer into a gate.

When a web UI file is edited (ui-taste-inject's UI_EXT), it walks up from that file to
the nearest DESIGN.md (root first found, then docs/DESIGN.md beside it). If there is one,
a whole-file Read of it must appear in the transcript since the last compact; a Read
with offset or limit counts only when it covers the whole file. A worktree's DESIGN.md
and the main checkout's count as the same file. Otherwise the edit is denied with a one-
line instruction, so the cost is one Read.

A subagent is checked against its own transcript when the input carries one; otherwise
it is allowed. The user can write "skip design read" in a message to bypass. Any error
allows the edit.
"""
import json
import os
import re
import sys

sys.dont_write_bytecode = True  # a .pyc in hooks/ would embed the home path

EDIT_TOOLS = {"Edit", "Write", "MultiEdit"}
UI_EXT = re.compile(r"\.(html?|css|scss|jsx|tsx|vue|svelte|astro)$", re.I)
WORKTREE = re.compile(r"/\.claude/worktrees/[^/]+")
SKIP = "skip design read"
CHUNK = 1 << 20


def design_for(path):
    """The nearest DESIGN.md (or docs/DESIGN.md) at or above the file's folder, or ''."""
    d = os.path.dirname(os.path.abspath(path))
    while True:
        for cand in (os.path.join(d, "DESIGN.md"), os.path.join(d, "docs", "DESIGN.md")):
            if os.path.isfile(cand):
                return cand
        if os.path.isdir(os.path.join(d, ".git")) or os.path.isfile(os.path.join(d, ".git")):
            return ""
        parent = os.path.dirname(d)
        if parent == d:
            return ""
        d = parent


def same_file(a, b):
    """True when two paths name one DESIGN.md, a worktree copy counting as its main checkout's."""
    norm = lambda p: WORKTREE.sub("", os.path.normpath(p))
    return norm(a) == norm(b)


def line_count(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            return sum(1 for _ in f)
    except OSError:
        return 0


def whole_read(inp, total):
    offset, limit = inp.get("offset"), inp.get("limit")
    if offset not in (None, 0, 1):
        return False
    return limit is None or (total and int(limit) >= total)


def is_boundary(entry):
    return (entry.get("type") == "system" and entry.get("subtype") == "compact_boundary") \
        or bool(entry.get("isCompactSummary"))


def is_real_user(entry):
    if entry.get("type") != "user" or entry.get("isMeta") or entry.get("isCompactSummary"):
        return False
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return True
    return isinstance(content, list) and not any(
        isinstance(b, dict) and b.get("type") == "tool_result" for b in content)


def user_text(entry):
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return content
    return " ".join(b.get("text", "") for b in content or [] if isinstance(b, dict))


def tool_uses(entry):
    if entry.get("type") != "assistant":
        return []
    content = (entry.get("message") or {}).get("content")
    return [b for b in content if isinstance(b, dict) and b.get("type") == "tool_use"] \
        if isinstance(content, list) else []


def since_compact(path):
    """Transcript entries after the last compact boundary, oldest first."""
    entries = []
    with open(path, "rb") as f:
        f.seek(0, os.SEEK_END)
        pos, buf = f.tell(), b""
        while pos > 0:
            step = min(CHUNK, pos)
            pos -= step
            f.seek(pos)
            buf = f.read(step) + buf
            lines = buf.split(b"\n")
            buf = lines[0]
            for raw in reversed(lines[1:]):
                entry = _parse(raw)
                if entry is None:
                    continue
                if is_boundary(entry):
                    return list(reversed(entries))
                entries.append(entry)
        entry = _parse(buf)
        if entry is not None and not is_boundary(entry):
            entries.append(entry)
    return list(reversed(entries))


def _parse(raw):
    try:
        entry = json.loads(raw.decode("utf-8", "replace"))
    except ValueError:
        return None
    return entry if isinstance(entry, dict) else None


def decide(entries, file_path):
    """The deny reason, or '' to allow."""
    if not UI_EXT.search(file_path):
        return ""
    design = design_for(file_path)
    if not design:
        return ""
    users = [e for e in entries if is_real_user(e)]
    if users and SKIP in user_text(users[-1]).lower():
        return ""
    total = line_count(design)
    for entry in entries:
        for use in tool_uses(entry):
            inp = use.get("input") or {}
            if use.get("name") == "Read" and same_file(str(inp.get("file_path", "")), design) \
                    and whole_read(inp, total):
                return ""
    return (f"Read {design} in full first (its Components and Don'ts sections), then name the "
            f"existing component this edit reuses. Then retry the edit.")


def main():
    try:
        data = json.load(sys.stdin)
        if data.get("tool_name") not in EDIT_TOOLS:
            sys.exit(0)
        transcript = data.get("transcript_path")
        if data.get("agent_id"):
            transcript = data.get("agent_transcript_path")
            if not transcript:
                sys.exit(0)
        file_path = str((data.get("tool_input") or {}).get("file_path", ""))
        reason = decide(since_compact(transcript), file_path)
    except Exception:  # never break editing
        sys.exit(0)
    if reason:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }}))
    sys.exit(0)


if __name__ == "__main__":
    main()
