# Changelog

## 0.2.20

New skill `workflow:threeway`: you, ChatGPT and Claude work one problem together in a chat inside a ChatGPT project. Claude posts the kickoff, and reads the chat only when you say `check`, `go`, `ready`, `review`, `status` or `close` in Claude's own chat. ChatGPT asks for evidence or experiments in fenced `threeway` blocks; Claude runs one only after your `go`. On `ready`, ChatGPT writes a handoff, which Claude saves and builds from after your yes. It drives ChatGPT through Claude in Chrome, and ships the text for the ChatGPT project's instructions. Update the workflow plugin to get it.

## 0.2.19

New skill `motion:use-motion-kit`: whenever you ask for animation on a web page, web app or Artifact, it installs motion-kit (https://github.com/bnhoang2k/motion-kit) and follows the kit's own `AGENTS.md`, without asking first. The UI taste file no longer has the `data-motion` feel dial (calm, sleek, snappy, whimsical): a page's motion feel is the motion-kit example it copies. A short Kits note in the taste ladder now routes motion to motion-kit, lit surfaces to paint-kit and 3D to model-kit, so every UI session sees it. The taste starter was distilled to fit the hook's payload budget. Update the motion and ui-suite plugins to get them.

## 0.2.18

The lint and break Stop hooks now check only production UI. They skip test and story files, test and fixture folders, files outside a git repo, git-ignored files, and folders with no build manifest. The first time a new top-level folder gets UI edits, the hook asks once whether it is production or a prototype, and records the answer in that repo's `.claude/ui-gates.json`. Set `UI_GATES_SCOPE=all` to check everything, as before. The break gate now runs once per session from the main session, and reads its subagents' work there; it no longer fires on SubagentStop. A `git` command that names a UI file no longer counts as editing it.

New command `ui-check` (`plugins/ui-suite/skills/lint-ui/ui-check.mjs`) runs the lint and text-edge checks on a list of pages in one go, with its own local server. break-ui and lint-ui now say to run break-ui and its fixes first, then lint once. In the workflow plugin, the babysitter stamps each clean gates run with the git tree it checked, and skips re-running the gates on a merge whose tree already passed. Update the ui-suite and workflow plugins to get them.

## 0.2.17

New skill `ui-suite:paint-surface`: when you ask for a page that should look like real paper, cloth, water or glass under light, it asks first whether to paint the surface with paint-kit (https://github.com/bnhoang2k/paint-kit). On yes it clones and builds the kit, uses its `init` command (paint-kit 0.1.2 or newer) and follows the kit's own `AGENTS.md`. `workflow:overnight` is now listed in the README and REFERENCE. Update the ui-suite plugin to get the new skill.

## 0.2.16

The six motion skills and break-ui carry the 2026-11-13 fixes from emilkowalski/skills: stagger recipes with uneven gaps, the right AnimatePresence mode and Motion spring settings, current Vaul selectors, only `transform` and `opacity` counted as compositor-only, modals, drawers, sheets and toasts allowed past the 300ms cap, and a line-clamp recipe that works. `/ui-suite:taste` gains a `harvest` mode that finds the UI corrections from a session you never logged and runs each one you pick through `add`. Update the motion and ui-suite plugins to get them. In the workflow plugin, publish-public's blindness check no longer fails when the reviewer guesses a first name from your own login email.

## 0.2.15

The lint and break Stop hooks now accept a skip you pick on a question card. Before, only a typed "skip lint" or "skip break" counted, so agents kept asking you to type it. No folders or settings change. Update the ui-suite plugin to get the fix.

## 0.2.14

The folders that hold plans and specs now say "Planning", not "Superpowers". Three names change:

- The in-repo folder `docs/superpowers/` is now `docs/planning/`.
- The working folder `.superpowers/` is now `.planning/`.

Subfolder names (`specs`, `plans`, `Archive`) do not change. The name of the Superpowers plugin does not change.

To move an existing project:

1. Run `git mv docs/superpowers docs/planning`. In a brain repo, run `git mv Superpowers Planning`.
2. Run `mv .superpowers .planning`.
3. Update `.gitignore` so it lists `.planning/` in place of `.superpowers/`.
