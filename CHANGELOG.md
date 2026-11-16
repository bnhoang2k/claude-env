# Changelog

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
