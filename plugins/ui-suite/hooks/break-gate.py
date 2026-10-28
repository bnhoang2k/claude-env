#!/usr/bin/env python3
"""Stop and SubagentStop hook: the break skills run once per session, and their finds get fixed.

Why it exists: the break skills were skipped when nothing forced them. The hook makes each
run once per session, and the agent must fix what the run finds.

Reads the whole transcript (a subagent's own transcript on SubagentStop). After the
first web UI change, a Skill call to ui-suite:break-ui must appear somewhere later in it.
After the first 3D change (an Edit/Write or shell write of a .glb, .gltf, .blend,
.fbx, .obj or .usdz file, or a Blender tool that changes the scene), Skill calls to
models:break-models and models:break-scene must appear later. One run per session clears it;
later changes do not ask again. A UI change is what lint-ui-gate counts as one; this
hook reuses its transcript reading.

Never blocks when stop_hook_active is set (loop guard) or when the user's last message
says "skip break". Any error exits 0 silently.
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
    raise FileNotFoundError("lint-ui-gate.py not found beside break-gate.py")


lint = _load_lint_gate()

MODEL_EXT = re.compile(r"\.(glb|gltf|blend|fbx|obj|usdz)$", re.I)
BLENDER_CHANGES = {"mcp__blender__execute_blender_code", "mcp__blender__import_asset",
                   "mcp__blender__generate_3d"}
UI_SKILLS = ("break-ui",)
MODEL_SKILLS = ("break-models", "break-scene")
PLUGIN_NAME = {"break-ui": "ui-suite:break-ui", "break-models": "models:break-models",
               "break-scene": "models:break-scene"}  # what the reason tells the agent to invoke
SKIP = "skip break"


def skill_name(name, inp):
    if name != "Skill":
        return None
    return str(inp.get("skill", "")).rsplit(":", 1)[-1]  # "plugin:break-ui" counts as break-ui


def is_model_change(name, inp, cwd=""):
    if name in BLENDER_CHANGES:
        return True
    if name in lint.EDIT_TOOLS:
        path = str(inp.get("file_path", ""))
        return bool(MODEL_EXT.search(path)) and not lint.is_temp_write(path, cwd=cwd)
    if name == "Bash":
        cmd = str(inp.get("command", ""))
        real = lambda p: MODEL_EXT.search(p) and not lint.is_temp_write(p, cmd, cwd)
        if any(real(p) for p in lint.REDIRECT.findall(cmd)):
            return True
        return bool(lint.WRITER.search(cmd)) and any(real(t) for t in lint._tokens(cmd))
    return False


def is_ui_change(name, inp, cwd=""):
    if lint.is_ui_change(name, inp, cwd):
        return True
    return name == "Bash" and bool(lint.bash_ui_writes(str(inp.get("command", "")), cwd))


def missing_skills(entries, cwd=""):
    """Break skills that never ran after the first change that needs them."""
    ui_seen = model_seen = False
    ran_after = set()
    for entry in entries:
        for block in lint.tool_uses(entry):
            name, inp = block.get("name"), block.get("input") or {}
            skill = skill_name(name, inp)
            if skill:
                if ui_seen and skill in UI_SKILLS:
                    ran_after.add(skill)
                if model_seen and skill in MODEL_SKILLS:
                    ran_after.add(skill)
                continue
            here = entry.get("cwd") or cwd  # where this call ran, not where the shell is at Stop
            if is_ui_change(name, inp, here):
                ui_seen = True
            if is_model_change(name, inp, here):
                model_seen = True
    need = (list(UI_SKILLS) if ui_seen else []) + (list(MODEL_SKILLS) if model_seen else [])
    return [s for s in need if s not in ran_after]


def reason_for(missing):
    names = ", ".join(PLUGIN_NAME.get(m, m) for m in missing)
    return (f"This session changed UI or 3D work and these break skills never ran: {names}. "
            "Invoke each with the Skill tool on what you changed, then fix every break it "
            "reports before you finish, and say what you fixed. Once per session is enough. "
            f"The user can say \"{SKIP}\" to bypass.")


def decide(entries, stop_hook_active, last_user_text, cwd=""):
    if stop_hook_active or SKIP in (last_user_text or "").lower():
        return None
    missing = missing_skills(entries, cwd)
    return reason_for(missing) if missing else None


def session_entries(path):
    """Every assistant entry with a tool call, read forward; other lines are skipped unparsed."""
    out = []
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if '"tool_use"' not in line:
                continue
            entry = lint._parse(line)
            if entry is not None:
                out.append(entry)
    return out


def last_user_text(path):
    tail = lint.tail_entries(path)
    return lint.user_text(tail[0]) if tail and lint.is_real_user(tail[0]) else ""


def main():
    try:
        data = json.load(sys.stdin)
        path = os.path.expanduser(data.get("agent_transcript_path") or data["transcript_path"])
        reason = decide(session_entries(path), bool(data.get("stop_hook_active")),
                        last_user_text(path), str(data.get("cwd") or ""))
    except Exception:  # never break stopping
        sys.exit(0)
    if reason:
        print(json.dumps({"decision": "block", "reason": reason}))
    sys.exit(0)


if __name__ == "__main__":
    main()
