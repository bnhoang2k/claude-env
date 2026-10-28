#!/usr/bin/env python3
"""PreToolUse gate on Bash: Claude may not skip a repo's tracked git hooks.

Origin: a repo was headed for public release, and private names kept reaching its
code comments and commit messages. A memory rule did not stop it. The repo now runs a
leak check from tracked git hooks (.githooks/ pre-commit and commit-msg), which also
cover commits made without Claude. The only way past those hooks is to skip them, so
this gate denies the skip.

A repo is protected when it has a `.githooks/` folder at its top level, or a
`core.hooksPath` set in its git config. In a protected repo this denies:
  - `--no-verify` (or a unique prefix of it) on commit, push, merge, am, rebase,
    cherry-pick, revert
  - `-n` inside a short-flag cluster of `git commit` (`-n`, `-anm "msg"`)
  - `git -c core.hooksPath=...` on any git command
  - any env var assignment that mentions hooksPath (GIT_CONFIG_* overrides)
  - `git config` writes to core.hooksPath, except setting it to `.githooks`

Known gaps (not worth a parser): deleting or editing the hook files themselves,
running git through a wrapper script, and heredoc bodies outside $(...).
If the command cannot be parsed and mentions a bypass, the gate asks.

Set CLAUDE_HOOKS_GATE_DUMP=/path to append each payload for debugging.
"""

import json
import os
import shlex
import subprocess
import sys

VERIFY_SUBCOMMANDS = {"commit", "push", "merge", "am", "rebase", "cherry-pick", "revert"}
# git commit short options that take a value; the rest of the cluster is that value.
COMMIT_ARG_SHORT = set("mFcCt")
# git commit long options that take a value as the next token.
COMMIT_ARG_LONG = {
    "--message", "--file", "--author", "--date", "--template", "--reuse-message",
    "--reedit-message", "--fixup", "--squash", "--trailer", "--cleanup",
    "--pathspec-from-file", "--untracked-files",
}
# git global options that take a value as the next token.
GLOBAL_ARG = {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"}
OPERATORS = {";", "&&", "||", "|", "&", "\n", "(", ")", ";;", "|&"}

FIX = (
    "Do not skip the hooks. They run this repo's leak check (names, home paths, "
    "private links, emails, keys). Fix what the check reports and commit again. "
    "If the check itself is wrong, tell the user and fix the check in its own commit."
)


def respond(decision: str, reason: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision,
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def git_out(args: list) -> str:
    try:
        r = subprocess.run(["git", *args], capture_output=True, text=True, timeout=5)
        return r.stdout.strip() if r.returncode == 0 else ""
    except Exception:
        return ""


def protected(directory: str) -> bool:
    directory = os.path.expanduser(directory)
    if not os.path.isdir(directory):
        return False
    top = git_out(["-C", directory, "rev-parse", "--show-toplevel"])
    if not top:
        return False
    if os.path.isdir(os.path.join(top, ".githooks")):
        return True
    return bool(git_out(["-C", top, "config", "--get", "core.hooksPath"]))


def split_commands(command: str):
    """Yield (tokens) per simple command; None if the text cannot be parsed."""
    lex = shlex.shlex(command.replace("\n", " ; "), posix=True, punctuation_chars=";&|()")
    lex.whitespace_split = True
    try:
        tokens = list(lex)
    except ValueError:
        return None
    out, cur = [], []
    for t in tokens:
        if t in OPERATORS:
            if cur:
                out.append(cur)
            cur = []
        else:
            cur.append(t)
    if cur:
        out.append(cur)
    return out


def check_git(tokens: list, cwd: str):
    """Return a deny reason for one git invocation, or None."""
    i, directory = 1, cwd
    while i < len(tokens) and tokens[i].startswith("-"):
        t = tokens[i]
        if t in GLOBAL_ARG and i + 1 < len(tokens):
            val = tokens[i + 1]
            if t == "-C":
                directory = os.path.join(directory, os.path.expanduser(val))
            if t == "-c" and "hookspath" in val.lower():
                return directory, "git -c core.hooksPath overrides the repo's tracked hooks."
            i += 2
            continue
        if t.startswith("-c") and "hookspath" in t.lower():
            return directory, "git -c core.hooksPath overrides the repo's tracked hooks."
        i += 1
    if i >= len(tokens):
        return None
    sub, args = tokens[i], tokens[i + 1:]

    if sub == "config":
        keys = [a for a in args if a.lower() == "core.hookspath"]
        if keys:
            k = args.index(keys[0])
            rest = [a for a in args[k + 1:] if not a.startswith("-")]
            writes = any(a.startswith("--unset") or a in ("--replace-all", "--add") for a in args)
            if writes or (rest and rest[0] != ".githooks"):
                return directory, "Changing core.hooksPath turns off the repo's tracked hooks."
        return None

    if sub not in VERIFY_SUBCOMMANDS:
        return None
    j = 0
    while j < len(args):
        a = args[j]
        if a == "--":
            break
        if a.startswith("--no-veri") and "--no-verify".startswith(a.split("=")[0]):
            return directory, f"`git {sub} --no-verify` skips the repo's tracked hooks."
        if sub == "commit":
            if a in COMMIT_ARG_LONG:
                j += 2
                continue
            if a.startswith("-") and not a.startswith("--") and len(a) > 1:
                for pos, ch in enumerate(a[1:]):
                    if ch == "n":
                        return directory, "`git commit -n` is --no-verify and skips the repo's tracked hooks."
                    if ch in COMMIT_ARG_SHORT:
                        if pos == len(a) - 2:  # value is the next token
                            j += 1
                        break
        j += 1
    return None


def main() -> None:
    raw = sys.stdin.read()
    dump = os.environ.get("CLAUDE_HOOKS_GATE_DUMP")
    if dump:
        with open(dump, "a") as f:
            f.write(raw + "\n")
    try:
        data = json.loads(raw)
    except ValueError:
        sys.exit(0)
    command = (data.get("tool_input") or {}).get("command") or ""
    if "git" not in command and "hookspath" not in command.lower():
        sys.exit(0)
    cwd = data.get("cwd") or os.getcwd()

    commands = split_commands(command)
    if commands is None:
        low = command.lower()
        if ("--no-veri" in low or "hookspath" in low) and protected(cwd):
            respond("ask", "Could not parse this command, and it may skip the repo's tracked hooks. " + FIX)
        sys.exit(0)

    for tokens in commands:
        # Leading env assignments: VAR=value git ...
        k = 0
        while k < len(tokens) and "=" in tokens[k] and not tokens[k].startswith("-") \
                and tokens[k].split("=", 1)[0].replace("_", "").isalnum():
            if "hookspath" in tokens[k].lower() and protected(cwd):
                respond("deny", "An env override of core.hooksPath turns off the repo's tracked hooks. " + FIX)
            k += 1
        tokens = tokens[k:]
        if not tokens:
            continue
        head = os.path.basename(tokens[0])
        if head == "cd":
            target = tokens[1] if len(tokens) > 1 else "~"
            cwd = os.path.join(cwd, os.path.expanduser(target))
            continue
        if head in ("command", "exec") and len(tokens) > 1:
            tokens, head = tokens[1:], os.path.basename(tokens[1])
        if head != "git":
            continue
        hit = check_git(tokens, cwd)
        if hit and protected(hit[0]):
            respond("deny", hit[1] + " " + FIX)
    sys.exit(0)


if __name__ == "__main__":
    main()
