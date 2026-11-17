#!/usr/bin/env python3
"""Stop and SubagentStop hook: the break skills run once per session, and their finds get fixed.

Why it exists: the break skills were skipped when nothing forced them. The hook makes each
run once per session, and the agent must fix what the run finds.

Reads the whole transcript (a subagent's own transcript on SubagentStop). After the
first web UI change (what lint-ui-gate counts as one, including a page a script wrote,
found by its modified time), a Skill call to ui-suite:break-ui must appear somewhere later in it.
After the first 3D change (an Edit/Write or shell write of a .glb, .gltf, .blend,
.fbx, .obj or .usdz file, or a Blender tool that changes the scene), Skill calls to
models:break-models and models:break-scene must appear later. One run per session clears it;
later changes do not ask again. A UI change is what lint-ui-gate counts as one; this
hook reuses its transcript reading.

It asks only at the end of a turn that itself made a change of that kind: a turn of talk
after an unchecked change does not block.

A skip also counts when the user picks it on an AskUserQuestion card (an answer such as
"Skip break (Recommended)"); only the answer value is read, never the question text.

Never blocks when stop_hook_active is set (loop guard). A "skip break" from the user
holds across turns, so one skip covers an exploration round: it lasts until a break skill
runs after it, or until the user says "run break". Gap: if neither happens, the gate stays
quiet for the rest of the session. Any error exits 0 silently.
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
SKIP_SAID = re.compile(r"\bskip\b[^.\n]{0,24}?\bbreak", re.I)  # "skip break", "skip lint and break"
RUN_SAID = re.compile(r"\brun (?:the )?break", re.I)


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


def is_ui_change(name, inp, cwd="", window=(None, None)):
    if lint.is_ui_change(name, inp, cwd):
        return True
    return name == "Bash" and bool(lint.bash_ui_writes(str(inp.get("command", "")), cwd, window))


def _window(entries, i):
    """A call's window ends at the next call (or 10 minutes on): only tool calls are read."""
    start = lint._when(entries[i])
    nxt = lint._when(entries[i + 1]) if i + 1 < len(entries) else None
    return (start, nxt if nxt is not None else (start + 600 if start is not None else None))


def _turn_start(entries):
    """Index of the first entry after the last real user message (0 when there is none)."""
    for i in range(len(entries) - 1, -1, -1):
        if lint.is_real_user(entries[i]):
            return i + 1
    return 0


def turn_kinds(entries, cwd=""):
    """Which kinds of change ('ui', 'model') this turn made."""
    kinds = set()
    for i in range(_turn_start(entries), len(entries)):
        entry = entries[i]
        here = entry.get("cwd") or cwd
        for block in lint.tool_uses(entry):
            name, inp = block.get("name"), block.get("input") or {}
            if skill_name(name, inp):
                continue
            if is_ui_change(name, inp, here, _window(entries, i)):
                kinds.add("ui")
            if is_model_change(name, inp, here):
                kinds.add("model")
    return kinds


def skip_holds(entries):
    """True when a "skip break" is still in force: no break skill ran and no "run break" was
    said after the last one."""
    held = False
    for entry in entries:
        if lint.is_real_user(entry):
            text = lint.user_text(entry)
            if SKIP_SAID.search(text):
                held = True
            elif RUN_SAID.search(text):
                held = False
            continue
        if lint.card_said(entry, SKIP_SAID):  # a card answer: answer values only
            held = True
            continue
        if lint.card_said(entry, RUN_SAID):
            held = False
            continue
        if any(skill_name(b.get("name"), b.get("input") or {}) in UI_SKILLS + MODEL_SKILLS
               for b in lint.tool_uses(entry)):
            held = False
    return held


def missing_skills(entries, cwd=""):
    """Break skills that never ran after the first change that needs them."""
    ui_seen = model_seen = False
    ran_after = set()
    for i, entry in enumerate(entries):
        window = _window(entries, i)
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
            if is_ui_change(name, inp, here, window):
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
            f"The user can say \"{SKIP}\" to bypass; it holds until a break skill runs.")


def decide(entries, stop_hook_active, last_user_text, cwd=""):
    if stop_hook_active or SKIP_SAID.search(last_user_text or "") or skip_holds(entries):
        return None
    kinds = turn_kinds(entries, cwd)
    missing = [s for s in missing_skills(entries, cwd)
               if ("ui" if s in UI_SKILLS else "model") in kinds]
    return reason_for(missing) if missing else None


def session_entries(path):
    """Every assistant entry with a tool call and every real user message, read forward;
    other lines (tool results among them) are skipped unparsed."""
    out = []
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            is_call = '"tool_use"' in line
            is_card = '"tool_result"' in line and (lint.CARD_PREFIX in line or '"answers"' in line)
            if not is_call and not is_card and ('"user"' not in line or '"tool_result"' in line):
                continue
            entry = lint._parse(line)
            if entry is not None and (is_call or lint.is_real_user(entry) or (is_card and lint.card_answers(entry))):
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
