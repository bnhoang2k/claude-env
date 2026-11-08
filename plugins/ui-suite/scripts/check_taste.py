#!/usr/bin/env python3
"""Shape and size checks for a taste folder (the plugin's starter, or the live ~/.claude/taste).

Usage: check_taste.py [<taste folder>]   (default: the starter inside this plugin)

Exit 0 with PASS lines, or FAIL lines and exit 1.
"""
import importlib.util
import json
import os
import re
import sys
from pathlib import Path

PLUGIN = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))  # plugins/ui-suite
TASTE = os.path.join(PLUGIN, "skills", "ui-taste")
HOOK = os.path.join(PLUGIN, "hooks", "ui-taste-inject.py")
POLICY = os.path.join(PLUGIN, "skills", "lint-ui", "ui-policy.json")

MAX_PRINCIPLES = 5
MAX_LINES = 500
HEADROOM = 500
PRINCIPLE_FIELDS = ("Test:", "Check:", "Example:", "Evidence:")
# One short entry per block, so agents grep a line and open the folder only on a match.
GALLERY_SECTIONS = {
    "Approved": ("use when:", "take:", "not for:"),
    "References": ("use when:", "take:", "not for:"),
    "Anti-references": ("never:",),
}
ENTRY_HEAD = re.compile(r"^- \*\*(.+?)\*\* · (\S.*?) · (\S.*)$")
RUNGS = ("1-quiet", "2-expressive", "3-immersive", "4-playable")
APPROVED_FILES = ("page.html", "light.png", "dark.png", "notes.md")
FEEL_LABEL = "Copy its feel, not its layout"


def _has_field(text, field):
    return re.search(rf"^{re.escape(field)} \S", text, flags=re.M) is not None


def principles(skill_md):
    """Principle blocks under the 'Principles' section, each starting at its '### N.' heading.

    Sections are found by title through the hook's own sections(), so the checker
    and the hook cannot disagree about where a section starts.
    """
    sec = load_hook().sections(skill_md).get("Principles")
    if not sec:
        return []
    return re.split(r"^### (?=\d+\. )", sec, flags=re.M)[1:]


def check_skill(skill_md):
    errs = []
    ps = principles(skill_md)
    if not ps:
        errs.append("no principles under a '## N. Principles' section")
    if len(ps) > MAX_PRINCIPLES:
        errs.append(f"{len(ps)} principles, cap is {MAX_PRINCIPLES}")
    for p in ps:
        name = p.split("\n", 1)[0].strip()
        for field in PRINCIPLE_FIELDS:
            if not _has_field(p, field):
                errs.append(f"principle '{name}' lacks '{field}'")
    lines = skill_md.count("\n") + 1
    if lines > MAX_LINES:
        errs.append(f"SKILL.md is {lines} lines, cap is {MAX_LINES}")
    return errs


def check_order(skill_md, injected):
    """The pasted sections come first, in paste order, so the hook and a re-attached skill start alike."""
    titles = re.findall(r"^## \d+\. (.+?)\s*$", skill_md, flags=re.M)
    if titles[:len(injected)] != list(injected):
        return [f"pasted sections must come first as {list(injected)}; found {titles[:len(injected)]}"]
    return []


def check_gallery(gallery_md, root=TASTE):
    errs = []
    if re.search(r"^### ", gallery_md, flags=re.M):
        errs.append("gallery.md uses the old '### name' entry format; use '- **name** · tags · link'")
    for block in re.split(r"^## ", gallery_md, flags=re.M)[1:]:
        title, _, body = block.partition("\n")
        title = title.strip()
        entries = re.split(r"^(?=- \*\*)", body, flags=re.M)[1:]
        if title not in GALLERY_SECTIONS:
            if entries:
                errs.append(f"gallery section '{title}' is not one of {list(GALLERY_SECTIONS)}")
            continue
        for entry in entries:
            head = ENTRY_HEAD.match(entry.split("\n", 1)[0])
            if not head:
                errs.append(f"gallery entry line {entry.splitlines()[0]!r} is not '- **name** · tags · link'")
                continue
            name, link = head.group(1), head.group(3)
            for field in GALLERY_SECTIONS[title]:
                if not re.search(rf"^  {re.escape(field)} \S", entry, flags=re.M):
                    errs.append(f"gallery entry '{name}' lacks '{field}'")
            if title != "Approved":
                continue
            m = re.match(r"`?(?:\./)?(gallery/([^/\s`]+)/[^\s`]+)", link)
            if not m:
                if re.match(r"`?(?:\./)?gallery/", link):
                    errs.append(f"gallery entry '{name}': cannot parse its gallery/ link: {link!r}")
                continue
            rel, rung = m.group(1), m.group(2)
            if rung not in RUNGS:
                errs.append(f"gallery entry '{name}' links rung '{rung}', not one of {list(RUNGS)}")
            folder = os.path.join(root, rel)
            for f in APPROVED_FILES:
                if not os.path.isfile(os.path.join(folder, f)):
                    errs.append(f"gallery entry '{name}' is missing {rel.rstrip('/')}/{f}")
            notes = os.path.join(folder, "notes.md")
            if os.path.isfile(notes):
                with open(notes, encoding="utf-8", errors="replace") as fh:
                    if FEEL_LABEL not in fh.read():
                        errs.append(f"gallery entry '{name}': notes.md lacks '{FEEL_LABEL}'")
    return errs


# A realistic DESIGN.md path: its length counts toward the payload through the pointer line.
DESIGN_PATH = "/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/docs/DESIGN.md"


def each_case(hook):
    """(label, UI taste section, DESIGN.md path): no DESIGN.md, one with no section, one at the cap."""
    yield "no DESIGN.md", "", ""
    yield "DESIGN.md without a UI taste section", "", DESIGN_PATH
    yield "UI taste section at its cap", "r" * hook.TASTE_CAP, DESIGN_PATH


def check_payloads(skill_md, hook):
    """Every case must fit BUDGET, and a section at its cap must still be pasted."""
    errs = []
    for label, proj, path in each_case(hook):
        payload = hook.build_payload(skill_md, "repo", proj, path)
        if len(payload) > hook.BUDGET:
            errs.append(f"payload with {label} is {len(payload)} chars, over budget {hook.BUDGET}")
        if proj and "## Project:" not in payload:
            errs.append(f"payload with {label}: section not pasted (dropped to a pointer)")
    return errs


def payload_warnings(skill_md, hook):
    """Payloads inside BUDGET but within HEADROOM of it: a distill is due. Never an error."""
    warns = []
    for label, proj, path in each_case(hook):
        payload = hook.build_payload(skill_md, "repo", proj, path)
        if hook.BUDGET - HEADROOM < len(payload) <= hook.BUDGET:
            warns.append(
                f"payload with {label} is {len(payload)} chars; "
                f"under {HEADROOM} chars of headroom (distill due)"
            )
    return warns


def check_compact_payloads(skill_md, hook):
    """The after-compact print must fit with a full waiting list."""
    errs = []
    waiting = "w" * hook.WAIT_CAP
    for label, proj, path in each_case(hook):
        out = hook.compact_payload(skill_md, "repo", proj, path, waiting)
        if len(out) > hook.COMPACT_BUDGET:
            errs.append(f"after-compact print with {label} is {len(out)} chars, over {hook.COMPACT_BUDGET}")
    return errs


_HOOKS = {}


def load_hook(path=HOOK):
    if path not in _HOOKS:
        _HOOKS[path] = _load_hook(path)
    return _HOOKS[path]


def _load_hook(path):
    spec = importlib.util.spec_from_file_location("ui_taste_inject", path)
    mod = importlib.util.module_from_spec(spec)
    # Keep Python bytecode caches out of the tree being checked.
    sys.dont_write_bytecode = True
    spec.loader.exec_module(mod)
    return mod


def _read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def main(path=TASTE) -> int:
    """Validate the taste folder at path. Prints PASS/FAIL lines; returns 0, or 1 on any FAIL."""
    path = str(path)
    skill_path = os.path.join(path, "SKILL.md")
    if not os.path.isfile(skill_path):
        print(f"FAIL ui-taste: {skill_path} missing")
        return 1
    skill_md = _read(skill_path)
    gallery_path = os.path.join(path, "gallery.md")
    errs = check_skill(skill_md)
    errs += check_gallery(_read(gallery_path), root=path) if os.path.exists(gallery_path) else ["gallery.md missing"]
    hook = load_hook()
    errs += check_order(skill_md, hook.INJECTED)
    errs += check_payloads(skill_md, hook)
    errs += check_compact_payloads(skill_md, hook)
    warns = payload_warnings(skill_md, hook)
    try:
        json.loads(_read(POLICY))
    except (OSError, ValueError) as e:
        errs.append(f"lint-ui policy invalid: {e}")
    for w in warns:
        print(f"WARN ui-taste: {w}")
    for e in errs:
        print(f"FAIL ui-taste: {e}")
    if errs:
        return 1
    print(f"PASS ui-taste: {len(principles(skill_md))} principles, gallery and payloads within caps")
    return 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else TASTE))
