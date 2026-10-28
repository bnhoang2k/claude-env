# claude-env

Give Claude Code a sense of taste, and the habits to check its own work.

<!-- picture: the same page before and after ui-suite -->

## What it does

Ask an AI coding tool for a screen and it guesses the look. It guesses again on the next screen.
Animations snap, 3D models float, and long jobs lose track of what they were doing.

claude-env gives the tool your taste and a set of checks. It builds from references you picked,
tests its work in a real browser, and tries to break it before it says "done".

## Use it

```bash
claude plugin marketplace add bnhoang2k/claude-env
claude plugin install bnhoang2k@claude-env
```

Then work as usual. The skills load when the task needs them.

## What's inside

- **ui-suite**: your visual taste, plus checks for layout, contrast and worst-case data.
  <!-- picture: a lint-ui report on a real page -->
- **motion**: study how a site moves, then rebuild that motion.
  <!-- picture: original and rebuild side by side -->
- **models**: catch 3D models that float, sink or poke through each other.
  <!-- picture: a break-models finding -->
- **figures**: interactive technical figures and product reveals.
  <!-- picture: an anatomy figure -->
- **workflow**: plans, hand-offs and status checks for long agent jobs.

## Make it yours

Run `/ui-suite:taste` and tell it what you like or hate. It keeps your taste in `~/.claude/taste/`.

## Reference

Single groups, every skill, requirements and settings: see [REFERENCE.md](REFERENCE.md).

## License

MIT. See `LICENSE`.
