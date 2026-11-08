#!/bin/bash
# Remind Claude to prefer direct tools for simple lookups,
# but allow Explore agents through for genuine broad investigations.
# Previously hard-blocked Explore, which caused Claude to fall back
# to doing the same work in main context — defeating the purpose.
#
# Needs jq; without jq it prints one line to stderr and allows.
#
# Injects a directive into the Explore agent's prompt so the AGENT
# (not just the parent) knows to prefer Grep/Glob/LSP for directed searches.

command -v jq >/dev/null || { echo 'needs jq: https://jqlang.org/download/' >&2; exit 0; }

input=$(cat)
subagent_type=$(echo "$input" | jq -r '.tool_input.subagent_type // empty')

if [[ "$subagent_type" == "Explore" ]]; then
  directive="IMPORTANT: Use Grep/Glob/LSP directly for directed searches (specific class, function, or file) — they are faster and cheaper than broad file reads. Reserve broad exploration for when you genuinely don't know what you're looking for."

  # Rebuild tool_input with the directive prepended to the prompt.
  # updatedInput replaces tool_input entirely, so pass ALL fields through.
  updated_input=$(echo "$input" | jq --arg dir "$directive" \
    '.tool_input | .prompt = ($dir + "\n\n" + .prompt)')

  # Output both: additionalContext for the parent, updatedInput for the agent.
  jq -n --argjson ui "$updated_input" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      additionalContext: "EXPLORE CHECK: If this is a directed search (specific class, function, or file), cancel this agent and use Grep/Glob/LSP directly — it is faster and cheaper. Explore agents are for broad cross-directory investigations where you do not know what you are looking for.",
      updatedInput: $ui
    }
  }'
  exit 0
fi

exit 0
