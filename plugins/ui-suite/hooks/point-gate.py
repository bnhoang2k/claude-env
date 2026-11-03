#!/usr/bin/env python3
"""PreToolUse hook (matcher: AskUserQuestion): point at the page before asking about it.

Why it exists: on 2026-11-02 a question described two parts of a page in words ("word tags per
question" vs "colored lines per topic"), and the user asked to be pointed at them instead.
Rings with letters, then "A or B?", got a three-word answer. A rule alone can be forgotten,
and a reminder that does not hold the question arrives after the question is already showing.

Holds the first question after a page opens in a browser (the built-in pane, Playwright or
Chrome), unless scripts/point.js has run on that page since. Held once per page: any
question asked after it on the same page goes through, so a question that is not about a
place on the page costs one re-send. The current call is told apart by its tool_use_id, in
case the transcript already holds it.

The user can write "skip point" in a message to bypass. Any error allows the question.
"""
import importlib.util
import json
import os
import re
import sys

sys.dont_write_bytecode = True  # a .pyc in hooks/ would embed the home path


def _load_lint_gate():
    here = os.path.dirname(os.path.abspath(__file__))
    for name in ("lint-ui-gate.py", "executable_lint-ui-gate.py"):  # installed name, then the prefixed copy name
        path = os.path.join(here, name)
        if os.path.isfile(path):
            spec = importlib.util.spec_from_file_location("lint_ui_gate", path)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            return mod
    raise FileNotFoundError("lint-ui-gate.py not found beside point-gate.py")


lint = _load_lint_gate()

PLUGIN_ROOT = os.environ.get("CLAUDE_PLUGIN_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(PLUGIN_ROOT, "scripts", "point.js")
ASK = "AskUserQuestion"
# Tools that load a page: the built-in pane (also through remote-devices), Playwright, Chrome.
PAGE_OPEN = re.compile(r"(Claude_Browser__(preview_start|navigate)|__browser_navigate|claude-in-chrome__navigate)$")
# Tools that can run point.js on a page, and the marks that show they did.
RUNNERS = re.compile(r"(javascript_tool|browser_evaluate|browser_run_code\w*)$|^Bash$")
POINT_MARK = re.compile(r"pointV1|point\.js")
SKIP = "skip point"


def is_point_run(name, inp):
    return bool(RUNNERS.search(name)) and bool(POINT_MARK.search(json.dumps(inp)))


def decide(entries, tool_use_id="", user_text=""):
    """The hold reason, or None to let the question through."""
    if SKIP in user_text.lower():
        return None
    since_page = None  # tool calls after the last page load; None means no page was ever opened
    for entry in entries:
        for use in lint.tool_uses(entry):
            name, inp = str(use.get("name", "")), use.get("input") or {}
            if PAGE_OPEN.search(name):
                since_page = []
            elif since_page is not None and not (tool_use_id and use.get("id") == tool_use_id):
                since_page.append((name, inp))
    if since_page is None:
        return None
    if any(name == ASK or is_point_run(name, inp) for name, inp in since_page):
        return None
    return ("Not sent yet: a page is open in the browser and nothing on it has been pointed at. "
            "If this question is about where something is on a screen, or names parts of the "
            f"page, ring them first: edit MARKS in {SCRIPT}, paste the whole file into the "
            "browser's javascript tool (Playwright: browser_evaluate as `async () => <file>`), and "
            "check the line it returns has no \"no match\". Then ask again with options labelled "
            "by the same letters (A, B, C) instead of describing the parts. On a phone, take a "
            "screenshot with the rings and send it with SendUserFile before asking. If the "
            "question is not about the page, send it again unchanged. This hold happens once "
            "per page. The same steps apply to a question asked in plain text.")


def main():
    try:
        data = json.load(sys.stdin)
        if data.get("tool_name") != ASK:
            sys.exit(0)
        path = os.path.expanduser(data["transcript_path"])
        tail = lint.tail_entries(path)
        user_text = lint.user_text(tail[0]) if tail and lint.is_real_user(tail[0]) else ""
        entries = []
        with open(path, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                if '"tool_use"' in line:
                    entry = lint._parse(line)
                    if entry is not None:
                        entries.append(entry)
        reason = decide(entries, str(data.get("tool_use_id") or ""), user_text)
    except Exception:  # never break asking
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
