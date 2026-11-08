#!/bin/bash

# Post-edit hook: tracks push-time compliance debt for {{PROJECT_NAME}}.
# When a source file is edited, records compliance update categories as required.
# When a compliance target file is edited, clears the matching category.
# Does NOT block edits — enforcement happens at push time (pre-push-check.sh).
# Fires on PostToolUse for Edit and Write tools.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

PROJECT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)}"
PROJECT="${PROJECT//\\//}"
PROJECT="${PROJECT%/}"
[[ -z "$PROJECT" ]] && exit 0
BRAIN="$(dirname "$PROJECT")/$(basename "{{BRAIN_PATH}}")"
DEBT_FILE="/tmp/claude-{{PROJECT_NAME}}-push-compliance"

# Determine REL_PATH within either repo, or "GLOBAL/<rest>" for paths outside.
REL_PATH=""
if [[ "$FILE_PATH" == "$PROJECT"/* ]]; then
  REL_PATH="${FILE_PATH#$PROJECT/}"
elif [[ "$FILE_PATH" == "$BRAIN"/* ]]; then
  REL_PATH="brain/${FILE_PATH#$BRAIN/}"
else
  # Allow global memory edits to clear memory-md debt even though they're outside the project
  REL_PATH="global:$FILE_PATH"
fi

# --- Clear compliance categories when their targets are edited ---

# Top-level CLAUDE.md edited → clear claude-md
if [[ "$REL_PATH" == "CLAUDE.md" ]]; then
  if [[ -f "$DEBT_FILE" ]]; then
    grep -v "^claude-md|" "$DEBT_FILE" > "${DEBT_FILE}.tmp" 2>/dev/null
    mv "${DEBT_FILE}.tmp" "$DEBT_FILE" 2>/dev/null
  fi
fi

# Brain CLAUDE.md edited → clear brain-claude-md
# fill: if the brain repo has more than one CLAUDE.md (e.g. a Phases/CLAUDE.md sub-sector doc),
# list each path this should clear on, one `[[ ... ]]` per path, OR'd together.
if [[ "$REL_PATH" == "brain/CLAUDE.md" ]]; then
  if [[ -f "$DEBT_FILE" ]]; then
    grep -v "^brain-claude-md|" "$DEBT_FILE" > "${DEBT_FILE}.tmp" 2>/dev/null
    mv "${DEBT_FILE}.tmp" "$DEBT_FILE" 2>/dev/null
  fi
fi

# fill: brain phase-doc edited (whatever this project's phase-doc path pattern is) → clear
# brain-phase-docs. Example pattern: brain/Phases/Phase\ [0-9]+/Phase\ [0-9]+\.md

# Agent memory edited → clear agent-memory
if [[ "$REL_PATH" == .claude/agent-memory/* || "$REL_PATH" == frontend/.claude/agent-memory/* ]]; then
  if [[ -f "$DEBT_FILE" ]]; then
    grep -v "^agent-memory|" "$DEBT_FILE" > "${DEBT_FILE}.tmp" 2>/dev/null
    mv "${DEBT_FILE}.tmp" "$DEBT_FILE" 2>/dev/null
  fi
fi

# Agent or skill prompt edited → clear agent-skill-prompts
if [[ "$REL_PATH" == .claude/agents/*.md || "$REL_PATH" == .claude/commands/*.md || "$REL_PATH" == .claude/skills/**/*.md ]]; then
  if [[ -f "$DEBT_FILE" ]]; then
    grep -v "^agent-skill-prompts|" "$DEBT_FILE" > "${DEBT_FILE}.tmp" 2>/dev/null
    mv "${DEBT_FILE}.tmp" "$DEBT_FILE" 2>/dev/null
  fi
fi

# Global MEMORY.md edited → clear memory-md
# The memory key is the repo's absolute path with / turned into -, so match on the name only:
# *-{{PROJECT_NAME}}/memory/MEMORY.md, whatever folder the projects live in.
if [[ "$REL_PATH" == global:*"{{PROJECT_NAME}}"/memory/MEMORY.md ]]; then
  if [[ -f "$DEBT_FILE" ]]; then
    grep -v "^memory-md|" "$DEBT_FILE" > "${DEBT_FILE}.tmp" 2>/dev/null
    mv "${DEBT_FILE}.tmp" "$DEBT_FILE" 2>/dev/null
  fi
fi

# Clean up empty debt file
if [[ -f "$DEBT_FILE" && ! -s "$DEBT_FILE" ]]; then
  rm -f "$DEBT_FILE"
fi

# --- Add compliance debt when source files are edited ---

add_debt() {
  local category="$1"
  local description="$2"
  if ! grep -q "^${category}|" "$DEBT_FILE" 2>/dev/null; then
    echo "${category}|${description}" >> "$DEBT_FILE"
  fi
}

# fill: this table is project-specific — one block per directory this project treats as
# load-bearing enough to owe a compliance update when touched. Model each block on:
#
#   if [[ "$REL_PATH" == <dir-glob> ]]; then
#     add_debt "<category>" "<what needs updating and why>"
#   fi
#
# A worked example of the pattern (not directory names to copy): a pure-core layer (heaviest
# debt — the architecture boundary itself), an adapters layer, a pipeline/orchestration layer,
# a versioned-prompt-template directory (version-bump reminder), a generated-API-client
# directory (contract drift), an agent-prompt directory (memory sync), and a brain Research
# folder (phase-doc staleness). Re-derive the list from THIS project's own
# {{ARCHITECTURE_BOUNDARY}} and layer conventions.

# Agent prompt edited → ensure memory reflects the new behavior
if [[ "$REL_PATH" == .claude/agents/*.md ]]; then
  add_debt "agent-memory" "Agent prompt changed — sync .claude/agent-memory/<agent>/MEMORY.md if behavior shifted"
fi

# --- Report remaining debt (informational, not blocking) ---
if [[ -f "$DEBT_FILE" && -s "$DEBT_FILE" ]]; then
  REMAINING=$(wc -l < "$DEBT_FILE" | tr -d ' ')
  echo ""
  echo "PUSH COMPLIANCE — ${REMAINING} update(s) required before git push:"
  while IFS='|' read -r category description; do
    echo "  → [${category}] ${description}"
  done < "$DEBT_FILE"
  echo ""
fi

exit 0
