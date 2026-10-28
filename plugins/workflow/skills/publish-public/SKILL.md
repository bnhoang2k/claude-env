---
name: publish-public
description: 'Use when publishing or releasing a kit to its public repo ("publish my-kit", "release v0.2.0"), when making a new public repo, or when a kit needs the publish guards installed. Runs the checks, stages the public commits, and never pushes by itself.'
---

# Publish to a public repo

Each public kit has a private twin repo (the private repo that its public repo is exported from) and a separate notes repo. All code work happens in the twin. Specs, plans and research live in the notes repo, never in the twin: **a run fails when the twin has a `docs/` folder.** Move it to the notes repo first. The public repo gets only commits that this tool makes.

## When to use

- The user asks to publish or release a kit.
- The user asks for a new public repo.
- A kit repo must join the system.

## What you need first

Check these before the first run. Each missing one stops a run partway, after the slow steps.

- Node, and `pnpm` (https://pnpm.io/installation). The build step runs `pnpm install --frozen-lockfile`, `pnpm build` and `pnpm test` in a copy of the export.
- In the private repo, a `package.json` with a semver `version`, a `build` script and a `test` script, and no `prepare` script.
- `gitleaks` on the PATH (https://github.com/gitleaks/gitleaks#installing). The secret scan runs the `gitleaks` command on every file.
- The `claude` command (Claude Code's CLI), logged in, with access to the opus model. The blind reviewer runs `claude -p --model opus` (see "Cost").
- Five items in the config folder (see "Your config folder"): `deny/base.json`, `deny/base.samples.json`, `plants.json`, `identity.json` and `hooks/`. Without them a run stops with `no deny rules configured`.
- A `publish.json` in the private repo (see "A new repo joins"). `data/publish.json.example` shows the shape.

## The one command

Run a dry run first. It checks everything and stages nothing. It works before the public clone exists.

    node "${CLAUDE_PLUGIN_ROOT}/skills/publish-public/scripts/publish.mjs" <privateRepo> --dry-run

Then run the same command without `--dry-run`. A pass stages two commits and a tag in the public clone: the release on main, and the built `dist/` on the tag. With `"dist": false` it stages one release commit on main and tags it. The tool never pushes. A run fails if the exported `package.json` has a `prepare` script.

The reviewer reads only the files added or changed since public main, plus a seeded sample of 5 unchanged files. The sample grows when the plants need more room. On a first release every file is new, so it reads them all. It reads in batches of 40 files, one reviewer call each and three at a time, because one call over a few hundred files skims and misses plants. Add `--full` to read every file. Use it when the deny list, the review policy or the plant pool changed since the last release. The deny scan and gitleaks always read every file.

## Read the report

The report prints these parts in this order.

- Changes by folder: files added, changed and removed in the public repo.
- Checks: one line each. Any FAIL stops the run.
- Review: how many files the reviewer read, and whether it was a diff or a full review.
- Plants caught: the tool hides fake leaks in a copy. The reviewer must find all of them. A missed plant fails the run.
- Blindness check: the reviewer must prove it has no private context. A fail stops the run.
- Reviewer cost: what the review spent.
- Findings: problems that block the run. They come from gitleaks (secret scan), the deny list scan and the dist scan. Each has a file, a line and a reason. A binary file shows line 0. Fix the private repo, commit, and run again.
- Review findings: lines the reviewer judged private. They do not block, because a strict reviewer flags a different set of judgement calls on every run. Show them to the user with the push question. Fix any the user agrees with, and run again; a line the user accepts can get a waiver so later runs stop listing it.
- Plants the reviewer missed: the file and line of each fake leak it did not find.
- Waivers used: lines the user approved earlier.
- Last line: the result, or the push question.

The first line shows the seed. To repeat a run with the same plants, add `--seed N` to the command.

## Push rules

- Only a pass may be pushed.
- Ask the user at that moment. Quote the last line of the report. Wait for a clear yes.
- Push with: `git -C <clone> push origin main v<version>`
- The pre-push hook checks the stamps, the messages, the identity and the ref names. A refusal is final.
- If the user says no, or the hook refuses a push, run `node "${CLAUDE_PLUGIN_ROOT}/skills/publish-public/scripts/publish.mjs" <privateRepo> --unstage`. It drops the staged commits, the tag and their stamps. It keeps what the remote already has. Then run the tool again.
- Never use `--no-verify`.
- Never edit the public clone by hand.
- Never write a public commit message by hand. The tool writes them.

## A new repo joins

1. Make a separate notes repo for the kit, a sibling of the private twin. Move any `docs/` folder from the twin into it.
2. Add `publish.json` to the private repo and commit it (start from `data/publish.json.example`; replace every `example-org` and `Jane Example` value). The tool reads it from the last commit. It names the public remote, the clone path, `allow`, `keep`, `versionFrom` and `identity`, and may name an `exportHook`, `deny` and `dist`. It holds no other field: an unknown one fails the run. It holds no private names. The `identity` must equal `identity.json` in your config folder (see "Your config folder"). `deny` lists the deny sets to scan with, such as `["base", "kit"]`. It defaults to `["base"]`. Set `"dist": false` for a repo used straight from its source, such as a plugin marketplace: the build then only checks the repo, and a build that writes `dist/` fails the run. A `keep` pattern may not use braces, brackets, backslashes or extglobs.
   An `exportHook` is a committed command, as a list (`["node", "scripts/trim.mjs"]`), for files that publish only on a condition the allowlist cannot express. It runs without a shell in the committed tree, with nothing installed, and gets the export folder as its last argument. It may delete or rewrite exported files, never add one. Every check reads the trimmed export.
3. Run `node "${CLAUDE_PLUGIN_ROOT}/skills/publish-public/scripts/install-guards.mjs" dev <privateRepo>`.
4. Run `node "${CLAUDE_PLUGIN_ROOT}/skills/publish-public/scripts/install-guards.mjs" public <privateRepo>`. It clones the public remote if the clone is missing.
5. Each GitHub change (create, rename, visibility, settings) needs the user's yes.

The dev hooks scan staged lines and commit messages against the repo's deny sets. Both installs set `core.hooksPath`, and write `scripts-dir` in your config folder so the hooks find the scripts. The path holds the plugin version, so after a plugin update the hooks take the newest version folder beside it. A hook that finds no scripts refuses with `the publish tool moved: re-run install-guards`. That puts both repos under the hooks-bypass gate, so Claude cannot skip hooks there.

## Waivers

A waiver quiets one reviewer finding on one line, so it no longer shows under Review findings. It lives in `.publish-waivers.json` in the private repo. The tool reads it from the last commit, so commit it first. Each entry has the file, the `sha256` of the exact line, and a reason. Any edit to the line voids it. Add one only with the user's ok.

## Cost

<!-- Write money as "5.45 USD". Skill loading replaces a dollar sign before a digit with the skill's arguments. -->

The reviewer runs through the `claude` CLI. On a subscription plan the cost is plan usage and a few minutes per run; with an API key it is money. The report's "Reviewer cost" is the CLI's API-equivalent figure, a size gauge only. The review grows with the files it reads, at about 2 to 3 cents (API-equivalent) per file. Measured runs of a full review:

- A small kit (about 60 files): about 1 to 1.30 USD per run.
- A larger kit (about 200 files): about 5 to 6 USD per run.

A diff review reads the changed files plus the sample, so a small release costs a small fraction of a full one. Plan for more than one run. Each run plants new leaks, so one pass does not promise the next.

## Your config folder

Your personal data lives outside the skill, in `~/.claude/publish-public/` (or the folder named by `$PUBLISH_PUBLIC_HOME`):

- `deny/<set>.json`: the deny rules, one file per named set. `base` holds your name, email, private repos and projects. A set such as `kit` holds words only some repos must avoid.
- `deny/<set>.samples.json`: one sample line per rule. Each sample must hit its rule. A run fails if a rule has no sample.
- `plants.json`: the pool of fake leaks the blind reviewer must find.
- `identity.json`: the one public name and email.
- `hooks/`: the guard hooks, and `scripts-dir`, written by install-guards.
- `blind-markers.json` (optional): see "Blindness markers" below.

`data/deny.example.json`, `deny-samples.example.json`, `plants.example.json` and `identity.example.json` in this skill show the shape with neutral placeholders. Build the folder once, then edit the copies (never the examples in the plugin folder):

    D="${CLAUDE_PLUGIN_ROOT}/skills/publish-public/data"
    H="${PUBLISH_PUBLIC_HOME:-$HOME/.claude/publish-public}"
    mkdir -p "$H/deny" "$H/hooks"
    cp "$D/deny.example.json" "$H/deny/base.json"
    cp "$D/deny-samples.example.json" "$H/deny/base.samples.json"
    cp "$D/plants.example.json" "$H/plants.json"
    cp "$D/identity.example.json" "$H/identity.json"
    cp -R "$D/hooks/." "$H/hooks/"
    chmod +x "$H/hooks/dev/pre-commit" "$H/hooks/dev/commit-msg" "$H/hooks/public/pre-push"

A missing config folder or set stops the run with `no deny rules configured`.

### Blindness markers

Each run checks that the reviewer is blind: it asks the reviewer to repeat everything it was given before the question, and fails the run if the answer shows your private context. The check already looks for your deny rules and for the word `superpowers`. If your own session hooks or plugins print a recognisable phrase (a banner, a plugin name), list it in `blind-markers.json`: a JSON list of regular expressions, matched in any case. `data/blind-markers.example.json` holds one placeholder, `["MY-HOOK-BANNER"]`. Copy it to `blind-markers.json` and replace the placeholder with your own phrase. Without the file, only the built-in checks run.

To scan any folder by hand: `node "${CLAUDE_PLUGIN_ROOT}/skills/publish-public/scripts/deny.mjs" scan <dir> --sets base,kit`. It prints `file:line: rule` and exits 1 on a finding.

## Keep private

The deny sets and the plant pool are private files in your config folder. Never copy them, or any pattern or template from them, into any repo or message.
