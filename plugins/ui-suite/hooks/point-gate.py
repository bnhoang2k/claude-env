#!/usr/bin/env python3
"""Stop and PreToolUse (matcher: AskUserQuestion) hook: point at the page instead of describing it.

Why it exists: a reply that describes parts of a page in words makes the reader map those words
onto the screen. Lettered rings on the page let the reply say "A" and "B", and let the reader
answer with a letter.

While a page is open in a browser (the built-in pane, Playwright or Chrome) and in use (a
browser tool ran in this turn or the two before it, and the last one did not close a tab), a reply or a
question that names two or more parts of a screen (button, card, sidebar, "top left", ...) is
held when nothing was ringed with scripts/point.js during that turn. It is held once: at Stop,
stop_hook_active lets the second try through; a question goes through when the turn already
holds an earlier question. So a reply that is not about the page costs one re-send.

Rings that crowd are held the same way: a box ringed with the boxes inside it hides one tag
behind another, and a ring off screen or inside a scroll box points at nothing. point.js ends
its line with "| Problems: ..." for those; when the turn's last ring call returned one, the reply
or question is held until the rings are fixed and mark() runs clean.

Words inside code (backticks or fenced blocks) do not count. The user can write "skip point"
in a message to bypass. Any error lets the reply or question through.
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
# Any browser tool shows a page is still in use; closing tools end it.
PAGE_USE = re.compile(r"(Claude_Browser__\w+|playwright\w*__browser_\w+|claude-in-chrome__\w+)$")
PAGE_CLOSE = re.compile(r"(Claude_Browser__(tabs_close|preview_stop)|__browser_close|claude-in-chrome__tabs_close_mcp)$")
# A page counts only while a browser tool ran in this turn or the two before it. A page left
# behind turns ago is not beside the chat any more, and holding a reply for it makes Claude send
# the same reply twice.
RECENT_TURNS = 3
# Tools that can run point.js on a page, and the marks that show they did: the pasted file
# returns pointV1 or later, a later ring is a __point.mark() call, and a review list is a
# __point.review() call. Reading answers (__point.answers()) points at nothing.
RUNNERS = re.compile(r"(javascript_tool|browser_evaluate|browser_run_code\w*)$|^Bash$")
POINT_MARK = re.compile(r"pointV\d|pointReviewV\d|point\.js|__point\.(mark|review)\(")
# The problem list at the end of point.js's line. Problems never hold a double quote.
PROBLEMS = re.compile(r"\| Problems: ([^\"\n]*)")
SKIP = "skip point"
NEED = 2  # distinct screen parts a text must name before it is held

# Parts of a screen, and places on it. Each pattern counts once however often it appears.
PARTS = [
    r"buttons?", r"cards?", r"headers?", r"footers?", r"side ?bars?", r"nav ?bars?", r"tabs?",
    r"rows?", r"columns?", r"badges?", r"chips?", r"pills?", r"icons?", r"panels?", r"modals?",
    r"dialogs?", r"menus?", r"drop-?downs?", r"fields?", r"inputs?", r"labels?", r"banners?",
    r"toolbars?", r"tooltips?", r"avatars?", r"headings?", r"titles?", r"subtitles?", r"captions?",
    r"toggles?", r"checkbox(es)?", r"sliders?", r"dividers?", r"drawers?", r"hero", r"tiles?",
    r"thumbnails?", r"spinners?", r"placeholders?", r"popovers?", r"breadcrumbs?", r"pagination",
    r"steppers?", r"progress bars?", r"search bars?", r"text ?box(es)?", r"list items?", r"rails?",
    r"gutters?", r"top[- ](left|right)", r"bottom[- ](left|right)", r"(top|bottom) of the",
    r"(left|right)[- ]hand side", r"(left|right) side", r"(above|below|under|beneath|next to) the",
    r"to the (left|right)",
]
PART_RE = [re.compile(r"\b" + p + r"\b", re.I) for p in PARTS]
CODE = re.compile(r"```.*?```|`[^`\n]*`", re.S)


def is_point_run(name, inp):
    return bool(RUNNERS.search(name)) and bool(POINT_MARK.search(json.dumps(inp)))


def ring_problems(turn, run):
    """The problems point.js reported for this ring call, or '' when clean or not yet answered."""
    res = lint.results_by_id(turn).get(run.get("id"))
    match = PROBLEMS.search(res[0]) if res else None
    return match.group(1).strip() if match else ""


def named_parts(text):
    """The screen-part patterns the text names, outside code."""
    prose = CODE.sub(" ", text or "")
    return [p for p, rx in zip(PARTS, PART_RE) if rx.search(prose)]


def page_opened(entries):
    """True while a page is beside the chat: the latest browser event in the last RECENT_TURNS
    user turns opens or uses a page. A close, a file:// page (point.js cannot run there), or no
    browser event in that window means no page."""
    turns = 1
    for e in reversed(entries):
        if lint.is_real_user(e):
            turns += 1
            if turns > RECENT_TURNS:
                return False
            continue
        for u in reversed(lint.tool_uses(e)):
            name = str(u.get("name", ""))
            if PAGE_CLOSE.search(name):
                return False
            if PAGE_OPEN.search(name) and str((u.get("input") or {}).get("url", "")).startswith("file:"):
                return False
            if PAGE_OPEN.search(name) or PAGE_USE.search(name):
                return True
    return False


def question_text(inp):
    parts = []
    for q in (inp or {}).get("questions") or []:
        parts += [str(q.get("question", "")), str(q.get("header", ""))]
        for o in q.get("options") or []:
            parts += [str(o.get("label", "")), str(o.get("description", ""))]
    return "\n".join(parts)


def reply_text(entries):
    """Everything Claude wrote as text in these entries."""
    out = []
    for e in entries:
        if e.get("type") != "assistant":
            continue
        content = (e.get("message") or {}).get("content")
        if isinstance(content, str):
            out.append(content)
        elif isinstance(content, list):
            out += [b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"]
    return "\n".join(out)


def decide(page_open, turn, text, *, asking=False, tool_use_id="", user_text="", stop_hook_active=False):
    """The hold reason, or None to let it through.

    page_open: a page is beside the chat now (see page_opened). turn: the entries since the user's
    last message. text: the reply, or the question with its options.
    """
    if stop_hook_active or not page_open or SKIP in user_text.lower():
        return None
    uses = [u for e in turn for u in lint.tool_uses(e)]
    if asking and any(u.get("name") == ASK and u.get("id") != tool_use_id for u in uses):
        return None  # this turn already held a question: the re-send goes through
    what = "question" if asking else "reply"
    runs = [u for u in uses if is_point_run(str(u.get("name", "")), u.get("input") or {})]
    if runs:
        problems = ring_problems(turn, runs[-1])
        if not problems:
            return None
        return (f"Not sent yet: the last rings this turn have problems: {problems}. Fix them, run "
                "__point.mark() again until its line ends in \"| Clean\", then send this "
                f"{what}. Ring the inner parts, not a box and the parts inside it. Give a "
                "selector that matches one part, or pass all: true when one letter means every "
                "match. Ring a row of tight neighbors (icons, a facts line) as one part. Scroll "
                "a part into view, or open what hides it, before ringing it.")
    named = named_parts(text)
    if len(named) < NEED:
        return None
    return (f"Not sent yet: a page is open beside the chat, and this {what} describes parts of it "
            f"in words ({', '.join(named[:4])}) with nothing ringed this turn. Point instead: ring "
            f"the parts with lettered red tags, then call them by letter (A, B, C). If {SCRIPT} "
            "is not loaded on this page yet, paste the whole file into the browser's javascript "
            "tool (Playwright: browser_evaluate as `async () => <file>`); after that one call "
            "rings them: `await __point.mark({A: 'visible text', B: {selector: '.css'}})`. Check "
            "the line it returns ends in \"| Clean\". For three or more parts (a sign-off, a list "
            "of fixes), use `await __point.review([{note: 'what changed', selector: '.css'}])` "
            "instead: the person answers each part on the page, and the next turn reads "
            "`__point.answers().line`. On a phone, send a screenshot with the rings "
            "using SendUserFile. If this is not about the page, send it again unchanged.")


def main():
    try:
        data = json.load(sys.stdin)
        event = data.get("hook_event_name") or ("PreToolUse" if data.get("tool_name") else "Stop")
        asking = event == "PreToolUse"
        if asking and data.get("tool_name") != ASK:
            sys.exit(0)
        path = os.path.expanduser(data["transcript_path"])
        turn = lint.tail_entries(path)
        user_text = lint.user_text(turn[0]) if turn and lint.is_real_user(turn[0]) else ""
        with open(path, encoding="utf-8", errors="replace") as fh:  # tool calls and turn starts
            entries = [e for e in (lint._parse(line) for line in fh
                                   if '"tool_use"' in line or ('"user"' in line and '"tool_result"' not in line))
                       if e is not None]
        if asking:
            text = question_text(data.get("tool_input"))
        else:  # the final message may reach the hook before the transcript holds it
            text = reply_text(turn) + "\n" + str(data.get("last_assistant_message") or "")
        reason = decide(page_opened(entries), turn, text, asking=asking,
                        tool_use_id=str(data.get("tool_use_id") or ""), user_text=user_text,
                        stop_hook_active=bool(data.get("stop_hook_active")))
    except Exception:  # never break asking or stopping
        sys.exit(0)
    if reason and asking:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }}))
    elif reason:
        print(json.dumps({"decision": "block", "reason": reason}))
    sys.exit(0)


if __name__ == "__main__":
    main()
