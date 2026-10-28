#!/bin/bash

# Pre-push hook: ASKS for confirmation when push targets the default branch (main/master).
# Fires on PreToolUse for Bash tool. Returns permissionDecision="ask" so Claude Code
# surfaces a yes/no prompt to the user; otherwise allows the push to proceed normally.
#
# A written rule can be overlooked under context pressure; this hook fires on every
# push attempt. It needs jq; without jq it prints one line to stderr and allows.

command -v jq >/dev/null || { echo 'needs jq: https://jqlang.org/download/' >&2; exit 0; }

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only intercept git push commands
if ! echo "$COMMAND" | grep -qE '^\s*git(\s+-C\s+\S+)?\s+push'; then
  exit 0
fi

# Detect explicit branch targets in the command. Patterns covered:
#   git push origin main
#   git push origin master
#   git push origin HEAD:main
#   git push -u origin main
#   git push origin main:main
# Force-pushes get the same check as any other push to these branches.
if echo "$COMMAND" | grep -qE '\b(main|master)\b'; then
  jq -n --arg cmd "$COMMAND" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: ("Push targets a default branch. This hook asks before every push to a default branch."),
      additionalContext: ("CONFIRM: about to push to a default branch. Command: " + $cmd + "\n\nThis hook asks before every push to a default branch. An earlier approval does not carry forward.")
    }
  }'
  exit 0
fi

# Count positional (non-flag) args after `push`. If 2+, the command specifies an
# explicit remote+branch and the branch is NOT main/master (we already grep'd for
# those above), so the push is targeting a feature branch — allow it.
AFTER_PUSH=$(echo "$COMMAND" | awk '{
  for (i = 1; i <= NF; i++) {
    if ($i == "push") {
      for (j = i+1; j <= NF; j++) printf "%s ", $j
      exit
    }
  }
}')
NON_FLAG_COUNT=$(echo "$AFTER_PUSH" | tr ' ' '\n' | grep -v '^-' | grep -v '^$' | wc -l | tr -d ' ')

if [[ $NON_FLAG_COUNT -ge 2 ]]; then
  # Explicit "remote branch" form, branch is non-default. Allow.
  exit 0
fi

# Implicit push (`git push`, `git push origin`, `git push -u`). Resolve the target
# branch via the current local branch.
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
[[ -z "$CWD" ]] && CWD="$(pwd)"

# Pull -C target out of the command if present (overrides cwd)
GIT_C_TARGET=$(echo "$COMMAND" | grep -oE '\bgit\s+-C\s+\S+' | awk '{print $NF}')
if [[ -n "$GIT_C_TARGET" ]]; then
  CWD="$GIT_C_TARGET"
fi

CURRENT_BRANCH=$(git -C "$CWD" symbolic-ref --short HEAD 2>/dev/null || echo "")

if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
  jq -n --arg cmd "$COMMAND" --arg br "$CURRENT_BRANCH" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: ("Implicit push from default branch `" + $br + "`. This hook asks before every push to a default branch."),
      additionalContext: ("CONFIRM: implicit push from default branch `" + $br + "`. Command: " + $cmd + "\n\nThis hook asks before every push to a default branch. An earlier approval does not carry forward.")
    }
  }'
  exit 0
fi

# Push to a feature branch from a feature branch — allow.
exit 0
