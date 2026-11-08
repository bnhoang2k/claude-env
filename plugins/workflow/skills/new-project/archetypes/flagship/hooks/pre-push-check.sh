#!/bin/bash

# Pre-push hook: BLOCKS git push when push-time compliance updates are outstanding.
# Fires on PreToolUse for Bash tool. Only activates when the command is a git push.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only intercept git push commands
if ! echo "$COMMAND" | grep -qE '^\s*git(\s+-C\s+\S+)?\s+push'; then
  exit 0
fi

DEBT_FILE="/tmp/claude-{{PROJECT_NAME}}-push-compliance"

# No debt file or empty? Allow push.
if [[ ! -f "$DEBT_FILE" || ! -s "$DEBT_FILE" ]]; then
  exit 0
fi

REMAINING=$(wc -l < "$DEBT_FILE" | tr -d ' ')

echo ""
echo "BLOCKED — ${REMAINING} push-time compliance update(s) outstanding."
echo ""
echo "You MUST complete these updates before pushing:"
echo ""
while IFS='|' read -r category description; do
  echo "  x [${category}] ${description}"
done < "$DEBT_FILE"
echo ""
echo "Complete the updates above, then try git push again."
echo "Each update clears automatically when the target file is edited."
# PreToolUse blocks only on exit 2 (exit 1 is non-blocking noise)
exit 2
