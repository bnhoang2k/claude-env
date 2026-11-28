#!/bin/sh
# Print the project's dashboard link file and exit 0, or print "no dashboard" and exit 3.
# Order: the checkout's .claude-dashboard.json, then the same file on origin's default branch
# (read from the local remote-tracking ref, no network), then on the local default branch.
# It never reads a link file kept inside the git directory.
LINK=.claude-dashboard.json

top=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "no dashboard"; exit 3; }

if [ -f "$top/$LINK" ]; then
  cat "$top/$LINK"
  exit 0
fi

default=
if ref=$(git symbolic-ref -q refs/remotes/origin/HEAD 2>/dev/null); then
  default=${ref#refs/remotes/origin/}
elif git rev-parse -q --verify refs/remotes/origin/main >/dev/null 2>&1; then
  default=main
elif git rev-parse -q --verify refs/remotes/origin/master >/dev/null 2>&1; then
  default=master
fi

if [ -n "$default" ] && git show "origin/$default:$LINK" 2>/dev/null; then
  exit 0
fi

local_default=${default:-main}
if git show "$local_default:$LINK" 2>/dev/null; then
  exit 0
fi

echo "no dashboard"
exit 3
