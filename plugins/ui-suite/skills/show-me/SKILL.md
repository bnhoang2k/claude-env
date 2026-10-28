---
name: show-me
description: Use when the user asks for a picture instead of prose - "diagram", "visual", "show me", "widget", "big pictures, little words", "lay it all out and I'll choose", "so I can just glance and stop reading", "hard to follow". Also use before asking the user to choose between options that differ in how they look or what they produce (designs, sweep results, approaches), before a recap of overnight or workflow results, and when a findings or options explanation has already failed once in prose. Not for a concept with moving parts (use ui-suite:explain-as-machine), a finished figure for docs or a landing page (use figures:anatomy), or a plain flow diagram inside an Artifact page (use artifact-diagramming).
---

# Show me

## Overview
A thin router for quick visuals. It picks one of three presets and draws it inline in
chat. It does not restate the user's style rules. `ui-suite:ui-taste` holds those.

**Why:** People ask for big pictures with few words, so they can see and pick between choices at a
glance and stop reading. Pictures still fail when the whole is hard to follow, or when a stray number
sits in a corner with no stated meaning.

## Steps
1. **Load `ui-suite:ui-taste` before drawing.** Read principle 1 (Form speaks, words don't) and the
   section 6 line on explaining pages (quiet, near-white, hairline figures).
2. **Check where you are.** In a forked side session, do not render. The user cannot see a fork's
   widgets. Write the picture to an HTML file or a handoff, and say where it is.
3. **Pick one preset.**
   - **Results.** Real cases side by side: before and after, or a miss next to a hit.
     Label every number where it sits.
   - **Options.** Draw each option as its own picture. Pre-pick the one you recommend and
     mark it. A click sends the choice back with `sendPrompt`.
   - **Map.** Plans, sessions or tasks as nodes. Arrows show order and dependency. Colour
     shows state (done, running, waiting on the user).
4. **Use real data.** Take the cases, numbers and names from the real files, runs or plans.
   If a value is invented for the sketch, the legend says so.
5. **Draw it.** Call `mcp__visualize__read_me` once, with the module for your preset:
   Results uses `chart` or `data_viz`, Options uses `elicitation` and `interactive`, Map uses
   `diagram`. Pass platform `mobile` when the user follows from a phone. Then call
   `mcp__visualize__show_widget`. Inline is the default, because it shows in the chat with no
   extra click. Use the Artifact tool when the user says "artifact" or "page", or wants to keep
   or share the result.
6. **Check before you send.** Every number has a label. Every colour has a legend entry. Each
   picture matches the real data. For an inline widget, compare each number and colour in the
   code with the source data and the legend. For an Artifact or file, open it in the browser
   pane and take a screenshot.
7. **Say it in chat in one or two lines.** Name the recommendation if there is one. Do not
   repeat the picture in words.

## Presets in detail
**Results**
- Two or three columns, same scale, same axes. The hit sits next to the miss.
- A number has a label beside it. A bare figure in a corner is a failure.
- One line under each column says what to learn from it.
- When the picture holds a chart, also load `dataviz`.

**Options**
- Each card shows the outcome of that option, not a paragraph about it. Show problem, then
  fix, left to right.
- The recommended card starts selected, with a "recommended" tag. The user can change it.
- A click calls `sendPrompt("I pick <option name>")`. Keep one decision per picker.
- A picker replaces a prose menu. Do not also list the options in text.
- The picker's `sendPrompt` is the answer. Do not follow it with `AskUserQuestion`. Use
  `AskUserQuestion` alone, with no picture, when the options look the same and differ only in
  small facts (for example "current branch or a new one?").

**Map**
- Nodes are the plans or sessions. Edges are "waits for" or "hands off to".
- Put the node the user must act on in a distinct colour.
- For a morning recap, show what finished, what failed and what waits on the user.

## Good and bad
Good: three sweep results as three cards on one scale. Each card has its labelled score. The
best one is pre-picked. One chat line says why.

Bad: a dense grid with a "135" in the corner and no legend. The same options listed again in
three paragraphs beneath it.

## Common mistakes
| Mistake | Fix |
|---|---|
| Restating style rules here | Load `ui-suite:ui-taste`. Do not copy it. |
| An unlabelled number or colour | Label it in place, or add a legend entry. |
| An Artifact page when a chat widget would do | Inline first. A page only on request. |
| Rendering in a fork | Write a file or handoff. Say where it is. |
| Options drawn, then explained again in prose | The picture is the menu. Add one recommendation line. |
| An invented example shown as real data | Use real values, or say they are made up. |

## Not for
- A concept with moving parts (a queue, cache, state machine): use `ui-suite:explain-as-machine`.
- A finished figure for docs, a README or a landing page: use `figures:anatomy`.
- A plain flow or architecture diagram inside an Artifact page: use `artifact-diagramming`.
- A chart that stands alone, with no case-by-case story: use `dataviz`.
