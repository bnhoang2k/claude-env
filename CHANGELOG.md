# Changelog

## 0.2.16

The six motion skills and break-ui carry the 2026-11-13 fixes from emilkowalski/skills: stagger recipes with uneven gaps, the right AnimatePresence mode and Motion spring settings, current Vaul selectors, only `transform` and `opacity` counted as compositor-only, modals, drawers, sheets and toasts allowed past the 300ms cap, and a line-clamp recipe that works. `/ui-suite:taste` gains a `harvest` mode that finds the UI corrections from a session you never logged and runs each one you pick through `add`. Update the motion and ui-suite plugins to get them. In the workflow plugin, publish-public's blindness check no longer fails when the reviewer guesses a first name from your own login email.

## 0.2.15

The lint and break Stop hooks now accept a skip you pick on a question card. Before, only a typed "skip lint" or "skip break" counted, so agents kept asking you to type it. No folders or settings change. Update the ui-suite plugin to get the fix.

## 0.2.14

The folders that hold plans and specs now say "Planning", not "Superpowers". Three names change:

- The brain repo folder `Superpowers/` is now `Planning/`.
- The in-repo folder `docs/superpowers/` is now `docs/planning/`.
- The working folder `.superpowers/` is now `.planning/`.

Subfolder names (`specs`, `plans`, `Archive`) do not change. The name of the Superpowers plugin does not change.

To move an existing project:

1. Run `git mv docs/superpowers docs/planning`. In a brain repo, run `git mv Superpowers Planning`.
2. Run `mv .superpowers .planning`.
3. Update `.gitignore` so it lists `.planning/` in place of `.superpowers/`.
