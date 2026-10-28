---
name: taste
description: "Use when the user says /ui-suite:taste, \"add to taste\", \"remember I like/hate this look\", shares a design link or screenshot as inspiration, says they are bored of the look or want overdrive, asks to distill or prune their taste, or asks what is in their taste file. Edits the user's live taste folder, ~/.claude/taste/ (seeded from the ui-suite:ui-taste starter), and nothing else."
---

# /ui-suite:taste: edit the user's UI taste reference

## Usage

- `/ui-suite:taste add <complaint | url | screenshot>`
- `/ui-suite:taste add --project <repo> <rule>`
- `/ui-suite:taste overdrive [surface]`
- `/ui-suite:taste distill`
- `/ui-suite:taste list [principles|gallery|<repo>]`
- `/ui-suite:taste remove <principle number | gallery name | project rule>`

## Where the files live

The plugin ships a starter taste. It is read-only, because a plugin update replaces it. The user's live taste is `~/.claude/taste/`. Edit only the live folder.

Before the first edit, check the live folder. If `~/.claude/taste/` is missing or empty, run `python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/seed_taste.py"`. It copies the starter in, and it never overwrites a live folder that has files.

In `~/.claude/taste/`:

- `SKILL.md`: the five principles, the Never list, the ladder.
- `gallery.md`: references, anti-references, approved work. A screenshot of someone else's site never goes in a plugin or project folder; it goes in `~/.claude/taste/captures/<slug>/` (see "Captures").
- `gallery/<rung>/<slug>/`: pages the user liked (page.html, light.png, dark.png, notes.md), listed by rung folder in the ladder.
- `captures/<slug>/`: screenshots, frames and downloads of other people's sites. See "Captures" below.
- `ledger.md`: append-only record of every `/ui-suite:taste` input. See "The ledger" below.

Per-repo exceptions live in each repo's own DESIGN.md (root or `docs/`), in a `## UI taste` section of at most 1,000 characters. The `ui-taste-inject` hook pastes that section; a longer one is only pointed to.

`${CLAUDE_PLUGIN_ROOT}/skills/lint-ui/` (`ui-policy.json` and the scripts) is part of the plugin, not the live folder.

Never edit the starter under `${CLAUDE_PLUGIN_ROOT}/skills/ui-taste/`. A plugin update replaces it.

## The ledger

`ledger.md` has `## Pre-restructure snapshot` first and `## Entries` last. Append every new line at the end of the file. Never edit or delete a past line. The one allowed insertion is a `> superseded by <date>` line directly under the line it supersedes.

- Entry line: use the format in the `ledger.md` header. It ends with `routed: <P1-P5 | process | check | check (not enforced) | exception:<repo> | gallery | unrouted>`.
- Distill marker: it is also a line, not a heading: `- <date> · distill · rebuilt P1-P5`.
- Entries since the last distill: count only the `- ` lines under `## Entries`. Start after the last line that starts with `- ` and contains `· distill ·`. If there is no such line, count all `- ` lines under `## Entries`. The header text also contains `· distill ·`, so do not match it.

## add (complaint)

Every add writes exactly one ledger line, appended after routing.

Do these steps in order:

1. If the user's wording is vague ("likes clean UI"), ask one question to make it concrete.
2. Check for a contradiction. If the complaint contradicts a principle, show both in one AskUserQuestion before you write. Options: replace, scope it, or keep both with the condition that separates them.
3. Route the complaint. Pick one:
   - It is an instance of a principle. Sharpen that principle: better wording, a better `Example:`, `Evidence:` plus one. Route value: `P<n>`.
   - It is measurable. Resolve `~/.claude/taste` (`realpath`) and walk up to the folder that holds `plugins/ui-suite/`.
     - If `plugins/ui-suite/skills/lint-ui/ui-policy.json` exists there (a source checkout), add the rule to ui-suite:lint-ui (a `ui-policy.json` value, a `bannedCopy` phrase, or a script). Then cut the matching prose to "enforced by ui-suite:lint-ui". Route value: `check`.
     - Otherwise (a plugin-cache install, where a plugin update replaces the policy), write only the ledger line, with route value `check (not enforced)`. Tell the user the rule is recorded but not enforced. Add nothing to sections 1-3 of `SKILL.md`; the hook payload has no room.
   - It holds in one project only. Add an exception to that repo's DESIGN.md `## UI taste` section that says "overrides P<n>". Route value: `exception:<repo>`.
   - It is about how the work is done, not how a page looks. Sharpen ui-suite:ui-taste section "Process". Route value: `process`.
   - Never add a 6th principle. If nothing fits, the route value is `unrouted`. Tell the user.
4. Write it the way the file already reads. Use one concrete do or don't.
5. Append the ledger line with the user's words verbatim and the real `routed:` value.
6. Count the entries since the last distill. At 10 or more, tell the user a distill is due.

`/ui-suite:taste add --project <repo> <rule>` always takes the project route. If the repo's DESIGN.md has no `## UI taste` section, add one at the end; if the repo has no DESIGN.md, ask the user before creating one. Keep the section within 1,000 characters; `check_taste.py` and the hook enforce it.

## add (url or screenshot)

1. Create an entry in `gallery.md` in the fixed shape, one line plus indented fields: `- **<short name>** · <tags> · <link>`, then `  use when: <the situation it fits>`, `  take: <what to copy>`, `  not for: <where it fails, or nothing recorded>`. Keep each line short; the folder or link holds the detail.
   Put it under `## References` (someone else's work), `## Approved` (the user's own work) or `## Anti-references` (only one line: `  never: <what to avoid>`).
2. Record the plain URL as the entry's link. A capture never exports, so do not link one from `gallery.md`. If you also save a screenshot of someone else's site under `~/.claude/taste/captures/<slug>/` (see "Captures"), keep the pointer in a note inside that capture folder (`source.md`: the URL and the entry name), which stays private. Do not link a path that does not exist.
3. If `use when:` or `take:` is unclear, ask one question.
4. Add the tag `overdrive` when the user says it is for when they are bored or wants something bold.
5. Append one ledger line with `routed: gallery`.
6. Count the entries since the last distill. At 10 or more, tell the user a distill is due.

## Captures

A screenshot, frame, video or download of someone else's site goes in `~/.claude/taste/captures/<slug>/`, and nowhere else. Never write one into a plugin folder, `gallery/`, or a project repo. The public export always drops `captures/`.

If a project folder must hold a capture, append its path to that folder's `.gitignore` first.

A gallery folder carries `origin: own` or `origin: capture` in the frontmatter of its `notes.md`. The export hook strips every non-markdown file from a `capture` folder and stops on a folder with no origin.

## add --approved <rung> <folder>

For a page the user liked at a taste stop. `<rung>` is one of 1-quiet, 2-expressive, 3-immersive, 4-playable. Many pages may share a rung.

1. Copy `<folder>/page.html`, `light.png` and `dark.png` into `~/.claude/taste/gallery/<rung>/<slug>/`. `<slug>` is two or three lowercase words from the page's idea, joined by hyphens. If gallery.md already has an entry for this page, reuse its slug. Also copy any `model.mjs`, `truth.md`, `audit.mjs` and media the page loads, as the user ruled.
2. Write `notes.md` there. It starts with the frontmatter `---`, `origin: own`, `---` (a page the user built; `origin: capture` only for a copy of someone else's site), then a blank line. Then the date, the user's words when they liked it, the idea in one line, and its rung, look and feel. Then the line "Copy its feel, not its layout: take the behavior numbers below; do not copy its layout, content or colors." Then a "Behavior, not identity" sheet with the numbers given in the request, one line each: `- <name>: <number or n/a> (<command>)`.
3. Write the gallery.md entry under `## Approved`: `- **<name>** · <rung>, <look>, <feel>, <subject tags> · gallery/<rung>/<slug>/`, then `  use when:`, `  take:` and `  not for:`. If an entry with this link already exists (a re-approval), replace its folder files and update that entry in place; never add a second entry for the same folder.
4. Check that SKILL.md's ladder line for that rung names `gallery/<rung>/`. Add it only if it is missing; never add one link per page.
5. Append one ledger line with the user's words and `routed: gallery`.
6. Run "After any edit", but first show the user the files you changed and the entry text, and wait for them to approve.

## overdrive

1. Turn the look dial up (`bold` or `loud`, `SKILL.md` `## 3. The ladder`) at whatever rung the surface needs; overdrive is the look, not the rung. If the user names no surface, ask which.
2. Propose 2-3 directions. Draw on gallery entries tagged `overdrive`.
3. Build only the one the user picks. ui-suite:lint-ui still runs.
4. If the user keeps the result, add it to `gallery.md` under `## Approved`, tagged `overdrive`.
5. Overdrive never edits principles.

## distill

Run it when 10 or more entries have arrived since the last distill marker (see "The ledger"), or when the user asks.

1. Rebuild the five principles from all ledger lines. If the user keeps research notes on their taste, read those too. Do not edit the old principle text in place.
2. Flag any principle with no new evidence in 90 days. Propose a merge or a demotion.
3. Show the user the diff and the evidence counts in chat. Write only after they approve.
4. Append the marker line `- <date> · distill · rebuilt P1-P5` to the end of `ledger.md`.

## list and remove

- **list:** print the principle names, the gallery entry names grouped by section (Approved, References, Anti-references), and which repos' DESIGN.md files have a `## UI taste` section. With an argument, print that part in full.
- **remove:** delete the entry. Fix every reference to it elsewhere in the files. Removing a principle requires a distill.
- If more than one entry matches a remove request, show them and ask which.

## After any edit

1. Run `python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/check_taste.py" ~/.claude/taste`. It must print PASS. On FAIL, fix the cause first.
   - On a payload-budget FAIL or WARN, propose `/ui-suite:taste distill` to the user. Never trim principle text in place to make room. Rebuild, do not rewrite.
2. Do not reload anything. The hook and the ui-taste skill read `~/.claude/taste/` fresh.
3. Do not commit or push. If the user keeps `~/.claude/taste` under version control, their own rules say how.
4. Reply with the entry as written and its location, for example `principle 2` or `my-app DESIGN.md -> UI taste`. The `ui-taste-inject` hook picks up the change on the next design call in any session.
