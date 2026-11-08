#!/usr/bin/env python3
"""Find hook-pasted text in a Claude Code transcript.

Usage: find_hook_text.py <transcript.jsonl> [--after-compact] [--needle TEXT]
Counts only hook attachment entries (type "attachment", attachment.type in
HOOK_TYPES), so a tool call that quotes the needle is not a match.
attachment.content is a string, or a list with one element per SessionStart
hook; each list element is checked on its own.
--after-compact searches after the last compact boundary entry (the boundary
comes before the context Claude Code puts back and before the summary).
Prints "<index> <content length> <first 120 chars>" per match, then "found N".
Exit 0 when N >= 1.
"""
import json
import sys

HOOK_TYPES = ("hook_additional_context",)  # SessionStart and PreToolUse text land here


def content_texts(att):
    """Each piece of hook text in one attachment: one for a string, one per list element."""
    c = att.get("content")
    if isinstance(c, str):
        return [c]
    if isinstance(c, list):
        return [x if isinstance(x, str) else json.dumps(x, ensure_ascii=False) for x in c]
    return [json.dumps(att, ensure_ascii=False)]


def main(argv):
    path = argv[1]
    after = "--after-compact" in argv
    needle = argv[argv.index("--needle") + 1] if "--needle" in argv else "UI TASTE"
    rows = []
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            try:
                rows.append(json.loads(line))
            except ValueError:
                rows.append({})
    start = 0
    if after:
        marks = [i for i, r in enumerate(rows)
                 if isinstance(r, dict) and r.get("type") == "system" and r.get("subtype") == "compact_boundary"]
        if not marks:
            print("found 0 (no compact in this transcript)")
            return 1
        start = marks[-1] + 1
    n = 0
    for i in range(start, len(rows)):
        r = rows[i]
        if not isinstance(r, dict) or r.get("type") != "attachment":
            continue
        att = r.get("attachment") or {}
        if att.get("type") not in HOOK_TYPES:
            continue
        for text in content_texts(att):
            if needle in text:
                n += 1
                at = text.index(needle)
                print(i, len(text), text[at:at + 120].replace("\n", " "))
    print(f"found {n}")
    return 0 if n else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
