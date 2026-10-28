#!/usr/bin/env python3
"""Seed the live taste folder from the plugin's starter.

The ui-suite plugin ships a starter taste (read-only: a plugin update replaces it). Each user's
live taste is ~/.claude/taste/. seed() copies the starter into the live folder only when the live
folder is missing or empty. It never overwrites, and it never copies into a live folder that
resolves to the starter itself (the owner's symlink).

Run with no arguments to seed ~/.claude/taste from this plugin's starter.
"""
import shutil
import sys
from pathlib import Path

STARTER = Path(__file__).resolve().parent.parent / "skills" / "ui-taste"
LIVE = Path.home() / ".claude" / "taste"
IGNORE = shutil.ignore_patterns("__pycache__", ".DS_Store")  # the starter has no captures/ folder


def seed(starter: Path, live: Path) -> bool:
    """Copy starter into live when live is missing or empty. True if it copied."""
    starter, live = Path(starter), Path(live)
    target = live.resolve()
    if target == starter.resolve():
        return False  # live is a link to the starter: nothing to seed
    if live.is_symlink() and not target.exists():
        return False  # a broken link: leave it for the user
    if target.exists() and (not target.is_dir() or any(target.iterdir())):
        return False  # live already holds something
    if not starter.is_dir():
        return False
    shutil.copytree(starter, target, ignore=IGNORE, dirs_exist_ok=True)
    return True


def main() -> int:
    if seed(STARTER, LIVE):
        print(f"seeded {LIVE} from {STARTER}")
    else:
        print(f"kept {LIVE} as it is")
    return 0


if __name__ == "__main__":
    sys.exit(main())
