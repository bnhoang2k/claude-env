# Set up a dashboard for a new project

Do this only when the owner asks. Ask which project the dashboard is for, and what its purpose is in one sentence.

1. Build the page: `node "${CLAUDE_PLUGIN_ROOT}/skills/project-dashboard/scripts/build_page.mjs" publish <out.html>` writes the single HTML file to publish, and prints the capabilities to declare.
2. Publish it with the `Artifact` tool as a new private artifact (load `artifact-capabilities` first). Declare exactly these capabilities (the same JSON `publish` prints):

```json
{
  "db": {
    "rules": [
      {
        "path": "meta",
        "read": "view",
        "write": "admin"
      },
      {
        "path": "claims",
        "read": "view",
        "write": "admin"
      },
      {
        "path": "events",
        "read": "view",
        "write": "admin"
      },
      {
        "path": "plans",
        "read": "view",
        "write": "admin"
      },
      {
        "path": "pointers",
        "read": "view",
        "write": "admin"
      },
      {
        "path": "direction",
        "read": "view",
        "write": "admin"
      },
      {
        "path": "evidence",
        "read": "view",
        "write": "admin"
      },
      {
        "path": "checks",
        "read": "view",
        "write": "admin"
      },
      {
        "path": "archive",
        "read": "view",
        "write": "admin"
      },
      {
        "path": "subplans",
        "read": "view",
        "write": "admin"
      }
    ]
  },
  "user": {},
  "assets": {}
}
```

   Every collection is then readable by viewers and writable only by the owner and editors. Agents write as the owner's own account, so nothing they do is refused; a viewer with "can use" access cannot overwrite a claim, an event or a pointer. Keep the Artifact link from the result.
3. Write `meta/project` with `ArtifactData`: `{schema: 1, project, purpose}`.
4. Upload the evidence the owner names as assets, and create an `evidence/<id>` record for each (see "Contextual evidence" in `SKILL.md`). Each record needs a `source`.
5. Write `plans/v1` and `pointers/plan` (`{version: 1}`) in one batch, after the owner approves the plan in chat. Set `reason`, `approved_by`, `approved_at` (the ISO time the owner approved) and `source` (the dated quote of the approval). Without `approved_at` the version sorts to the bottom of History. Write `direction/v1` and `pointers/direction` the same way when the owner has a direction.
6. Mint your writer id first, as `SKILL.md` Discovery step 5 says: `<worktree folder>-<6 random hex>`. For each open question the owner needs to answer, send one batch with two writes, the claim first. Write 1: `set` `claims/<task>` as `{task, phase, name, kind: "waiting", resume_kind: "quick", gen: 1, owner: <writer>, start: 0, counter: 1, status: "held", gens: []}`, with no `lease_until`. Write 2: `set` `events/<task>-g1-n1` as `{rid: <fresh random id>, task, phase, gen: 1, n: 1, writer: <writer>, at, kind: "needs_you", text, decision: {question, holds_up, options, category}, source}`. `category` is one of `direction`, `scope`, `roadmap`, `creative`, `approval`. Without this event the question never shows under Needs you. `resume_kind` (default `quick`) is the kind the claim returns to when the `answered` event arrives, so it gets a real lease. The claim is free to take with an answer.
7. Write `.claude-dashboard.json` at the repo root with the project name and the dashboard's Artifact link. Commit it on the default branch, so every worktree finds it.
8. Add `.claude/dashboard-outbox/` to the project's `.gitignore`.
9. Show the owner the allow rule meant to remove the first-write prompt (not yet confirmed to remove it in the desktop app). Add it to the project's `.claude/settings.json` only after the owner agrees:

```json
{ "permissions": { "allow": ["ArtifactData"] } }
```

10. Check it. From a second worktree of the repo, run `sh "${CLAUDE_PLUGIN_ROOT}/skills/project-dashboard/scripts/find_dashboard.sh"`: it prints the link file. Open the page: it reads Connected, the plan shows every phase, and Needs you lists each open question.
11. Tell the owner the dashboard's Artifact link, and that new sessions get a one-line hint at start with that link.
