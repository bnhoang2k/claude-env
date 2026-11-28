# Data model and commit decision

One Artifact database per project. The dashboard page subscribes to every collection below.

| Doc | Shape | Written by |
|---|---|---|
| `meta/project` | `{schema: 1, project, purpose}` | setup, once |
| `plans/v<k>` | `{version, phases: [{id, name, outcome, measure, milestones: [{id, name}]}], reason, approved_by, approved_at, source}`, create-only | after owner approval |
| `direction/v<k>` | `{version, objective, decisions: [{text, status, source}], references: [evidence id], constraints, rejected, open_questions, source}`, create-only | after owner approval |
| `subplans/<phase id>-v<k>` | `{phase, version, chunks: [{id, name, outcome, measure, milestones?}], reason, approved_by, approved_at, source}`, create-only; `milestones` lists ids of the phase's milestones | the planning agent, after the owner approves that sub-plan |
| `pointers/plan`, `pointers/direction`, `pointers/subplan-<phase id>` | `{version: k}`, pinned update | with the new version, in one batch |
| `evidence/<id>` | `{id, title, asset_url, sha256, kind, status, task, phase, source, provenance, relevance, superseded_by}` | agents, setup |
| `claims/<task>` | `{task, phase, chunk?, name, kind, gen, owner, start, counter, status, lease_until, resume_kind, gens}`; a claim created as `waiting` carries `resume_kind` (default `quick`); `chunk` names a chunk of the phase's sub-plan | agents, pinned |
| `events/<task>-g<gen>-n<n>` | `{rid, task, phase, gen, n, writer, at, kind, text, name, milestone, evidence, setback_id, cause, blocker_id, decision, source}`, create-only | agents, in the report batch |
| `checks/<id>` | `{at, by, note}` | the live-refresh check only |
| `archive/<kind>-<item id>` | `{kind, item, at, by, through?, note?}`; `kind` is `needs_you`, `blocker`, `setback` or `discovery`; hides the item from Progress, History keeps it. For a blocker or setback, `through` is `{<task>: <newest covered event doc id>}`: a newer `blocked` or `setback` report of that item (a higher slot `n` in a listed task, or any report from an unlisted task) shows it again. No `through` covers every report | the owner or an editor, from the page |

Database rules: the page declares every collection `read: "view"`, `write: "admin"` (`CAPABILITIES` in `scripts/build_page.mjs`, repeated in `setup.md`). Agents and setup write as the owner's own account; the page writes only `archive`. A viewer with "can use" access cannot write anything.

Every record carries `source`: a commit, a file path with its hash, a handoff id, or a dated quote of the owner.

Limits: 25000 records per Artifact, 256 KiB per record, 50 writes and 1 MiB per batch.

## Sub-plans

The roadmap stays `plans/v<k>`. A large phase can link its own sub-plan: an ordered list of chunks, each a piece of the phase with its own outcome and measure.

- The pointer rule: the page reads the sub-plan version that `pointers/subplan-<phase id>` names, from doc `subplans/<phase id>-v<k>`. With no pointer, it reads the newest version of that phase.
- A new version is a new doc plus a pointer move, in one batch with the pointer pinned. Never edit a sub-plan doc. History and the Versions list keep every version.
- A claim with `chunk` sits under that chunk. Work with no `chunk`, or a `chunk` the current sub-plan does not name, stays under the phase. `chunk` never changes whether a report is valid.
- A phase is done by its own rule (all its work finished, its milestones done), with or without a sub-plan. In a done phase every chunk shows done.
- In the current phase, a chunk is done when all its work is finished and its milestones are done; a chunk with milestones but no work is done when its milestones are done. The first chunk that is not done is current, and it is the only current chunk on the page. The current phase's state reads "Chunk i of n".
- A planned phase has no current chunk: its chunks read "Not started", or "Parallel work" when they have work.

## Problems clear

A blocker leaves the page when every task it affects has sent `unblocked` with its `blocker_id`, or `done` or `release`. A setback is over when a `recovered` report carries its `setback_id`, or when every task it affects has sent `done` or `release`.

## Why a report is one batch

An agent that loses its claim must not leave a report behind. So one report is one `batch` of two writes: create the event, and update the claim, pinned with `if_version`. The tool applies a batch with a pinned entry all or nothing. If the claim moved on (takeover, release, done, another report), the pin fails and the event is not written either.

A claim keeps `gen` (raised by every takeover, reclaim after release, or reopen), `owner`, `counter` (the last report number, never reset) and `gens` (the closed generations: `{gen, owner, start, end, ended_by, at}`).

The page applies a second rule when it reads. It accepts an event only when the claim's generation covers it: the event's slot comes from its doc id, its writer is the generation's owner, its `n` is after the generation's `start` and not after its `end`, and no `done` or `release` event of that generation has a lower `n`. Anything else is kept out of the authoritative state and shown only in the technical details. This also covers an old-protocol writer, a buggy agent and an offline sync that raced a takeover.

## Lease and clocks

`quick` 15 minutes, `research` 45, `long` 120, `waiting` none. A held claim is free to take only when now is past `lease_until` plus one lease length of its kind. Both the page and `takeOver` compute `effective = min(lease_until, updatedAt + kindMax)` and call the claim free when `now > effective + kindMax`. `updatedAt` is the claim doc's server time (the page uses the time it first saw that version when the snapshot has none). The clamp means a writer clock hours ahead cannot hold a task forever.

## Waiting

`needs_you` with `decision.category` in `direction`, `scope`, `roadmap`, `creative` or `approval` shows in "Needs you". Any other category is routine and stays in the technical details. An owner question stays open until `answered`, `done` or `release` (or the owner archives it); later reports do not close it, and while it is open the task reads "Waiting on you", never "Free to take over". A waiting claim has no lease and any session can take it over with the owner's answer.

## The link file

`.claude-dashboard.json` at the repo root, committed: `{"schema": 1, "project": "<name>", "dashboard": "<the dashboard's Artifact link>"}`. It is not under `.claude/`, because many repos ignore that folder.
