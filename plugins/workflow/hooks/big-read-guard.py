#!/usr/bin/env python3
"""PreToolUse guard: deny full Reads of large code files; push toward
grep/LSP symbol lookup or ranged reads. Escape hatch: pass offset or limit."""
import json
import sys
from pathlib import Path

CODE_EXTS = {".py", ".ts", ".tsx", ".js", ".jsx", ".swift", ".rs", ".go",
             ".java", ".c", ".cpp", ".h", ".hpp", ".cs", ".rb", ".kt"}
MAX_LINES = 800

try:
    payload = json.load(sys.stdin)
except Exception:
    sys.exit(0)

if payload.get("tool_name") != "Read":
    sys.exit(0)

tin = payload.get("tool_input") or {}
if "offset" in tin or "limit" in tin:
    sys.exit(0)  # ranged read — conscious choice, allow

fp = tin.get("file_path", "")
p = Path(fp)
if p.suffix.lower() not in CODE_EXTS or not p.is_file():
    sys.exit(0)

try:
    with open(p, "rb") as f:
        lines = sum(1 for _ in f)
except Exception:
    sys.exit(0)

if lines <= MAX_LINES:
    sys.exit(0)

reason = (
    f"{p.name} is {lines} lines (~{lines * 10 // 1000}k tokens) — a full read of a file this "
    f"size rides the context-replay tax for the rest of the session. Grep for the symbol "
    f"you need and Read only that region, or re-Read with "
    f"offset/limit for the specific region. If you genuinely need the whole file, re-Read "
    f"with an explicit limit (e.g. limit={lines})."
)
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": reason,
    }
}))
sys.exit(0)
