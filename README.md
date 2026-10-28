# claude-env

25 skills for Claude Code: build UI, motion, 3D models and technical figures, and run long
multi-agent jobs without losing the plan or the budget.

<!-- picture: a few things these skills made -->

## Use it

```bash
claude plugin marketplace add bnhoang2k/claude-env
claude plugin install bnhoang2k@claude-env
```

Then work as usual. Each skill loads when the task needs it, and the hooks run on their own. Call one by name, such as `/ui-suite:lint-ui`.

## Design with your taste

Claude builds UI from your principles and references, not its default look.

- `ui-suite:ui-taste`: your taste (principles, a never list, a gallery), read before any UI work.
- `ui-suite:taste`: add to it: "I like this", a screenshot, a link.
- Hook `ui-taste-inject`: pastes your taste in whenever a design skill loads or a UI file is edited.

## Check UI before it ships

<!-- picture: a lint-ui report and a break-ui worst-case toggle -->

Find what a screenshot hides: overlaps, bad data, drift between screens, fixes that break something else.

- `ui-suite:lint-ui`: measure a page for overlapping text, tiny buttons and low contrast.
- `ui-suite:break-ui`: feed a screen worst-case data (long names, emoji, zero items) and list what broke.
- `ui-suite:unify-ui`: find screens that build the same thing two ways, and merge them.
- `ui-suite:ui-iteration-guardrail`: list what must not break before a fix, and check it after each try.
- Hook `lint-ui-gate`: after a UI edit, stops Claude once at the end of its turn if no passing lint-ui run covers the change.
- Hook `break-gate`: after a UI or 3D edit, the matching break skills must run once that session.
- Tool `ui-lock`: installs lint rules in a React repo that refuse raw colors, sizes and buttons outside your design tokens and components.

## Explain with pictures

<!-- picture: an anatomy figure next to an explain-as-machine page -->

When prose is not enough, from a quick sketch to a finished figure.

- `ui-suite:show-me`: answer with a picture instead of a wall of text.
- `ui-suite:explain-as-machine`: draw how a system works as a machine you can watch run.
- `figures:anatomy`: a finished isometric figure for docs, a blog or a landing page.
- `figures:anatomy-reveal`: a real object as a page you can turn and take apart, plus a short reveal video.
- `figures:hairline-create`: a thin-line isometric figure that follows the pointer.

## Rebuild motion you like

<!-- picture: an original next to its rebuild -->

- `motion:steal-mechanism`: record how a site moves, measure it, and rebuild the motion frame by frame.

## Check 3D models

<!-- picture: a break-models finding -->

- `models:break-models`: turn a model around and list parts that float, sink, poke through or vanish.
- `models:break-scene`: check that a whole room makes sense: sizes, gaps, what stands where.

## Run many agents without waste

Big jobs fan out to many agents. Keep the cost known up front and the review honest.

- `workflow:workflow-fanout-budget`: cap agents, models and cost before a multi-agent run starts.
- `workflow:babysitter`: run several plans at once, one session each, and check every merge.
- `workflow:blind-panel`: send reviewers with no context at a plan or change, and compare what they find.
- `workflow:llm-pipeline-spike`: test prompt or schema changes on a graded pipeline before trusting them.
- `workflow:prior-art-check`: before building a tool, check whether one already exists.

## Keep your place across sessions

Long work outlives one session. Pick it back up without re-explaining.

- `workflow:where-are-we`: mid-run status: is it stuck, is it done, what next.
- `workflow:handoff`: write a prompt that moves a task into a fresh session with nothing lost.
- `workflow:recall`: catch up on a project after time away.
- `workflow:writing-project-docs`: keep project docs in one shape: living docs edited in place, logs appended.
- `workflow:archive-plans`: file a finished plan and write what was done.

## Publish safely

- `workflow:publish-public`: check a private repo for leaks and stage a public release. It never pushes by itself.
- Hook `name-lint`: warns when your name or email is about to enter a file that gets published.

## Reference

Single groups, every skill, requirements and settings: see [REFERENCE.md](REFERENCE.md).

## License

MIT. See `LICENSE`.
