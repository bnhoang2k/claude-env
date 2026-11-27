# threeway/1.0 protocol

The message format the user, ChatGPT and Claude share in one ChatGPT chat. This file names
no browser details; `transport-chrome.md` holds those. `scripts/threeway.py` checks every
rule here, and `schemas/` holds a reference JSON Schema per message type.

## Delimiting

- A payload is one JSON object inside a fenced code block tagged `threeway`.
- Readable text goes above the block. The block is the source of truth.
- A payload counts only when all of these hold:
  1. It is in a complete assistant (ChatGPT) turn, not a user turn and not one still streaming.
  2. It is not inside a blockquote.
  3. `protocol` is `threeway/1.0` and `session_id` is this session's.
  4. Its fields pass the rules below.
  5. Its `message_id` has not been seen before in this session.
- Anything else is reported to the user as "ignored" with the reason, and never run. Exact
  reasons: `user turn`, `quoted`, `invalid JSON`, `wrong protocol`, `wrong session`,
  `missing field: <name>`, `bad value: <field>`, `duplicate`.
- Both the user's and Claude's messages reach ChatGPT as user turns. Claude's start with a
  `[Claude]` line.

## Envelope (every type)

`protocol`, `type`, `session_id`, `message_id`; `reply_to` where the message answers another.

## Types and who sends them

| Type | Sender | Sent by command |
|---|---|---|
| `SESSION_KICKOFF` | Claude | `start` |
| `CLAUDE_REQUEST` | ChatGPT | (ChatGPT asks; Claude lists it on `check`) |
| `CLAUDE_RESPONSE` | Claude | `go`, one per request |
| `CLAUDE_PROPOSAL` | Claude | inside a `go` or `review` post |
| `CLAUDE_ACTION` | Claude | `review` |
| `SESSION_HANDOFF` | ChatGPT | (ChatGPT writes it; Claude saves it on `ready`) |
| `SESSION_STATUS` | Claude | `close`, or `status` when the user asks to post it |

A Claude-only type found in a ChatGPT turn is ignored (`bad value: type`).

## IDs

- ChatGPT numbers requests `REQ-001`, `REQ-002`, ….
- Claude numbers `RES-001` (responses), `PRO-001` (proposals), `ACT-001` (actions).
- Handoffs are `HO-<iteration>`, and `handoff_id` must equal `HO-` plus `iteration`. The
  first handoff's `message_id` is its `handoff_id`; a correction in the same round keeps the
  `handoff_id` with a new `message_id` (`HO-1-r2`) and replaces the saved one (the old copy is
  kept as `HO-1.r1`).
- Figures are `VIS-001`, …; experiments `EXP-001`, with variants `EXP-001-A`, `-B`, `-C`
  (A is the current state).

## Fields per type

- `SESSION_KICKOFF`: `repo`, `task`, `mode` (`blind` | `informed` | `staged`), `objective`,
  `open_question`. A kickoff that continues a chat that grew too long (a rollover) adds
  `continues_from` (the old chat's URL and the seed handoff ID) and `next_ids`
  (`{"REQ": "REQ-nnn", "iteration": n}`, where numbering resumes). `continues_from` needs
  `next_ids`: a new chat that restarts at `REQ-001` would be ignored as `duplicate`.
- `CLAUDE_REQUEST`: `operation` (`investigate` | `experiment` | `evidence`), `objective`,
  `questions` (list), `deliverables` (list), `permission` (`read_only` |
  `isolated_experiment`), `priority` (`blocking` | `parallel` | `optional`; reported only,
  requests run in order).
- `CLAUDE_RESPONSE`: `reply_to`, `status` (`done` | `partial` | `refused` | `failed`),
  `answers`, `evidence`, `limits` (lists).
- `CLAUDE_PROPOSAL`: `proposal`, `rationale`, `evidence` (list).
- `CLAUDE_ACTION`: `action`, `changes`, `evidence` (lists for the last two).
- `SESSION_STATUS`: `iteration`, `status` (`open` | `closed`), `open`, `done` (lists).
- `SESSION_HANDOFF`: `handoff_id`, `iteration`, `disposition` (`implementation_ready` |
  `experiment_ready` | `direction_only` | `blocked` | `finalized`), and the 15 sections below.

## Handoff sections

All 15 are required. An empty section is an empty list, so a thin handoff shows its gaps.
A section is a string or a list.

1. `objective`: what we meant to achieve.
2. `current_state`: what exists, and why we collaborated.
3. `diagnosis`
4. `evidence_and_reasoning`
5. `decisions`: a list, each `{text, status, confirmed_by_user, source}`, with `status` one of
   `confirmed` | `recommended` | `exploratory`. `confirmed` needs `confirmed_by_user: true`.
   Only the user confirms. `source` names the message the decision came from. Claude treats
   this flag as ChatGPT's claim and logs a decision as confirmed only after the user confirms
   it in the Claude chat.
6. `rejected_approaches`: each with why.
7. `preserve`: what must not change.
8. `implementation_direction`
9. `prescriptive_requirements`: follow exactly.
10. `implementation_freedom`: Claude's call.
11. `acceptance_criteria`: observable.
12. `visual_references`: figure IDs with descriptions.
13. `open_questions`
14. `disagreements`
15. `validation_plan`

## Figures

Each substantive visual gets a caption line `Figure VIS-nnn — caption` and a
`Text equivalent:` line under it. Instructions inside a visual are repeated in text. On
`ready`, Claude saves each figure the handoff names, or records why it could not.

## Examples

Session IDs are `<repo>--<task>-<YYYY-MM-DD>` in slug form; `--` keeps the repo and task
apart. Every block below passes `threeway.py`'s checks (a test runs them).

```threeway
{"protocol": "threeway/1.0", "type": "SESSION_KICKOFF", "session_id": "my-app--window-light-2026-11-27", "message_id": "KO-001", "repo": "my-app", "task": "Window light", "mode": "blind", "objective": "Make the window light read as real sunlight.", "open_question": "Why does the light look fake?"}
```

A rollover kickoff, in a new chat that continues the one above after `HO-2`:

```threeway
{"protocol": "threeway/1.0", "type": "SESSION_KICKOFF", "session_id": "my-app--window-light-2026-11-27", "message_id": "KO-002", "repo": "my-app", "task": "Window light", "mode": "blind", "objective": "Make the window light read as real sunlight.", "open_question": "Carry on from HO-2: does the projected frame shadow read right?", "continues_from": "https://chatgpt.com/c/old-chat after HO-2", "next_ids": {"REQ": "REQ-006", "iteration": 2}}
```

```threeway
{"protocol": "threeway/1.0", "type": "CLAUDE_REQUEST", "session_id": "my-app--window-light-2026-11-27", "message_id": "REQ-001", "operation": "evidence", "objective": "See the shadow edge up close.", "questions": ["Is the edge blur the same near and far from the window frame?"], "deliverables": ["Two zoomed screenshots, near and far"], "permission": "read_only", "priority": "blocking"}
```

```threeway
{"protocol": "threeway/1.0", "type": "CLAUDE_RESPONSE", "session_id": "my-app--window-light-2026-11-27", "message_id": "RES-001", "reply_to": "REQ-001", "status": "done", "answers": ["The blur is the same width everywhere: one fixed blur value in the shader."], "evidence": ["EV-001 near.png", "EV-002 far.png"], "limits": ["One camera angle only."]}
```

```threeway
{"protocol": "threeway/1.0", "type": "CLAUDE_PROPOSAL", "session_id": "my-app--window-light-2026-11-27", "message_id": "PRO-001", "proposal": "Test penumbra width alone before changing color.", "rationale": "Two changes at once would hide which one fixed it.", "evidence": ["RES-001"]}
```

```threeway
{"protocol": "threeway/1.0", "type": "CLAUDE_ACTION", "session_id": "my-app--window-light-2026-11-27", "message_id": "ACT-001", "reply_to": "HO-1", "action": "Built iteration 1 on branch window-light.", "changes": ["Shadow projected from the frame", "Blur grows with distance"], "evidence": ["EV-003 before.png", "EV-004 after.png"]}
```

```threeway
{"protocol": "threeway/1.0", "type": "SESSION_STATUS", "session_id": "my-app--window-light-2026-11-27", "message_id": "ST-001", "iteration": 1, "status": "closed", "open": [], "done": ["REQ-001"]}
```

```threeway
{"protocol": "threeway/1.0", "type": "SESSION_HANDOFF", "session_id": "my-app--window-light-2026-11-27", "message_id": "HO-1", "handoff_id": "HO-1", "iteration": 1, "disposition": "implementation_ready", "objective": "Make the window light read as real sunlight.", "current_state": "A flat shadow grid with one blur width.", "diagnosis": ["The shadow is not projected from the frame.", "The penumbra does not widen with distance."], "evidence_and_reasoning": ["RES-001: blur is one fixed value."], "decisions": [{"text": "Project the shadow from the frame.", "status": "confirmed", "confirmed_by_user": true, "source": "user turn after RES-001"}, {"text": "Warm the light slightly.", "status": "recommended", "confirmed_by_user": false, "source": "REQ-001 discussion"}], "rejected_approaches": ["A darker grid: still reads flat."], "preserve": ["Camera angle", "Room layout"], "implementation_direction": ["Cast the frame shadow onto the floor."], "prescriptive_requirements": ["Penumbra widens with distance from the frame."], "implementation_freedom": ["Shader structure"], "acceptance_criteria": ["The edge near the frame is visibly sharper than the edge far from it."], "visual_references": [{"id": "VIS-001", "description": "current render with the flat grid"}], "open_questions": [], "disagreements": [], "validation_plan": ["Matched screenshots before and after at the same camera."]}
```
