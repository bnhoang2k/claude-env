#!/usr/bin/env python3
"""Checks the tools models:break-models and models:break-scene need, before a long render starts.

usage: python3 preflight.py

Prints one stdout line per need: `ok <tool>` or `needs <exact tool name>: <where to get it>`.
Exit 0 when every need is found, 3 when any is missing. Never prints a stack trace.
The line `ok Blender <version> at <path>` gives the path the SKILL.md uses as B.
Runs on Python 3.9 and newer, and imports only the standard library.
"""
import os
import re
import shutil
import subprocess
import sys

MAC_APP = "/Applications/Blender.app/Contents/MacOS/Blender"
# look.py names the render engine 'BLENDER_EEVEE', which is the name in Blender 5.0 and newer (and in 4.1 and older).
MIN_MAJOR = 5

lines = []
missing = 0


def ok(what):
    lines.append("ok " + what)


def need(name, where):
    global missing
    missing += 1
    lines.append("needs {}: {}".format(name, where))


def find_blender():
    """The BLENDER variable, else `blender` on the PATH, else the macOS app. None when there is none."""
    given = os.environ.get("BLENDER")
    if given:
        found = shutil.which(given) or (given if os.path.isfile(given) and os.access(given, os.X_OK) else None)
        return found  # a BLENDER that points nowhere is an error to report, not a reason to look elsewhere
    return shutil.which("blender") or (MAC_APP if os.access(MAC_APP, os.X_OK) else None)


def blender_version(path):
    """(major, text) from `blender --version`, or None when it will not run."""
    try:
        done = subprocess.run([path, "--version"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                              stdin=subprocess.DEVNULL, universal_newlines=True, timeout=60)
    except (OSError, subprocess.SubprocessError):
        return None
    m = re.search(r"Blender\s+(\d+)\.(\d+)(?:\.(\d+))?", done.stdout or "")
    if done.returncode != 0 or not m:
        return None
    return int(m.group(1)), ".".join(g for g in m.groups() if g is not None)


INSTALL = "install Blender from https://www.blender.org/download/, then put `blender` on your PATH or set BLENDER to its executable"

path = find_blender()
if os.environ.get("BLENDER") and not path:
    need("Blender 5.0 or newer", "BLENDER is set to {!r}, which is not an executable file; fix it or unset it".format(os.environ["BLENDER"]))
elif not path:
    need("Blender 5.0 or newer", INSTALL)
else:
    version = blender_version(path)
    if version is None:
        need("Blender 5.0 or newer", "{} did not run with --version; {}".format(path, INSTALL))
    elif version[0] < MIN_MAJOR:
        need("Blender 5.0 or newer", "{} is Blender {}; {}".format(path, version[1], INSTALL))
    else:
        ok("Blender {} at {}".format(version[1], path))

# Pillow composites the rendered cells into contact sheets (look.py, run by the system python3).
try:
    import PIL  # noqa: F401
    ok("Pillow {}".format(getattr(PIL, "__version__", "")).rstrip())
except Exception:  # missing, or installed but broken: both need the same fix
    need("Pillow", "run: python3 -m pip install Pillow")

print("\n".join(lines))
sys.exit(3 if missing else 0)
