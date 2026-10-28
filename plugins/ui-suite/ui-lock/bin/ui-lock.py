#!/usr/bin/env python3
"""ui-lock: install, check and sync a stack's UI lint preset in a repo.

  ui-lock.py install <stack> <lint-dir>
  ui-lock.py status <lint-dir>
  ui-lock.py sync <lint-dir>

<lint-dir> holds the repo's lint config; the preset lands in <lint-dir>/.ui-lock/.
DESIGN.md is the nearest one at or above <lint-dir>, stopping at the git root.
Presets come from $UI_LOCK_ROOT, else ../presets next to this file.
Changing files/ requires a VERSION bump (check 70 enforces it).

Exit codes:
  0  ok, or current
  1  behind (status only)
  2  unknown stack, or no preset installed (no stamp, or no <lint-dir>/.ui-lock/),
     or a usage error (bad arguments).
     Usage errors share code 2 with "unknown stack / not installed"; read the message.
  3  <lint-dir> is not a directory, or there is no DESIGN.md, or DESIGN.md has no
     "## UI system" block with a Preset row, or any other error (unreadable or
     malformed preset or DESIGN.md). The error is one line on stderr.
  4  the repo's stamp is AHEAD of claude-env (status and sync). Pull claude-env.
     sync refuses and changes nothing.

Never commits and never stages.
The "## UI system" parsing mirrors parseUiSystem in
ui-lock/presets/react-web/files/read-design.mjs. Keep the two in step.
"""
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HEADING = "## UI system"
ROW = re.compile(r"^\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*$")
TEMPLATE = "the DESIGN.md template in the workflow:new-project skill (archetypes/_shared/DESIGN.md.tmpl)"


def preset_root():
    env = os.environ.get("UI_LOCK_ROOT")
    return Path(env) if env else Path(__file__).resolve().parent.parent / "presets"


def die(message, code):
    print(f"ui-lock: {message}", file=sys.stderr)
    sys.exit(code)


def require_dir(lint_dir):
    if not Path(lint_dir).is_dir():
        die(f"{lint_dir} is not a directory.", 3)


def find_design(start):
    d = Path(start).resolve()
    while True:
        if (d / "DESIGN.md").is_file():
            return d / "DESIGN.md"
        if (d / ".git").exists() or d.parent == d:
            return None
        d = d.parent


def block_bounds(lines):
    """(start, end) line indexes of the UI system section, or None."""
    for i, line in enumerate(lines):
        if line.strip() == HEADING:
            end = next((j for j in range(i + 1, len(lines)) if lines[j].startswith("## ")), len(lines))
            return i, end
    return None


def read_block(lines):
    bounds = block_bounds(lines)
    if bounds is None:
        return None
    fields = {}
    for line in lines[bounds[0] + 1 : bounds[1]]:
        m = ROW.match(line)
        if m:
            value = m.group(2).replace("`", "").strip()
            fields[m.group(1)] = "" if value.startswith("<!--") else value
    return fields


def require_design(lint_dir):
    design = find_design(lint_dir)
    if design is None:
        die(f"no DESIGN.md at or above {lint_dir}. Add one from {TEMPLATE}.", 3)
    lines = design.read_text(encoding="utf-8").splitlines()
    fields = read_block(lines)
    if fields is None or "Preset" not in fields:
        die(f"{design} has no {HEADING} block with a Preset row. Add it from {TEMPLATE}.", 3)
    return design, lines, fields


def preset_version(stack):
    vfile = preset_root() / stack / "VERSION"
    if not vfile.is_file():
        root = preset_root()
        known = sorted(p.name for p in root.iterdir() if (p / "VERSION").is_file()) if root.is_dir() else []
        die(f"no preset for stack '{stack}'. Presets: {', '.join(known) or 'none'}.", 2)
    return int(vfile.read_text().strip())


def write_stamp(design, lines, stamp):
    start, end = block_bounds(lines)
    for i in range(start + 1, end):
        m = ROW.match(lines[i])
        if m and m.group(1) == "Preset":
            lines[i] = f"| Preset | {stamp} |"
    design.write_text("\n".join(lines) + "\n", encoding="utf-8")


def copy_files(stack, lint_dir):
    dest = Path(lint_dir) / ".ui-lock"
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(preset_root() / stack / "files", dest)
    return dest


def install(stack, lint_dir):
    require_dir(lint_dir)
    version = preset_version(stack)
    design, lines, _ = require_design(lint_dir)
    dest = copy_files(stack, lint_dir)
    write_stamp(design, lines, f"{stack}@{version}")
    print(f"Installed {stack}@{version} into {dest}")
    print((preset_root() / stack / "WIRING.md").read_text(encoding="utf-8"))
    return 0


def installed(lint_dir):
    """(design, lines, stack, have, want), or exits 2 when none is installed
    (no stamp in DESIGN.md, or no .ui-lock/ in <lint-dir>)."""
    require_dir(lint_dir)
    design, lines, fields = require_design(lint_dir)
    stamp = fields.get("Preset", "")
    if not stamp or stamp == "none" or "@" not in stamp:
        print(f"No ui-lock preset installed. Run: ui-lock.py install <stack> {lint_dir}")
        sys.exit(2)
    stack, have = stamp.split("@", 1)
    if not have.isdigit():
        die(f"{design} Preset row '{stamp}' is not <stack>@<n>.", 3)
    if not (Path(lint_dir) / ".ui-lock").is_dir():
        print(f"No .ui-lock/ in {lint_dir}. Run: ui-lock.py install {stack} {lint_dir}")
        sys.exit(2)
    return design, lines, stack, int(have), preset_version(stack)


def ahead(stack, have, want):
    print(f"{stack}@{have} is ahead of claude-env {stack}@{want}. Pull claude-env.")
    return 4


def status(lint_dir):
    _, _, stack, have, want = installed(lint_dir)
    if have == want:
        print(f"{stack}@{have} is current.")
        return 0
    if have > want:
        return ahead(stack, have, want)
    print(f"{stack}@{have} is behind claude-env {stack}@{want}. Run: ui-lock.py sync {lint_dir}")
    return 1


def git(lint_dir, *args):
    """git output, or None when git is missing or fails (not a repo)."""
    try:
        r = subprocess.run(["git", "-C", str(lint_dir), *args], capture_output=True, text=True)
    except FileNotFoundError:
        return None
    return r.stdout.rstrip() if r.returncode == 0 else None


def sync(lint_dir):
    design, lines, stack, have, want = installed(lint_dir)
    if have == want:
        print(f"{stack}@{have} is already current.")
        return 0
    if have > want:
        return ahead(stack, have, want)
    copy_files(stack, lint_dir)
    write_stamp(design, lines, f"{stack}@{want}")
    stat = git(lint_dir, "diff", "--stat", "--", ".ui-lock", str(design))
    if stat is None:
        print("Not a git repo; no diff shown.")
    else:
        print(stat)
        # diff --stat skips untracked files; status shows new preset files. Never stages.
        print(git(lint_dir, "status", "--short", "--", ".ui-lock"))
    print(f"Synced {stack}@{have} -> {stack}@{want}. Review and commit. ui-lock never commits.")
    return 0


def main(argv):
    try:
        return dispatch(argv)
    except (ValueError, OSError) as e:
        die(f"{type(e).__name__}: {e}", 3)


def dispatch(argv):
    if len(argv) == 3 and argv[0] == "install":
        return install(argv[1], argv[2])
    if len(argv) == 2 and argv[0] == "status":
        return status(argv[1])
    if len(argv) == 2 and argv[0] == "sync":
        return sync(argv[1])
    print("usage: ui-lock.py install <stack> <lint-dir> | status <lint-dir> | sync <lint-dir>", file=sys.stderr)
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
