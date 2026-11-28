#!/bin/sh
# SessionStart (startup): tell the session when the project has a live dashboard, with its
# link, so a worktree whose branch lacks the link file still gets it.
# Silent, and exit 0, in every other case. Reads only local git data.
root=${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}
find="$root/skills/project-dashboard/scripts/find_dashboard.sh"
[ -f "$find" ] || exit 0
if out=$(sh "$find" 2>/dev/null); then
  # Only a plain https link is echoed; anything else in the file never reaches the session.
  link=$(printf '%s\n' "$out" | sed -n 's/.*"dashboard"[[:space:]]*:[[:space:]]*"\(https:\/\/[A-Za-z0-9._~:\/?#@=%+-]*\)".*/\1/p' | head -n 1)
  if [ -n "$link" ]; then
    echo "This project has a live dashboard: $link. Report through workflow:project-dashboard."
  else
    echo "This project has a live dashboard. Report through workflow:project-dashboard."
  fi
fi
exit 0
