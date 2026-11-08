#!/usr/bin/env python3
"""PreToolUse hook (matcher: Skill|Artifact|Edit|Write|MultiEdit): inject the user's UI taste rules.

Fires when a design or figure skill loads (artifact-design, any
taste-skill:* skill, design:*, ui-taste, anatomy, anatomy-reveal,
explain-as-machine, hairline-create; each also as <plugin>:<skill>, such as
ui-suite:ui-taste), when the Artifact tool starts or publishes a page, or when a
web UI file is edited. Injects the Principles, Never and The ladder sections
of the ui-suite:ui-taste skill's SKILL.md (found by title; read from the live
~/.claude/taste first, then the plugin's starter) plus the
"## UI taste" section of the current repo's DESIGN.md (its exceptions to
these rules) and a pointer to that DESIGN.md, as additionalContext, and
points to the gallery and ui-suite:lint-ui for the rest.

Once per transcript (main loop and each subagent separately; a subagent shares its
parent's transcript_path, so it is told apart by agent_id), and again if the
taste files change mid-session (e.g. after /ui-suite:taste add). Never blocks and never
sets a permission decision, so normal permission prompts still apply.

Also runs as a SessionStart hook (matcher "compact"): after /compact it prints the
rules again, with the same DESIGN.md section and pointer, and this session's
waiting corrections, within 9,800 characters. It prints nothing when the session never got the rules and has no
waiting corrections.
"""
import hashlib
import json
import os
import re
import subprocess
import sys

HOME = os.path.expanduser("~")
# The plugin's folder: the host sets CLAUDE_PLUGIN_ROOT for a hook. Unset (a test, a manual run),
# the folder above hooks/ is the same place.
PLUGIN_ROOT = os.environ.get("CLAUDE_PLUGIN_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TASTE_DIR = os.path.join(PLUGIN_ROOT, "skills", "ui-taste")  # the plugin's read-only starter
LIVE_DIR = os.path.join(HOME, ".claude", "taste")  # the user's live taste; read first
STATE_DIR = os.path.join(HOME, ".claude", "state", "ui-taste")
DESIGN_SKILL = re.compile(
    r"(artifact-design|^taste-skill:|^design:"
    r"|(^|:)(ui-taste|anatomy|anatomy-reveal|explain-as-machine|hairline-create)$)"
)
ARTIFACT_ACTIONS = {"publish", "quickstart"}
EDIT_TOOLS = {"Edit", "Write", "MultiEdit"}
UI_EXT = re.compile(r"\.(html?|css|scss|jsx|tsx|vue|svelte|astro)$", re.I)
INJECTED = ("Principles", "Never", "The ladder")  # pasted, by section title, in this order
BUDGET = 9500  # chars; the harness persists additionalContext past ~10KB
WAIT_DIR = os.path.join(STATE_DIR, "waiting")
WAIT_CAP = 1500     # chars of waiting corrections printed after a compact
TASTE_SECTION = "UI taste"  # the DESIGN.md section that holds a repo's exceptions to these rules
TASTE_CAP = 1000    # chars; a longer section is pointed to, not pasted (keeps payloads under the 9,000 warn line)
COMPACT_BUDGET = 9800  # SessionStart output is capped at 10,000 chars (03)
COMPACT_HEADER = (
    "UI TASTE (after compact): the ui-taste-inject hook prints the user's standing design rules "
    "again because /compact summarized the earlier copy away. A project DESIGN.md outranks "
    "them. Change them only via /ui-suite:taste."
)


def taste_dir():
    """The live taste folder when it holds a SKILL.md, else the plugin's starter."""
    return LIVE_DIR if os.path.isfile(os.path.join(LIVE_DIR, "SKILL.md")) else TASTE_DIR


def triggered(tool, inp):
    if tool == "Skill":
        return bool(DESIGN_SKILL.search(str(inp.get("skill", ""))))
    if tool == "Artifact":
        return inp.get("action", "publish") in ARTIFACT_ACTIONS
    if tool in EDIT_TOOLS:
        return bool(UI_EXT.search(str(inp.get("file_path", ""))))
    return False


def repo_name(cwd):
    """Main repo folder name; worktrees and brain repos resolve to the project."""
    cwd = cwd.split("/.claude/worktrees/")[0]
    try:
        common = subprocess.run(
            ["git", "-C", cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"],
            capture_output=True, text=True, timeout=3,
        ).stdout.strip()
        name = os.path.basename(os.path.dirname(common)) if common else os.path.basename(cwd)
    except (OSError, subprocess.SubprocessError):
        name = os.path.basename(cwd)
    return re.sub(r"Brain$", "", name)


def section_body(text, title):
    """Body of the first '## <title>' section of a markdown text (title matched without case), or ''."""
    for part in re.split(r"^## ", text, flags=re.M)[1:]:
        heading, _, body = part.partition("\n")
        if heading.strip().lower() == title.lower():
            return body.strip()
    return ""


def design_path(cwd):
    """The repo's DESIGN.md (root, then docs/), or ''."""
    root = repo_root(cwd)
    return next((p for p in (os.path.join(root, "DESIGN.md"), os.path.join(root, "docs", "DESIGN.md"))
                 if os.path.isfile(p)), "")


def project_rules(path):
    """The '## UI taste' section of a DESIGN.md: that repo's exceptions to these rules, or ''."""
    return section_body(read(path), TASTE_SECTION) if path else ""


def sections(skill):
    """{title: text} for each '## N. Title' section of SKILL.md, frontmatter stripped."""
    body = re.sub(r"\A---\n.*?\n---\n", "", skill, flags=re.S)
    return {m.group(1).strip(): m.group(0).strip()
            for m in re.finditer(r"^## \d+\. ([^\n]+)\n.*?(?=^## |\Z)", body, flags=re.M | re.S)}


def rule_variants(skill, name, proj, path=""):
    """The pasted rules, fullest first: Principles + Never + The ladder + the repo's
    "UI taste" section, then without that section, then without The ladder. Each keeps the
    pointer to the repo's DESIGN.md. Never drops Principles or Never.
    """
    secs = sections(skill)
    skill_path = os.path.join(taste_dir(), "SKILL.md")
    gallery = os.path.join(taste_dir(), "gallery.md")
    pointer = (f"Full design rules (how to use, process, where the rest lives): Read {skill_path}. "
               f"Exemplars and inspiration: grep -iA3 '^- .*<tag>' {gallery} and read the "
               f"2-3 closest entries. Before ending a turn that changed web UI, run the "
               f"ui-suite:lint-ui skill.")
    proj_block = (f"## Project: {name} (its DESIGN.md, \"{TASTE_SECTION}\" section)\n\n{proj}"
                  if proj and len(proj) <= TASTE_CAP else "")
    design = design_pointer(path) if path else ""
    core = [secs.get(t) for t in INJECTED]
    return ["\n\n".join(p for p in parts + [pointer] if p)
            for parts in (core + [proj_block, design], core + [design], core[:2] + [design])]


def build_payload(skill, name, proj, path=""):
    """The fullest rule variant within BUDGET (the smallest one if none fits).

    Hook additionalContext over ~10KB is persisted to a file and Claude sees
    only a 2KB preview, so the full SKILL.md cannot be injected. The rest is
    pointed to.
    """
    variants = rule_variants(skill, name, proj, path)
    return next((v for v in variants if len(v) <= BUDGET), variants[-1])


def marker_path(data):
    # A subagent's input carries its parent's transcript_path and session_id, plus agent_id.
    # The main loop has no agent_id, so its key stays the bare transcript_path (or session_id).
    ident = str(data.get("transcript_path") or data.get("session_id"))
    if data.get("agent_id"):
        ident += "\0" + str(data["agent_id"])
    return os.path.join(STATE_DIR, hashlib.sha1(ident.encode()).hexdigest())


def repo_root(cwd):
    try:
        top = subprocess.run(["git", "-C", cwd, "rev-parse", "--show-toplevel"],
                             capture_output=True, text=True, timeout=3).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        top = ""
    return top or cwd


def design_pointer(path):
    return f"Project design rules: Read {path}. A project DESIGN.md outranks these taste rules."


def waiting_path(session_id):
    safe = re.sub(r"[^\w-]", "", session_id)
    return os.path.join(WAIT_DIR, safe + ".md") if safe else ""


def waiting_block(session_id):
    """This session's corrections waiting for /ui-suite:taste, newest always kept (cut to fit), within WAIT_CAP."""
    path = waiting_path(session_id)
    lines = [ln for ln in read(path).splitlines() if ln.strip()] if path else []
    if not lines:
        return ""
    head = f"## Corrections waiting for /ui-suite:taste (this session; file: {path})"
    keep = []
    for line in reversed(lines):
        room = WAIT_CAP - len(head) - sum(len(k) + 1 for k in keep) - 60
        if len(line) > room:
            if keep:
                break
            line = line[:max(room - 1, 0)] + "…"  # the newest line is always kept; the file has the rest
        keep.insert(0, line)
    dropped = len(lines) - len(keep)
    note = [f"({dropped} older lines are in the file)"] if dropped else []
    return "\n".join([head, ""] + note + keep)


def compact_payload(skill, name, proj, path, waiting):
    """Header + rules + waiting list, within COMPACT_BUDGET.

    The waiting list is always kept. Drop order when over: the repo's "UI taste" section
    first, then The ladder (rule_variants' order). The DESIGN.md pointer stays.
    """
    for r in rule_variants(skill, name, proj, path):
        out = "\n\n".join(p for p in (COMPACT_HEADER, r, waiting) if p)
        if len(out) <= COMPACT_BUDGET:
            break
    return out


def after_compact(data):
    if (data.get("source") or "compact") != "compact":
        return  # matcher "compact" already filters; a missing source still counts as compact
    waiting = waiting_block(str(data.get("session_id") or ""))
    got_rules = bool(data.get("transcript_path") or data.get("session_id")) and os.path.exists(marker_path(data))
    if not got_rules and not waiting:
        return  # this session never did UI work: print nothing
    skill = read(os.path.join(taste_dir(), "SKILL.md"))
    if not skill:
        return
    cwd = data.get("cwd") or os.getcwd()
    path = design_path(cwd)
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": compact_payload(skill, repo_name(cwd), project_rules(path), path, waiting),
    }}))


def read(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            return f.read()
    except OSError:
        return ""


def run():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)
    event = data.get("hook_event_name")
    if event == "SessionStart" or (not event and "tool_name" not in data):
        after_compact(data)  # a SessionStart input carries no tool_name
        sys.exit(0)
    if not triggered(data.get("tool_name", ""), data.get("tool_input") or {}):
        sys.exit(0)

    skill = read(os.path.join(taste_dir(), "SKILL.md"))
    if not skill:
        sys.exit(0)
    cwd = data.get("cwd") or os.getcwd()
    path = design_path(cwd)
    payload = build_payload(skill, repo_name(cwd), project_rules(path), path)
    digest = hashlib.sha1(payload.encode()).hexdigest()
    marker = marker_path(data)
    if read(marker).strip() == digest:
        sys.exit(0)
    try:
        os.makedirs(STATE_DIR, exist_ok=True)
        with open(marker, "w") as f:
            f.write(digest)
    except OSError:
        pass

    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "additionalContext": (
                "UI TASTE: the user's standing design rules, auto-loaded by the ui-taste-inject "
                "hook. Apply it on top of the design skill's defaults; a project DESIGN.md or "
                "PRODUCT.md overrides it. Change it only via /ui-suite:taste.\n\n" + payload
            ),
        }
    }))
    sys.exit(0)


def main():
    """Never crash a session: any error exits 0 with no output."""
    try:
        run()
    except Exception:
        sys.exit(0)


if __name__ == "__main__":
    main()
