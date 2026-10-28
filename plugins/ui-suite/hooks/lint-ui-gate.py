#!/usr/bin/env python3
"""Stop hook: block turn end once when web UI changed and no passing lint covers it.

A UI change is an Edit/Write/MultiEdit on a web UI file, or a Bash command that
writes one (a > or >> redirect into it, or tee/cp/mv/install/rsync/sed -i/perl -i
naming it). The check clears only when, after the last change, both of these held:
1. a Bash lintapple run whose result is not an error and contains a line starting
   "Passed: 0 UI findings";
2. the text-edge check passed: a Bash run of text-edge-auto.mjs printing a line
   "Text edges: 0 near-misses", or the same script (text-edge-auto.js) run in the
   browser pane and returning that line. Or the changed code carries at least one
   data-ui-align mark, because then lintapple's own alignment rule ran.
lintapple's alignment checks run only on marked elements, so an unmarked "Passed" proves
nothing about text edges. When every change this turn was
an .html file, each run's URL or path must name one of those files (a URL ending in "/"
means index.html). A ui-suite:lint-ui Skill call alone does not clear it: loading the instructions
is not a pass.

Known gaps: a file written by a program the shell runs (python3 gen.py) names no
web file in the command, so it is not seen. A web file named only to be read in a
command that also contains a writer word (for example "cp a.txt b.txt; cat
page.html") counts as a change; this is accepted. Heredoc bodies are not scanned:
a commit message that names a page is text, not a write. Writes into a temp folder are
test fixtures, not UI: an absolute path under /tmp, /private/tmp, /var/folders or $TMPDIR, or a
relative or $VAR path in a command that made its own folder with mktemp. A relative path is also
resolved against the working folder of its own tool call (the "cwd" on each transcript entry, not
the Stop payload's, which is only where the shell stands at Stop time), moved by the cd, pushd and
popd earlier in the same command: absolute and relative targets, quoted targets, "cd -", and
subshells "( ... )" whose cd does not move the outer shell. A path named twice in a command counts
as temp only when every mention resolves into a temp folder. When the scan is unsure, the write
gates. Gaps: a cd through a variable (cd $DIR) is not followed (it gates unless the command ran
mktemp); a cd inside quoted text ("echo 'then cd /tmp/w' > page.html") still counts; a command
that runs mktemp and also writes a real page by a relative path is not seen; cd inside a
shell function, loop body or case branch is read as plain sequence.

Never blocks when stop_hook_active is set (loop guard) or when the user's last
message says "skip lint". Any error exits 0 silently.
"""
import json
import os
import posixpath
import re
import shlex
import sys
from urllib.parse import urlsplit

UI_EXT = re.compile(r"\.(html?|css|scss|jsx|tsx|vue|svelte|astro)$", re.I)
HTML_EXT = re.compile(r"\.html?$", re.I)
EDIT_TOOLS = {"Edit", "Write", "MultiEdit"}
# Bar pages (bar-pages/<NN-slug>/index.html) copy an original's measured type and colors, so
# the type-scale and contrast rules do not apply to them. The review page
# beside them (bar-pages/index.html, worst.html) stays gated.
EXEMPT = re.compile(r"(?:^|/)bar-pages/\d{2,}-[^/]+/index\.html?$", re.I)
TEMP_ROOT = re.compile(r"^(?:/private)?/(?:tmp|var/folders)/|^\$\{?TMPDIR\}?/")
PASS_LINE = re.compile(r"^Passed: 0 UI findings\b", re.M)
EDGE_PASS = re.compile(r"^Text edges: 0 near-misses\b", re.M)
EDGE_FAIL = re.compile(r"^Text edges: (?:[1-9]\d*|check did not finish)", re.M)
ALIGN_MARK = "data-ui-align"
BROWSER_EVAL = re.compile(r"javascript_tool|browser_evaluate|browser_run_code", re.I)
EDGE_SENTINEL = "textEdgeAutoV1"  # the detector returns check: 'textEdgeAutoV1'
MAX_MARK_SCAN = 2_000_000
# Events that move the shell's folder, in command order: "(" and ")" bound a subshell, and
# cd/pushd/popd carry a double-quoted, single-quoted or bare target.
CD_EVENT = re.compile(
    r"(?P<open>\()|(?P<close>\))"
    r"|(?<![\w./$~-])(?P<verb>cd|pushd|popd)(?![\w./$~-])"
    r"(?:[ \t]+(?:(?:--|-[PLe@]+)[ \t]+)*(?:\"(?P<dq>[^\"]*)\"|'(?P<sq>[^']*)'|(?P<bare>[^\s'\";|&<>()]+)))?")
REDIRECT = re.compile(r">>?\s*['\"]?([^\s'\";|&<>)]+)")
WRITER = re.compile(r"(?:^|[\s;|&(])(?:tee|cp|mv|install|rsync)\s|\b(?:sed|perl)\s+(?:-\w+\s+)*-\w*i")
REASON = ("Web UI changed this turn and no passing lint covers it. Run the ui-suite:lint-ui skill: "
          "lintapple on the changed page must print 'Passed: 0 UI findings' (keep that line in "
          "the output), and the text-edge check must print 'Text edges: 0 near-misses' "
          "(text-edge-auto.mjs, or text-edge-auto.js in the browser pane). An unmarked lintapple "
          "pass alone does not count: it skips text alignment unless the page has data-ui-align "
          "marks. A failed run, or a run on a different page, does not count. The user can "
          "say \"skip lint\" to bypass.")
CHUNK = 1 << 20  # read the transcript backwards in 1 MiB chunks


def is_real_user(entry):
    if entry.get("type") != "user" or entry.get("isMeta") or entry.get("isCompactSummary"):
        return False
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return True
    if isinstance(content, list):
        return not any(isinstance(b, dict) and b.get("type") == "tool_result" for b in content)
    return False


def user_text(entry):
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return content
    return " ".join(b.get("text", "") for b in content or [] if isinstance(b, dict))


def tool_uses(entry):
    if entry.get("type") != "assistant":
        return []
    content = (entry.get("message") or {}).get("content")
    if not isinstance(content, list):
        return []
    return [b for b in content if isinstance(b, dict) and b.get("type") == "tool_use"]


def _folder_before(cmd, end, cwd):
    """The folder the shell stands in just before cmd[end:], after the cd, pushd and popd in
    cmd[:end]. None means unknown (cd -, popd, a cd out of an unknown folder)."""
    base, saved = cwd or None, []
    for m in CD_EVENT.finditer(cmd, 0, end):
        if m.group("open"):
            saved.append(base)  # a subshell: its cd ends at the matching ")"
        elif m.group("close"):
            if saved:
                base = saved.pop()
        else:
            verb = m.group("verb")
            target = next((m.group(g) for g in ("dq", "sq", "bare") if m.group(g) is not None), None)
            if verb == "popd" or target == "-" or (verb == "pushd" and target is None):
                base = None
            elif target is None:
                base = "~"  # a bare cd goes home
            elif target == "":
                continue
            elif target.startswith(("/", "~", "$")):
                base = target
            elif base is not None:
                base = posixpath.normpath(posixpath.join(base, target))
    return base


def _landings(path, cmd, cwd):
    """Every place a write to `path` can land: one per whole-path mention in cmd."""
    p = path.strip("'\"")
    if p.startswith(("/", "~", "$")):
        return [path]
    if cmd:
        mention = re.compile(r"(?<![\w./~$-])" + re.escape(p) + r"(?![\w.-])")
        ends = [m.start() for m in mention.finditer(cmd)] or [len(cmd)]
    else:
        ends = [0]
    out = []
    for end in ends:
        base = _folder_before(cmd, end, cwd)
        out.append(posixpath.normpath(posixpath.join(base, p)) if base else path)
    return out


def resolve_write_path(path, cmd="", cwd=""):
    """Where a write lands. An absolute, ~ or $VAR path is returned as is. A relative path is
    joined with the folder the shell stands in at that point of the command: cwd (the working
    folder of the tool call that wrote it) moved by the cd, pushd and popd before it; with no
    known folder it is returned unchanged. When the path is named more than once and the
    mentions land in different places, the first one outside a temp folder is returned."""
    landed = _landings(path, cmd, cwd)
    return next((x for x in landed if not TEMP_ROOT.search(x)), landed[0])


def is_temp_write(path, cmd="", cwd=""):
    """True for a write into a temp folder: a test fixture, not a page anyone will see."""
    p = path.strip("'\"")
    if TEMP_ROOT.search(p) or TEMP_ROOT.search(resolve_write_path(path, cmd, cwd)):
        return True
    return "mktemp" in cmd and not p.startswith(("/", "~"))


def is_ui_change(name, inp, cwd=""):
    path = str(inp.get("file_path", ""))
    return (name in EDIT_TOOLS and bool(UI_EXT.search(path)) and not EXEMPT.search(path)
            and not is_temp_write(path, cwd=cwd))


def _tokens(cmd):
    try:
        return shlex.split(cmd, posix=True)
    except ValueError:
        return cmd.split()


HEREDOC = re.compile(r"<<-?\s*(['\"]?)(\w+)\1[^\n]*\n.*?^\s*\2\s*$", re.S | re.M)


def _strip_heredocs(cmd):
    """Drop heredoc bodies (a commit message, a script fed to python): they are text, not
    commands. The line that opens the heredoc stays, so `cat > page.html <<EOF` still counts."""
    return HEREDOC.sub(lambda m: m.group(0).split("\n", 1)[0], cmd)


def bash_ui_writes(cmd, cwd=""):
    """Web UI files a shell command writes: redirect targets, plus file arguments of writers."""
    cmd = _strip_heredocs(cmd)
    paths = [p for p in REDIRECT.findall(cmd) if UI_EXT.search(p)]
    if WRITER.search(cmd):
        paths += [t for t in _tokens(cmd) if "://" not in t and UI_EXT.search(t)]
    return [p for p in paths if not EXEMPT.search(p) and not is_temp_write(p, cmd, cwd)]


def results_by_id(entries):
    """{tool_use_id: (text, is_error)} for every tool_result in the entries."""
    out = {}
    for entry in entries:
        if entry.get("type") != "user":
            continue
        content = (entry.get("message") or {}).get("content")
        for b in content if isinstance(content, list) else []:
            if isinstance(b, dict) and b.get("type") == "tool_result":
                c = b.get("content")
                text = c if isinstance(c, str) else " ".join(
                    x.get("text", "") for x in c or [] if isinstance(x, dict))
                out[b.get("tool_use_id")] = (text, bool(b.get("is_error")))
    return out


def is_passing_lint(cmd, res):
    if "lintapple" not in cmd or res is None:
        return False
    text, is_error = res
    return not is_error and bool(PASS_LINE.search(text))


def lint_url(cmd):
    toks = _tokens(cmd)
    for i, t in enumerate(toks):
        if t.startswith("lintapple"):
            return next((u for u in toks[i + 1:] if "://" in u), None)
    return None


def edge_target(cmd):
    """The page a text-edge-auto.mjs command checks: a URL or an .html path."""
    toks = _tokens(cmd)
    for i, t in enumerate(toks):
        if "text-edge-auto" in t:
            return next((u for u in toks[i + 1:] if "://" in u or HTML_EXT.search(u)), None)
    return None


def is_passing_edge_run(cmd, res):
    """Bash run of the headless text-edge check that printed the pass line and no failure."""
    if "text-edge-auto" not in cmd or res is None:
        return False
    text, is_error = res
    return not is_error and bool(EDGE_PASS.search(text)) and not EDGE_FAIL.search(text)


def is_passing_edge_eval(name, inp, res):
    """The detector script run in the browser pane: its input holds the sentinel and the
    result holds the sentinel and the pass line (the result is JSON, so no line anchor)."""
    if not BROWSER_EVAL.search(str(name)) or res is None:
        return False
    text, is_error = res
    sent = json.dumps(inp, default=str)
    return (not is_error and EDGE_SENTINEL in sent and EDGE_SENTINEL in text
            and "Text edges: 0 near-misses" in text)


def _strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from _strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from _strings(v)


def carries_marks(inp, paths):
    """True when the changed code carries a data-ui-align mark: in what this call wrote, or in
    a changed file on disk (an Edit may touch a file whose marks sit elsewhere in it)."""
    if any(ALIGN_MARK in t for t in _strings(inp)):
        return True
    for p in paths:
        try:
            if os.path.getsize(p) <= MAX_MARK_SCAN:
                with open(p, encoding="utf-8", errors="replace") as f:
                    if ALIGN_MARK in f.read():
                        return True
        except OSError:
            continue
    return False


def covers(changed, cmd, url=None):
    """True when a passing run of this command covers every change so far."""
    html = [p for p in changed if HTML_EXT.search(p)]
    if len(html) < len(changed):
        return True  # a component or style file has no file-to-URL map: any passing run counts
    url = url or lint_url(cmd)
    if not url:
        return False
    name = urlsplit(url).path.rsplit("/", 1)[-1] or "index.html"
    return any(os.path.basename(p).lower() == name.lower() for p in html)


def decide(entries, stop_hook_active, cwd=""):
    if stop_hook_active:
        return None
    start = -1
    for i in range(len(entries) - 1, -1, -1):
        if is_real_user(entries[i]):
            start = i
            break
    if start >= 0 and "skip lint" in user_text(entries[start]).lower():
        return None
    turn = entries[start + 1:]
    results = results_by_id(turn)
    changed = []
    lint_ok = edge_ok = marked = False
    for entry in turn:
        for block in tool_uses(entry):
            name, inp = block.get("name"), block.get("input") or {}
            res = results.get(block.get("id"))
            here = entry.get("cwd") or cwd  # where this call ran, not where the shell is at Stop
            if is_ui_change(name, inp, here):
                changed.append(str(inp.get("file_path", "")))
                lint_ok = edge_ok = False
                marked = carries_marks(inp, changed) or marked
            elif name == "Bash":
                cmd = str(inp.get("command", ""))
                writes = bash_ui_writes(cmd, here)
                if writes:
                    changed += writes
                    lint_ok = edge_ok = False
                    marked = carries_marks(inp, writes) or marked
                elif changed:
                    if is_passing_lint(cmd, res) and covers(changed, cmd):
                        lint_ok = True
                    if is_passing_edge_run(cmd, res) and covers(changed, cmd, edge_target(cmd)):
                        edge_ok = True
            elif changed and is_passing_edge_eval(name, inp, res):
                edge_ok = True
            if changed and lint_ok and (edge_ok or marked):
                changed, lint_ok, edge_ok, marked = [], False, False, False
    return REASON if changed else None


def _parse(line):
    try:
        entry = json.loads(line)
    except (json.JSONDecodeError, ValueError):
        return None
    return entry if isinstance(entry, dict) else None


def tail_entries(path):
    """Entries from the last real user message to the end, reading backwards."""
    with open(path, "rb") as f:
        f.seek(0, os.SEEK_END)
        pos, buf, entries = f.tell(), b"", []
        while pos > 0:
            step = min(CHUNK, pos)
            pos -= step
            f.seek(pos)
            buf = f.read(step) + buf
            lines = buf.split(b"\n")
            buf = lines[0]  # may be a partial line; keep for the next chunk
            for raw in reversed(lines[1:]):
                entry = _parse(raw.decode("utf-8", "replace"))
                if entry is None:
                    continue
                entries.append(entry)
                if is_real_user(entry):
                    return list(reversed(entries))
        entry = _parse(buf.decode("utf-8", "replace"))
        if entry is not None:
            entries.append(entry)
        return list(reversed(entries))


def main():
    try:
        data = json.load(sys.stdin)
        reason = decide(tail_entries(data["transcript_path"]), bool(data.get("stop_hook_active")),
                        str(data.get("cwd") or ""))
    except Exception:  # never break stopping
        sys.exit(0)
    if reason:
        print(json.dumps({"decision": "block", "reason": reason}))
    sys.exit(0)


if __name__ == "__main__":
    main()
