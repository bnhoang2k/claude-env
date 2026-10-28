# claude-env

27 skills for Claude Code: build UI, motion, 3D models and technical figures, and run long
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
- Hook `lint-ui-gate`: after a UI edit, blocks the end of Claude's turn once if no passing lint-ui run covers the change. To skip it, write `skip lint` in your next message.
- Hook `break-gate`: after a UI or 3D edit, blocks the end of Claude's turn until the matching break skills have run once that session. To skip it, write `skip break` in your next message.
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

- `motion:steal-mechanism`: record how a site moves, measure it, and rebuild the motion frame by frame. It needs Claude Code's Workflow tool, `ffmpeg`, and Playwright or Puppeteer. Studying one reference costs 3.5 units and 4 agents at worst. Its intake mode also needs a clone of https://github.com/bnhoang2k/motion-kit with its dependencies installed (`pnpm install`, so `pnpm` from https://pnpm.io/installation), and a Node version inside the kit's `engines.node` range.

## Check 3D models

<!-- picture: a break-models finding -->

- `models:break-models`: turn a model around and list parts that float, sink, poke through or vanish.
- `models:break-scene`: check that a whole room makes sense: sizes, gaps, what stands where.

## Run many agents without waste

Big jobs fan out to many agents. Keep the cost known up front and the review honest.

- `workflow:workflow-fanout-budget`: cap agents, models and cost before a multi-agent run starts.
- `workflow:babysitter`: run several plans at once, one session each, and check every merge.
- `workflow:blind-panel`: send reviewers with no context at a plan or change, and compare what they find.
- `workflow:plan-review`: one reviewer reads a spec or plan against the real code before you build it.
- `workflow:llm-pipeline-spike`: test prompt or schema changes on a graded pipeline before trusting them.
- `workflow:prior-art-check`: before building a tool, check whether one already exists.
- Hook `agent-model-gate`: denies an Agent call that has no `model` set, so a subagent never inherits the costliest model by accident.
- Hook `workflow-tier-gate`: denies a Workflow script whose `agent()` calls have no `model`.
- Hook `subagent-bg-gate`: denies a test or build command that a subagent starts in the background, because its finish notice may never arrive.

Two switches add stricter checks to the two model gates. Both are off by default; set one to `1` or `true` to turn it on.

- `WORKFLOW_GATE_FABLE`: also deny a Fable-class model pin that has no `FABLE-APPROVED:` line in the prompt.
- `WORKFLOW_GATE_TIERS`: also deny a Workflow script that has no `// TIERS:` comment block.

Three guards trim waste and risk in agent work:

- Hook `big-read-guard`: denies a full Read of a code file over 800 lines. Pass `offset` or `limit` to read part of it.
- Hook `pre-explore-guard`: tells an Explore agent to use Grep and Glob for a directed search.
- Hook `test-edit-gate`: denies a subagent's first edit to an existing test file, so it must retry on purpose.

## Keep your place across sessions

Long work outlives one session. Pick it back up without re-explaining.

- `workflow:where-are-we`: mid-run status: is it stuck, is it done, what next.
- `workflow:handoff`: write a prompt that moves a task into a fresh session with nothing lost.
- `workflow:recall`: catch up on a project after time away.
- `workflow:writing-project-docs`: keep project docs in one shape: living docs edited in place, logs appended.
- `workflow:archive-plans`: file a finished plan and write what was done.
- `workflow:new-project`: scaffold a new project and its notes repo from templates.

## Publish safely

- `workflow:publish-public`: check a private repo for leaks and stage a public release. It never pushes by itself.
- Hook `name-lint`: warns when your name or email is about to enter a file that gets published. It stays silent until you build the `publish-public` config folder (see "Set up publish-public" in [REFERENCE.md](REFERENCE.md)).
- Hook `hooks-bypass-gate`: in a repo with tracked git hooks (`.githooks/`), denies a command that skips them, such as `--no-verify`.
- Hook `pre-push-confirm-main`: asks you before a `git push` to `main` or `master` (a command that starts with `git push`).
- Hook `abs-path-lint`: warns when an edit writes a home-folder path into a file; write a repo-relative path instead.

## Reference

Single groups, every skill, requirements and settings: see [REFERENCE.md](REFERENCE.md).

## License

MIT. See `LICENSE`.
