#!/usr/bin/env python3
"""Write schemas/<type>.schema.json from threeway.py's field rules.

The schemas are reference copies for readers; threeway.py checks fields itself.
tests/threeway/test_schemas.py fails when they drift. Re-run this after changing the rules.
"""
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import threeway as t  # noqa: E402


def prop(rule):
    if isinstance(rule, tuple):
        return {"enum": list(rule)}
    if rule is int:
        return {"type": "integer", "minimum": 0}
    if rule is str:
        return {"type": "string", "minLength": 1}
    return {"type": "array"}


def schema(kind):
    props = {"protocol": {"const": t.PROTOCOL}, "type": {"const": kind},
             "session_id": {"type": "string"}, "message_id": {"type": "string"},
             "reply_to": {"type": "string"}}
    if kind in t.ID_PATTERNS:
        props["message_id"]["pattern"] = f"^{t.ID_PATTERNS[kind]}$"
    props.update({k: prop(v) for k, v in t.TYPE_FIELDS[kind].items()})
    required = list(t.ENVELOPE) + list(t.TYPE_FIELDS[kind])
    if kind == "SESSION_KICKOFF":  # optional: a rollover kickoff (see KICKOFF_OPTIONAL)
        props["continues_from"] = {"type": "string", "minLength": 1,
                                   "description": t.KICKOFF_OPTIONAL["continues_from"]}
        props["next_ids"] = {
            "type": "object", "required": ["REQ", "iteration"],
            "description": t.KICKOFF_OPTIONAL["next_ids"],
            "properties": {"REQ": {"type": "string", "pattern": "^REQ-[0-9]{3,}$"},
                           "iteration": {"type": "integer", "minimum": 0}}}
        props_dep = {"dependentRequired": {"continues_from": ["next_ids"]}}
    else:
        props_dep = {}
    if kind == "SESSION_HANDOFF":
        props["handoff_id"]["pattern"] = "^HO-[0-9]+$"
        for s in t.HANDOFF_SECTIONS:
            props[s] = {"type": ["string", "array"]}
        props["decisions"] = {"type": "array", "items": {
            "type": "object", "required": ["text", "status", "confirmed_by_user", "source"],
            "properties": {"text": {"type": "string"},
                           "status": {"enum": list(t.DECISION_STATUSES)},
                           "confirmed_by_user": {"type": "boolean"},
                           "source": {"type": "string"}},
            "if": {"properties": {"status": {"const": "confirmed"}}},
            "then": {"properties": {"confirmed_by_user": {"const": True}}}}}
        required += list(t.HANDOFF_SECTIONS)
    return {"$schema": "https://json-schema.org/draft/2020-12/schema",
            "title": f"{t.PROTOCOL} {kind}", "type": "object",
            "required": required, "properties": props, **props_dep}


def main():
    out = Path(__file__).resolve().parent.parent / "schemas"
    out.mkdir(exist_ok=True)
    for kind in t.TYPES:
        (out / f"{kind}.schema.json").write_text(json.dumps(schema(kind), indent=2) + "\n")


if __name__ == "__main__":
    main()
