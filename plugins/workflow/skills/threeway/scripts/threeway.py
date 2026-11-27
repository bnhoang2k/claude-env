#!/usr/bin/env python3
"""threeway helper: session state for a user + ChatGPT + Claude collaboration.

Mechanical steps only. Every command prints one JSON object on stdout.
Exit 0 on success, 2 on bad input.

Session data lives in $THREEWAY_HOME (default ~/.claude/threeway), never in a repo:
    <home>/<repo-slug>/<YYYY-MM-DD>-<task-slug>/state.json
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import re
import sys
import tempfile
from pathlib import Path

PROTOCOL = "threeway/1.0"
MODES = ("blind", "informed", "staged")
REQUEST_STATUSES = ("new", "approved", "done", "ignored")
# The only status changes mark allows, so a finished request cannot be approved again.
TRANSITIONS = {("new", "approved"), ("new", "ignored"), ("approved", "done"),
               ("approved", "ignored")}
LOG_FIELDS = {
    "decision": ("text", "confirmed_by_user", "source"),
    "evidence": ("label", "path", "shows"),
    "experiment": ("id", "variants", "location", "result"),
}


TYPES = ("SESSION_KICKOFF", "CLAUDE_REQUEST", "CLAUDE_RESPONSE", "CLAUDE_PROPOSAL",
         "CLAUDE_ACTION", "SESSION_HANDOFF", "SESSION_STATUS")
# What ChatGPT may send. The other types are Claude's own; one in an assistant turn is ignored.
CHATGPT_TYPES = ("CLAUDE_REQUEST", "SESSION_HANDOFF")
ENVELOPE = ("protocol", "type", "session_id", "message_id")
ID_PATTERNS = {
    "CLAUDE_REQUEST": r"REQ-\d{3,}",
    "CLAUDE_RESPONSE": r"RES-\d{3,}",
    "CLAUDE_PROPOSAL": r"PRO-\d{3,}",
    "CLAUDE_ACTION": r"ACT-\d{3,}",
}
HANDOFF_SECTIONS = (
    "objective", "current_state", "diagnosis", "evidence_and_reasoning", "decisions",
    "rejected_approaches", "preserve", "implementation_direction",
    "prescriptive_requirements", "implementation_freedom", "acceptance_criteria",
    "visual_references", "open_questions", "disagreements", "validation_plan",
)
DISPOSITIONS = ("implementation_ready", "experiment_ready", "direction_only", "blocked",
                "finalized")
DECISION_STATUSES = ("confirmed", "recommended", "exploratory")
# Per type: field -> allowed values (tuple), or a Python type the value must be.
TYPE_FIELDS = {
    "SESSION_KICKOFF": {"repo": str, "task": str, "mode": MODES, "objective": str,
                        "open_question": str},
    "CLAUDE_REQUEST": {"operation": ("investigate", "experiment", "evidence"),
                       "objective": str, "questions": list, "deliverables": list,
                       "permission": ("read_only", "isolated_experiment"),
                       "priority": ("blocking", "parallel", "optional")},
    "CLAUDE_RESPONSE": {"reply_to": str, "status": ("done", "partial", "refused", "failed"),
                        "answers": list, "evidence": list, "limits": list},
    "CLAUDE_PROPOSAL": {"proposal": str, "rationale": str, "evidence": list},
    "CLAUDE_ACTION": {"action": str, "changes": list, "evidence": list},
    "SESSION_STATUS": {"iteration": int, "status": ("open", "closed"), "open": list,
                       "done": list},
    "SESSION_HANDOFF": {"handoff_id": str, "iteration": int, "disposition": DISPOSITIONS},
}


class BadInput(Exception):
    """Input the user or the page gave us is wrong. Exit 2."""


# ---------- validation ----------

def _check_field(payload: dict, name: str, rule) -> str | None:
    if name not in payload:
        return f"missing field: {name}"
    value = payload[name]
    if isinstance(rule, tuple):
        return None if value in rule else f"bad value: {name}"
    if rule is int:
        ok = isinstance(value, int) and not isinstance(value, bool) and value >= 0
        return None if ok else f"bad value: {name}"
    if rule is str:
        return None if isinstance(value, str) and value.strip() else f"bad value: {name}"
    return None if isinstance(value, rule) else f"bad value: {name}"


def validate(payload) -> list[str]:
    """Return the payload's errors, in a stable order. Empty list means valid."""
    if not isinstance(payload, dict):
        return ["bad value: payload"]
    errors = [f"missing field: {f}" for f in ENVELOPE if f not in payload]
    if errors:
        return errors
    if payload["protocol"] != PROTOCOL:
        return ["wrong protocol"]
    kind = payload["type"]
    if kind not in TYPES:
        return ["bad value: type"]
    if not isinstance(payload["message_id"], str) or not payload["message_id"].strip():
        return ["bad value: message_id"]
    pattern = ID_PATTERNS.get(kind)
    if pattern and not re.fullmatch(pattern, payload["message_id"]):
        errors.append("bad value: message_id")
    for name, rule in TYPE_FIELDS[kind].items():
        err = _check_field(payload, name, rule)
        if err:
            errors.append(err)
    if kind == "SESSION_HANDOFF":
        errors += _validate_handoff(payload)
    return errors


def _validate_handoff(p: dict) -> list[str]:
    errors = []
    if isinstance(p.get("iteration"), int) and p.get("handoff_id") != f"HO-{p['iteration']}":
        errors.append("bad value: handoff_id")
    for section in HANDOFF_SECTIONS:
        if section not in p:
            errors.append(f"missing field: {section}")
        elif not isinstance(p[section], (str, list)):
            errors.append(f"bad value: {section}")
    decisions = p.get("decisions")
    if isinstance(decisions, list):
        for i, d in enumerate(decisions):
            where = f"decisions[{i}]"
            if not isinstance(d, dict):
                errors.append(f"bad value: {where}")
                continue
            for f in ("text", "status", "confirmed_by_user", "source"):
                if f not in d:
                    errors.append(f"missing field: {where}.{f}")
            if "status" in d and d["status"] not in DECISION_STATUSES:
                errors.append(f"bad value: {where}.status")
            if "confirmed_by_user" in d and not isinstance(d["confirmed_by_user"], bool):
                errors.append(f"bad value: {where}.confirmed_by_user")
            elif d.get("status") == "confirmed" and d.get("confirmed_by_user") is not True:
                errors.append(f"bad value: {where}.confirmed_by_user")
    elif isinstance(decisions, str) and decisions.strip():
        errors.append("bad value: decisions")
    return errors


# ---------- paths and state ----------

def home() -> Path:
    return Path(os.environ.get("THREEWAY_HOME") or Path.home() / ".claude" / "threeway")


def slug(text: str) -> str:
    """A safe folder name: lowercase ASCII letters and digits joined by single hyphens."""
    s = re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")
    return s or "untitled"


def now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")


def session_dir(session_id: str) -> Path:
    """Find a session's folder by scanning state files (no index to go stale)."""
    root = home()
    for state_file in sorted(root.glob("*/*/state.json")):
        try:
            if json.loads(state_file.read_text()).get("session_id") == session_id:
                return state_file.parent
        except (OSError, ValueError):
            continue
    raise BadInput(f"unknown session: {session_id}")


def load_state(session_id: str) -> dict:
    return json.loads((session_dir(session_id) / "state.json").read_text())


def _atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    try:
        with os.fdopen(fd, "w") as f:
            f.write(text)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def save_state(session_id: str, state: dict, folder: Path | None = None) -> None:
    folder = folder or session_dir(session_id)
    _atomic_write(folder / "state.json", json.dumps(state, indent=2, ensure_ascii=False) + "\n")


# ---------- commands ----------

def cmd_init(a) -> dict:
    date = a.date or _dt.date.today().isoformat()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        raise BadInput("bad value: date")
    repo_s, task_s = slug(a.repo), slug(a.task)
    # A slug never holds "--", so the repo/task boundary stays visible in the ID.
    session_id = f"{repo_s}--{task_s}-{date}"
    folder = home() / repo_s / f"{date}-{task_s}"
    title = f"{a.repo} · {a.task} · {date}"
    if (folder / "state.json").exists():
        state = json.loads((folder / "state.json").read_text())
        return {"session_id": state["session_id"], "dir": str(folder),
                "title": state["title"], "existing": True}
    try:
        other = session_dir(session_id)
    except BadInput:
        other = None
    if other is not None:
        raise BadInput(f"session id taken by another folder: {other}")
    for sub in ("evidence", "figures", "handoffs"):
        (folder / sub).mkdir(parents=True, exist_ok=True)
    state = {
        "session_id": session_id,
        "repo": a.repo,
        "task": a.task,
        "branch": a.branch,
        "mode": a.mode,
        "revealed": a.mode == "informed",
        "title": title,
        "chat_url": None,
        "iteration": 0,
        "status": "open",
        "last_handoff": None,
        "created": now(),
        "requests": {},
        "seen_ids": [],
        "reported_ignored": [],
        "pending_handoffs": [],
    }
    save_state(session_id, state, folder)
    return {"session_id": session_id, "dir": str(folder), "title": title, "existing": False}


def cmd_status(a) -> dict:
    return load_state(a.session)


def cmd_mark(a) -> dict:
    state = load_state(a.session)
    entry = state["requests"].get(a.id)
    if entry is None:
        raise BadInput(f"unknown request: {a.id}")
    if (entry["status"], a.status) not in TRANSITIONS:
        raise BadInput(f"cannot go from {entry['status']} to {a.status}: {a.id}")
    entry["status"] = a.status
    if a.note is not None:
        entry["note"] = a.note
    entry["updated"] = now()
    save_state(a.session, state)
    return {"id": a.id, **entry}


def cmd_log(a) -> dict:
    try:
        obj = json.loads(a.json)
    except ValueError:
        raise BadInput("invalid JSON")
    if not isinstance(obj, dict):
        raise BadInput("bad value: entry")
    for field in LOG_FIELDS[a.kind]:
        if field not in obj:
            raise BadInput(f"missing field: {field}")
    if a.kind == "decision" and not isinstance(obj["confirmed_by_user"], bool):
        raise BadInput("bad value: confirmed_by_user")
    folder = session_dir(a.session)
    entry = {"at": now(), "kind": a.kind, **obj}
    with open(folder / "log.jsonl", "a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return entry


def _bool(text: str) -> bool:
    if text not in ("true", "false"):
        raise BadInput("bad value: revealed")
    return text == "true"


def cmd_set(a) -> dict:
    state = load_state(a.session)
    if a.chat_url is not None:
        state["chat_url"] = a.chat_url
    if a.revealed is not None:
        state["revealed"] = _bool(a.revealed)
    if a.status is not None:
        state["status"] = a.status
    if a.title is not None:
        state["title"] = a.title
    if a.bump_iteration:
        state["iteration"] += 1
    save_state(a.session, state)
    return state


# ---------- ingest ----------

def extract(turns, state: dict) -> dict:
    """Pull new valid payloads out of page turns. Updates `state` in place.

    turns: [{"role", "message_id", "state", "blocks": [{"lang", "text", "in_quote"}]}]
    Only blocks tagged `threeway` count. A turn not yet `complete` is reported as incomplete
    and left unseen, so the next read picks it up. Each ignored block is reported once.
    """
    if not isinstance(turns, list):
        raise BadInput("bad value: turns")
    seen = set(state["seen_ids"])
    reported = set(state.get("reported_ignored", []))
    new, ignored, incomplete = [], [], []

    rejected_handoffs = []

    def ignore(turn_id, index, reason) -> bool:
        """Report a block once. True when this is the first report."""
        key = f"{turn_id}#{index}"
        if key in reported:
            return False
        reported.add(key)
        ignored.append({"message_id": turn_id, "block": index, "reason": reason})
        return True

    for turn in turns:
        if not isinstance(turn, dict):
            raise BadInput("bad value: turn")
        turn_id = turn.get("message_id")
        if not isinstance(turn_id, str) or not turn_id.strip():
            raise BadInput("bad value: turn message_id (page selectors may have changed)")
        raw_blocks = turn.get("blocks") or []
        if not isinstance(raw_blocks, list):
            raise BadInput("bad value: turn blocks")
        blocks = [(i, b) for i, b in enumerate(raw_blocks)
                  if isinstance(b, dict) and b.get("lang") == "threeway"]
        if turn.get("role") != "assistant":
            for i, _ in blocks:
                ignore(turn_id, i, "user turn")
            continue
        if turn.get("state") != "complete":
            incomplete.append(turn_id)
            continue
        for i, block in blocks:
            if block.get("in_quote"):
                ignore(turn_id, i, "quoted")
                continue
            text = block.get("text")
            try:
                payload = json.loads(text) if isinstance(text, str) else None
            except ValueError:
                payload = None
            if payload is None:
                ignore(turn_id, i, "invalid JSON")
                continue
            errors = validate(payload)
            if errors and errors[0] == "wrong protocol":
                ignore(turn_id, i, "wrong protocol")
                continue
            if isinstance(payload, dict) and "session_id" in payload \
                    and payload["session_id"] != state["session_id"]:
                ignore(turn_id, i, "wrong session")
                continue
            if errors:
                first = ignore(turn_id, i, errors[0])
                if first and payload.get("type") == "SESSION_HANDOFF":
                    # Keep a malformed handoff raw, with its errors, instead of dropping it.
                    rejected_handoffs.append({"turn": turn_id, "raw": text, "errors": errors})
                continue
            if payload["type"] not in CHATGPT_TYPES:
                ignore(turn_id, i, "bad value: type")
                continue
            mid = payload["message_id"]
            if mid in seen or mid in state["requests"]:
                ignore(turn_id, i, "duplicate")
                continue
            seen.add(mid)
            state["seen_ids"].append(mid)
            new.append({**payload, "_turn": turn_id})
            if payload["type"] == "CLAUDE_REQUEST":
                # The whole payload is kept, so a later session can run it from state.
                state["requests"][mid] = {
                    "status": "new", "type": payload["operation"], "note": None,
                    "priority": payload["priority"], "permission": payload["permission"],
                    "objective": payload["objective"], "turn": turn_id, "found": now(),
                    "payload": payload,
                }
            else:  # SESSION_HANDOFF: waits in state until `handoff` saves it
                state.setdefault("pending_handoffs", []).append({**payload, "_turn": turn_id})
    state["reported_ignored"] = sorted(reported)
    return {"new": new, "ignored": ignored, "incomplete": incomplete,
            "rejected_handoffs": rejected_handoffs}


def _read_json_file(path: str):
    try:
        return json.loads(Path(path).read_text())
    except OSError:
        raise BadInput(f"cannot read: {path}")
    except ValueError:
        raise BadInput("invalid JSON")


def cmd_ingest(a) -> dict:
    state = load_state(a.session)
    out = extract(_read_json_file(a.turns), state)
    folder = session_dir(a.session)
    saved = []
    for item in out.pop("rejected_handoffs"):
        saved.append(str(_save_invalid(folder, item["errors"], None, item["raw"])))
    out["rejected_handoffs_saved"] = saved
    out["pending_requests"] = sorted(k for k, v in state["requests"].items()
                                     if v["status"] == "new")
    out["pending_handoffs"] = [h["handoff_id"] for h in state.get("pending_handoffs", [])]
    save_state(a.session, state)
    return out


# ---------- handoff, figures, transcript ----------

def _render_item(item) -> str:
    if isinstance(item, dict):
        if {"text", "status"} <= item.keys():
            who = "confirmed by the user" if item.get("confirmed_by_user") else "not confirmed"
            return f"{item['text']} ({item['status']}, {who}; source {item.get('source')})"
        return "; ".join(f"{k}: {v}" for k, v in item.items())
    return str(item)


def render_handoff_md(p: dict) -> str:
    lines = [f"# {p['handoff_id']} — {p['disposition']}", "",
             f"Session `{p['session_id']}`, iteration {p['iteration']}.", ""]
    for section in HANDOFF_SECTIONS:
        lines.append(f"## {section}")
        value = p[section]
        if isinstance(value, list):
            lines += [f"- {_render_item(v)}" for v in value] or ["(none)"]
        else:
            lines.append(value.strip() or "(none)")
        lines.append("")
    return "\n".join(lines)


def _figure_ids(p: dict) -> list[str]:
    """Every VIS-nnn named in visual_references, whether it is a string or a list."""
    text = json.dumps(p.get("visual_references") or [], ensure_ascii=False)
    return list(dict.fromkeys(re.findall(r"VIS-\d{3,}", text)))


def _save_invalid(folder: Path, errors, payload, raw) -> Path:
    stamp = _dt.datetime.now().strftime("%Y%m%dT%H%M%S%f")
    bad = folder / "handoffs" / f"invalid-{stamp}.json"
    _atomic_write(bad, json.dumps({"errors": errors, "payload": payload, "raw": raw},
                                  indent=2, ensure_ascii=False) + "\n")
    return bad


def _figures(folder: Path) -> dict:
    path = folder / "figures" / "figures.json"
    return json.loads(path.read_text()) if path.exists() else {}


def cmd_handoff(a) -> dict:
    """Save a handoff from a file, or (no file) the newest one ingest left pending.

    A second handoff for the same iteration (a correction, or more talk before review)
    replaces the saved one; the old files are kept as HO-n.rK.json and .md.
    """
    state = load_state(a.session)
    folder = session_dir(a.session)
    from_pending = a.payload is None
    if from_pending:
        pending = state.get("pending_handoffs") or []
        if not pending:
            raise BadInput("no pending handoff: ingest found none")
        payload = {k: v for k, v in pending[-1].items() if k != "_turn"}
        raw = json.dumps(payload, ensure_ascii=False)
        errors = validate(payload)
    else:
        try:
            raw = Path(a.payload).read_text()
        except (OSError, UnicodeDecodeError):
            raise BadInput(f"cannot read: {a.payload}")
        try:
            payload = json.loads(raw)
            errors = validate(payload)
        except ValueError:
            payload, errors = None, ["invalid JSON"]
    if not errors and payload["type"] != "SESSION_HANDOFF":
        errors = ["bad value: type"]
    if not errors and payload["session_id"] != state["session_id"]:
        errors = ["wrong session"]
    if not errors and payload["iteration"] < state["iteration"]:
        errors = ["bad value: iteration"]
    if errors:
        bad = _save_invalid(folder, errors, payload, raw)
        print(json.dumps({"error": "invalid handoff", "errors": errors, "saved": str(bad)}))
        sys.exit(2)
    hid = payload["handoff_id"]
    have = _figures(folder)
    needed = [f for f in _figure_ids(payload) if f not in have]
    target = folder / "handoffs" / f"{hid}.json"
    md = folder / "handoffs" / f"{hid}.md"
    replaced = None
    if target.exists() and json.loads(target.read_text()) != payload:
        k = 1
        while (folder / "handoffs" / f"{hid}.r{k}.json").exists():
            k += 1
        replaced = f"{hid}.r{k}"
        os.replace(target, folder / "handoffs" / f"{replaced}.json")
        if md.exists():
            os.replace(md, folder / "handoffs" / f"{replaced}.md")
    _atomic_write(target, json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    _atomic_write(md, render_handoff_md(payload))
    state["iteration"] = max(state["iteration"], payload["iteration"])
    state["last_handoff"] = hid
    if from_pending:
        state["pending_handoffs"] = state["pending_handoffs"][:-1]
    else:
        state["pending_handoffs"] = [h for h in state.get("pending_handoffs", [])
                                     if h.get("message_id") != payload["message_id"]]
    save_state(a.session, state)
    return {"handoff_id": hid, "iteration": state["iteration"], "json": str(target),
            "md": str(md), "replaced": replaced, "figures_needed": needed}


def cmd_figure(a) -> dict:
    if not re.fullmatch(r"VIS-\d{3,}", a.id):
        raise BadInput("bad value: id")
    if bool(a.path) == bool(a.failed):
        raise BadInput("give exactly one of --path or --failed")
    folder = session_dir(a.session)
    figures = _figures(folder)
    figures[a.id] = {"caption": a.caption, "text_equivalent": a.text_equivalent,
                     "source": a.source, "path": a.path,
                     "status": "failed" if a.failed else "saved",
                     "failure": a.failed, "at": now()}
    _atomic_write(folder / "figures" / "figures.json",
                  json.dumps(figures, indent=2, ensure_ascii=False) + "\n")
    return {"id": a.id, **figures[a.id]}


def cmd_transcript(a) -> dict:
    folder = session_dir(a.session)
    try:
        text = Path(a.file).read_text()
    except (OSError, UnicodeDecodeError):
        raise BadInput(f"cannot read: {a.file}")
    with open(folder / "transcript.md", "a") as f:
        f.write(f"\n\n## Capture {now()}\n\n{text.rstrip()}\n")
    return {"transcript": str(folder / "transcript.md"), "chars": len(text)}


# ---------- CLI ----------

class _Parser(argparse.ArgumentParser):
    def error(self, message):  # argparse errors are bad input too: JSON on stdout, exit 2
        print(json.dumps({"error": message}))
        sys.exit(2)


def build_parser() -> argparse.ArgumentParser:
    p = _Parser(prog="threeway.py", description=__doc__.splitlines()[0])
    sub = p.add_subparsers(dest="cmd", required=True, parser_class=_Parser)

    s = sub.add_parser("init", help="create a session folder and state.json")
    s.add_argument("--repo", required=True)
    s.add_argument("--task", required=True)
    s.add_argument("--mode", choices=MODES, default="blind")
    s.add_argument("--branch")
    s.add_argument("--date", help="YYYY-MM-DD, default today")
    s.set_defaults(fn=cmd_init)

    s = sub.add_parser("status", help="print state.json")
    s.add_argument("session")
    s.set_defaults(fn=cmd_status)

    s = sub.add_parser("mark", help="set a request's status")
    s.add_argument("session")
    s.add_argument("id")
    s.add_argument("--status", required=True, choices=REQUEST_STATUSES)
    s.add_argument("--note")
    s.set_defaults(fn=cmd_mark)

    s = sub.add_parser("log", help="append a decision, evidence or experiment entry")
    s.add_argument("session")
    s.add_argument("kind", choices=tuple(LOG_FIELDS))
    s.add_argument("--json", required=True)
    s.set_defaults(fn=cmd_log)

    s = sub.add_parser("set", help="change session fields")
    s.add_argument("session")
    s.add_argument("--chat-url")
    s.add_argument("--revealed", help="true or false")
    s.add_argument("--status", choices=("open", "closed"))
    s.add_argument("--title")
    s.add_argument("--bump-iteration", action="store_true",
                   help="add one to the iteration (a review round)")
    s.set_defaults(fn=cmd_set)

    s = sub.add_parser("ingest", help="extract new payloads from turns read off the page")
    s.add_argument("session")
    s.add_argument("turns", help="JSON file: list of turns")
    s.set_defaults(fn=cmd_ingest)

    s = sub.add_parser("handoff", help="validate and save a SESSION_HANDOFF payload")
    s.add_argument("session")
    s.add_argument("payload", nargs="?",
                   help="JSON file holding the payload; omit to save the newest pending one")
    s.set_defaults(fn=cmd_handoff)

    s = sub.add_parser("figure", help="record a captured figure or a capture failure")
    s.add_argument("session")
    s.add_argument("id", help="VIS-nnn")
    s.add_argument("--caption", required=True)
    s.add_argument("--text-equivalent", required=True)
    s.add_argument("--source", required=True, help="page message id the figure came from")
    s.add_argument("--path", help="saved image")
    s.add_argument("--failed", help="why the capture failed")
    s.set_defaults(fn=cmd_figure)

    s = sub.add_parser("transcript", help="append a captured text file to transcript.md")
    s.add_argument("session")
    s.add_argument("file")
    s.set_defaults(fn=cmd_transcript)
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    try:
        out = args.fn(args)
    except BadInput as e:
        print(json.dumps({"error": str(e)}))
        return 2
    print(json.dumps(out, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
