#!/bin/bash

# Pre-edit hook: injects domain-specific mistake reminders when editing high-risk files.
# Fires on PreToolUse for Edit and Write tools.
# Does NOT block — just adds context to the tool call.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.filePath // empty')

# Exit silently if no file path
if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

PROJECT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
PROJECT="${PROJECT//\\//}"
PROJECT="${PROJECT%/}"
[[ -z "$PROJECT" ]] && exit 0
BRAIN="$(dirname "$PROJECT")/$(basename "{{BRAIN_PATH}}")"

# Allow brain edits to also fire reminders (intentional cross-repo coverage)
if [[ "$FILE_PATH" != "$PROJECT"/* && "$FILE_PATH" != "$BRAIN"/* ]]; then
  exit 0
fi

REL_PATH=""
if [[ "$FILE_PATH" == "$PROJECT"/* ]]; then
  REL_PATH="${FILE_PATH#$PROJECT/}"
elif [[ "$FILE_PATH" == "$BRAIN"/* ]]; then
  REL_PATH="brain/${FILE_PATH#$BRAIN/}"
fi

# fill: this whole file is a project-specific glob → reminder-text table. Each block below
# fires a heredoc of reminder bullets when a path glob matches, then exits 0 so only the
# most-specific match fires. Re-derive the globs from THIS project's {{ARCHITECTURE_BOUNDARY}}
# and layer conventions — the example blocks below (pure-core layer, prompt templates,
# frontend) are illustrations of the PATTERN, not directory names to copy verbatim.

# --- example: pure/core layer — architecture-boundary reminder ---
if [[ "$REL_PATH" == src/core/*.py || "$REL_PATH" == src/core/**/*.py ]]; then
  cat <<'EOF'
CORE EDIT REMINDER:
- Banned: any import crossing the architecture boundary the wrong way (see {{ARCHITECTURE_BOUNDARY}})
- Banned: file I/O, network, subprocess, environment reads. If core needs config, pass it in
- Banned: print(). Logging happens at the boundary, not in core
- Required: type hints/types on everything, {{TYPECHECK_CMD}} clean
- Tests for core/ are MANDATORY and must run with no external dependencies
EOF
  exit 0
fi

# --- example: config/prompt templates — versioned template reminder ---
if [[ "$REL_PATH" == config/prompts/*.md ]]; then
  cat <<'EOF'
PROMPT TEMPLATE EDIT REMINDER:
- Bump the `version:` frontmatter field on substantive edits — it gets logged with every LLM call
- Prompts live in versioned template files read at call time, never hardcoded in source
- Keep the engine/prompt/identity layers separate — don't let one leak into another
EOF
  exit 0
fi

# --- example: frontend components/pages — strict TS + design-token reminder ---
if [[ "$REL_PATH" == frontend/src/*.tsx || "$REL_PATH" == frontend/src/**/*.tsx ]]; then
  cat <<'EOF'
FRONTEND EDIT REMINDER:
- Strict TypeScript. No `any` without a `// reason: ...` comment
- Server state via a query/cache library. No raw useEffect + fetch
- Functional components with hooks. No class components
- UI system: DESIGN.md "## UI system". ui-lock lint bans raw values and raw controls outside their homes
EOF
  exit 0
fi

# --- top-level screenshot dumps — gitignored, not committed ---
case "$REL_PATH" in
  *.png|*.jpg|*.jpeg|*.gif)
    if [[ "$REL_PATH" != *frontend/src/assets/* && "$REL_PATH" != frontend/public/* ]]; then
      cat <<'EOF'
SCREENSHOT EDIT REMINDER:
- Repo-root and stray PNG/JPG/GIF files are gitignored as a safety net. Don't commit screenshots — they drift from reality fast and bloat the repo
- For visual verification artifacts, use /tmp/{{PROJECT_NAME}}-screenshots/ (absolute path), never inside the repo
- Real image assets belong under frontend/src/assets/ or frontend/public/
EOF
      exit 0
    fi
    ;;
esac

# --- brain spec — the canonical project spec ---
if [[ "$REL_PATH" == "brain/$(basename "{{BRAIN_SPEC_PATH}}")" ]]; then
  cat <<'EOF'
BRAIN SPEC EDIT REMINDER:
- This is the canonical project spec. The architectural principles here are NON-NEGOTIABLE
- Treat changes here as load-bearing. If you're changing a principle, the corresponding code
  rules in CLAUDE.md need to change too
EOF
  exit 0
fi

exit 0
