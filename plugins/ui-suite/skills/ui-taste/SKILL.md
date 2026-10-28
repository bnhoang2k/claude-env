---
name: ui-taste
description: "Use before any UI/visual design work, in any project: building, restyling, or critiquing a web or native interface, creating an Artifact page, and whenever artifact-design or any taste-skill:* skill runs. The user's cross-project visual taste, mined from their corrections: 5 principles, a Never list, a ladder of attention (Quiet, Expressive, Immersive, Playable) with look and feel dials, and a gallery of references. Edit it with /ui-suite:taste."
---

# The user's UI taste

## 1. Principles

### 1. Form speaks, words don't
If layout, color or behavior says it, cut the words: obvious subtext, change logs, a clear-X where delete works, a second button where "are you sure" works. No hint lines or instruction headings; any why, even for a flagged state, goes in a hover card, row-end icon or (i). Captions only for a chart or readout. Metadata is smaller, grayer plain text: no decorative pills, chips, kind or monogram tiles, checkmarks, card-in-card borders. Done states dim. Clickable or status pills: size-capped, full text on hover. Row actions: small icon buttons, one style. Double-click edits in place, no edit button; click-out autosaves; Escape or blur exits; Save only before an expensive rerun. Pictures carry the story; words only label parts, plainly, never long lists. Explainers and nontechnical users: section 6.
Test: Delete every string. Bring back only those whose meaning is lost.
Check: ui-suite:lint-ui copy pass and `bannedCopy`.
Example: “like what is this man? its just redundant information”
Evidence: 47 sessions.

### 2. The frame holds still
Overflow scrolls inside a height cap; labels and legends stay pinned. A new element takes its siblings' slot, never appended below. Status areas are reserved. Reference and log pages fit the view or split into clicks or tabs, never infinite scroll. Live pages auto-update and keep scroll, open disclosures, edit state and selection; back returns to the item they left; no flash or reload spam. Never truncate text they read or navigate by. A persisting object morphs into its next state, onto the real output, never a restyled copy. A watched surface moves once per step, then holds, never scrolling while text types.
Test: Change data and state. Nothing jumps, reflows or loses scroll.
Check: ui-suite:break-ui.
Example: “the box extends below the limit instead of being a container that has scrolling text inside”
Evidence: 24 sessions.

### 3. Restraint, one accent
Saturation lives in the background or one small carrier; cards and panes stay muted. Decorations use the object's own palette; check a tint reads on its ground; match a reference's restraint. To make one thing pop, give it a richer color; never dim the rest. Glass only on floating chrome; static and reading surfaces stay solid. One motion emphasis per moment; no glow stacked on one that works; a lone glow may signal state. One hero decoration, not repeats; a one-feature page cuts what competes. Light shadows. A figure may color each category when a legend or hover names it.
Test: Squint. Exactly one thing pops.
Check: none.
Example: “the color is good but its too powerful on the cards. it should be muted like the picture above”
Evidence: 33 sessions + 2 doc sources + shelf study.

### 4. Order you can measure
Align text, not containers: items in a row or column share one text edge; a tint, edit fill or padded control bleeds past the column by its padding. An icon that would push the text off that edge, or hang outside its own container, moves to the text's other side. Labels clear lines and each other; text stays inside its box and the margins, print headers too. Fill wide surfaces with regions: tools tile dense controls; never a narrow centered column or one stretched element. Grids stay even: pick a column count that divides the items (four sections: 2x2, or 1x4 when very wide), never one alone on its own row. One selector style per surface; one pattern per job; one column per dimension; dependent options follow their parent instantly. Popovers: small, anchored inside their row; same-size options, current value omitted. Anything styled clickable is clickable. Hierarchy from weight and size. Tools: one sans, one mono, text ~12-14px, tight spacing, radii ~6-10px, rows ≥28px, buttons ≥24px square. Values are tokens grouped by function; no one-off hex. When the user asks for a landing page, portfolio, hero, demo or more wow, read section 6, Showcases.
Test: Overlay a grid. Every text edge, gap and size matches a token.
Check: ui-suite:lint-ui ruler and `text-edge.js`.
Example: “numbers are going over lines and over each other making it hard to read” · “ALIGN TEXT not containers.”
Evidence: 26 sessions + 13 sources, mostly docs + shelf study.

### 5. The screen tells the truth
Labels say what happened in human task words, never internal tags, symbols or enums. Timestamps are correct and readable. One name per thing in every view. Long work shows a status row or live stream (doing, sent, got back); terminals get a live bar or timed spinner. Recoverable actions fire on one click; a manual stop stays stopped until they retry. Only ambiguous, consequential input gets one "are you sure". Navigation never spends. A stateful tool they return to asks first. Signal on the item, not a loud block atop the pane; drop alarms that change no output; a page banner only when the whole page is stale. Draw things as what they are; metaphors obey physics; show where the human acts.
Test: Each label and state matches what the system did.
Check: none.
Example: “you'd have to figure out what i want first by asking”
Evidence: 26 sessions.

## 2. Never

- ASCII or Mermaid diagrams, unless they ask.
- Identical icon-heading-text card grids, cards as default container, a centered hero over a card grid.
- Gradient text, neon-on-black "AI tool" styling, "AI-POWERED" badges, side-stripe accents.
- Browser-default form controls; an unthemed popup or input reads as a bug.
- Em/en dashes or arrow glyphs in the user's voice or deliverables; use short, polite wording that flows.
- Re-pitching an approved look; inventing icons or buttons when approved ones exist.
- Motion that ignores reduce-motion; a static cue still shows the change.

## 3. The ladder

How much attention a page draws: a feel, never a kind of app; any app fits any rung. Each rung is the one below plus one thing. Pick the rung, open its gallery folder's liked pages, copy their feel, never their layout; then anything the principles allow. At every rung, polish alone earns a 3; an idea made for this page earns the 5.

1. Quiet: motion only confirms your touch, at once. Refs: Linear, Stripe, Notion, Attio. `gallery/1-quiet/`
2. Expressive: + every action answers with visible, well-timed motion. Nothing moves without a cause; new data may pop or write itself in. May carry rich infographics. Refs: Apple Liquid Glass; a how-it-works guide; anatomy; Bret Victor's explorable explanations. `gallery/2-expressive/`
3. Immersive: + motion is the page's ground, or scroll moves a camera that takes you in; motion in a box stays rung 2. It may move on its own, on an arc that lands; you choose when to go in and out. Ask first about 3D models. Refs: why.zero.university, Atlas Card; (Not Boring) Weather for a data app. `gallery/3-immersive/`
4. Playable: + one heavy object made for this page moves 1:1 with your input; a scroll scrub counts. Ask first. Refs: hancore.dev (the bar, never a template); Mini Moto. `gallery/4-playable/`

Two dials beside the rung, all three set on `<html>` with `data-rung`: look (`data-look`: quiet = one accent, calm layout, P3 holds; bold; loud) and feel (`data-motion`: calm, sleek, snappy, whimsical). Idle motion only at rung 3 and up. Every rung keeps interruptible motion, readable text and ui-suite:lint-ui.

Any rung may use, as loudly as it allows: show what changed ("was $40"; undo history when the app has one); link pictures, so touching one lights the matching parts of the others; let a change travel from its cause to its effects, in order.

## 4. How to use this

- The user's standing design rules, for every project and every Artifact. Apply it on top of taste-skill (github.com/Leonxlnx/taste-skill) or artifact-design; these design rules win over the design skill's defaults.
- Optional: taste-skill, installed as `taste-skill@taste-skill` (add its marketplace first: `claude plugin marketplace add Leonxlnx/taste-skill`). Without it, this file is the whole brief.
- taste-skill: `design-taste-frontend` for new public pages, `redesign-existing-projects` to restyle an existing page, `minimalist-ui` / `high-end-visual-design` / `industrial-brutalist-ui` as presets for a bold or loud look. It says not to trade substance for restraint; outside public pages, P3 wins on a quiet look. Never `full-output-enforcement` (it fights brevity) or `gpt-taste` (GPT/Codex only).
- Precedence: a project's own DESIGN.md or PRODUCT.md (its `## UI taste` section holds exceptions to this file) > this file > a design skill's defaults.
- Artifacts are usually single-viewer pages for the user: everything here applies. Pick the rung in section 3 first.
- Sections 1-3 are pasted in by the `ui-taste-inject` hook, and again after /compact. Sections 4-6 are read on demand.
- Evidence counts: "sessions" = distinct transcript sessions plus memory/DESIGN files recording the same point. "Doc sources" = design-doc text, not the user's corrections; several overlap common design-skill defaults. Sums over merged items may count one session twice.
- Where it lives: the user's live copy is `~/.claude/taste/`; read that first. If it is missing or empty, run `python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/seed_taste.py"` once to copy the plugin's starter into it. The starter at `${CLAUDE_PLUGIN_ROOT}/skills/ui-taste/` is read-only (a plugin update replaces it) and is the fallback when the live folder has no `SKILL.md`.
- To change it, use `/ui-suite:taste add|remove|list|overdrive|distill`. It edits only the live folder.

## 5. Process

Plain English, AskUserQuestion, ceremony sizing and blind review live in the always-on rules. These are the UI-specific steps.

1. **Walk it on the real target before "done."** Real device (iPhone Safari and Chrome), every host (Chrome, Claude app), published page, fresh machine, worst-case content, then the `ui-suite:lint-ui` skill; a page with an anatomy figure also runs anatomy's audit and lines.mjs. Worst case: 20 guests with 70 items, one item, empty, diacritics; lists scroll inside, numbers never truncate (method: `ui-suite:break-ui`). Check smoothness at real data volume (e.g. 400 queued rows with skip animations) and in Chrome, not just the preview pane; on glass-heavy pages check backdrop-filter cost (Real volume: 2 sessions). Confirm their running build is the one you changed and the new feature shows. Scripted motion (scroll walks, choreographed beats, morphs) gets a per-frame sampler at two viewport sizes (e.g. 1440x900 and 1280x800): report move counts for things meant to be still, fix layout shifts, long frames and objects that swap mid-flight. One watch-through is not proof; “smooth, sleek” is the bar. “i don't see the step 2b in its own thing? i thought that was the whole point of this?” (5.1: 10 sessions; 5.10: 1 session + 2026-10-08 ruling)
2. **Show the real thing, substance first.** Open a clickable local server or spike, not screenshots or prose. HTML mockups; diagrams for systems. Before asking the user to choose, draw it: problem then fix, left to right, real names inside; compare text side by side, not as counts. Build mockups from the current production page's structure, real content density, edge cases, readable text. A redesign moves placement and keeps all content. One master visual mockup before splitting UI into sub-phases. Pick the theme from each surface's scene sentence, never by reflex (e.g. "dark because it's a thinking tool"); if a product ships light and dark, maintain both fully. Settle content, structure and layout shape first; then a wide spread of distinct visual directions or an asset gallery. Structural changes get at least two options with plain tradeoffs. Autonomous runs pause after design/spike to brief the user before implementing. “don't send screenshots, just open up the server for me to click around and play around” “no like diagram the problem and proposed solns” “the current design works, it shows me what was sent and received; the information just needs to be better placed” “give me 10 different frontend-imaginations.” (5.2: 15, 5.4: 8, 5.5: 7 sessions)
3. **Approved designs and originals are contracts.** Port literally, reuse earlier decisions and components, dig up old specs instead of re-deriving. A port behaves exactly like its source (e.g. Pi kiosk to web/phone): no new flashes or broken assets. If layout differs by host or viewport (Claude app vs Chrome), tell the user up front. Keep the effect layer separate from function so chrome can be swapped (2 doc sources). A removal removes every instance, incl. empty/withheld states and later rounds, with no placeholder (e.g. a "click to add" spot); if an edge case would lose a capability, name the tradeoff in one line and let the user rule. Feedback lists: handle every lettered item, scan for unlisted issues, place each change exactly where their screenshot points. “WHAT IS THE REASONING BOX GET RID OF IT. i told you 5 times” “scan for others” “as long as you LITERALLY just copy it over exactly don't do any bs of inventing your own icons or buttons” “the pi didn't have this behavior.” (5.3: 9, Ports: 2 sessions)
4. **Design stack and research (web UI only).** Load the project's design skill first, if it has one, then artifact-design (for Artifact pages) or the taste ladder. Chain design skills they name. When a design hook flags findings, fix the code; don't suppress. Not for native SwiftUI. When UI bugs recur or the call is outside their expertise, fan out research before patching. UI agent briefs carry the layout constraints (fit one screen or navigate by clicks, no infinite scroll): the UI case of injecting standing rules into subagents. “Fix it so the hooks stop triggering, don’t ignore them” “we were just smokewalking and whack-a-moling.” “Remember to tell the agents to format the layout in a way that I don’t have to scroll” (5.6: 5, 5.7: 3, 5.8: 1 sessions)

## 6. Where the rest lives

- `gallery.md`: references, anti-references and approved work. Never injected. Search: `grep -iA3 "^- .*<tag>" gallery.md`, then read the 2-3 closest entries. Bold or loud results they keep go there tagged `overdrive`; they never edit the principles.
- Per-project exceptions: each repo's DESIGN.md, section `## UI taste` (at most 1,000 characters; the hook pastes it). An exception names the principle it overrides.
- `ledger.md`: append-only record of every `/ui-suite:taste` input, plus the verbatim pre-restructure snapshot (2026-10-11). `/ui-suite:taste distill` rebuilds the principles from it. Every quote and example the principles cut is there.
- `ui-suite:lint-ui` skill: measures the rendered page (copy pass, lintapple ruler, text-edge check).
- `ui-suite:break-ui` skill: worst-case data method.
- Precedence: project DESIGN.md/PRODUCT.md > this file > design skill defaults.
- Showcases (landing pages, portfolios, heroes, demos, "more wow"): breathe with empty space and large imagery; one focal object that moves, carried start to end; headline type with a voice (a display face, thin weight, or serif over a plain sans); phone heroes large, sharp, unsqueezed by side bars.
- Named examples and caveats, kept out of the injected text to save room:
  - P1: the hero-metric ban in some projects' docs is a common design-skill default, not a separate preference.
  - P1: load-bearing captions explain axis meaning or what's counted. Explainers show only what the app does, from one real run; mark invented data “(a made-up example)”. They cut lines about using the page itself, internal names, case-number trivia and dev-history stats. Words never sit as bullets under a chart; this covers drawings and reference sheets too, not only explainers.
  - P1, nontechnical users (moved from P1 by the 2026-10-15 size distill): paste in, result out; no terminals or surprise files; output opens itself; first run works on a fresh machine; their setup untouched.
  - P1, one session only (2026-09-24), not yet a rule: in a figure, the drawn part may be the control (hover lights its edges, click opens its link) in place of a parts list. The user asked for it once, for one parts list; the hover-glow part was a question. Promote it when a second session backs it.
  - P3: richer highlight colors, e.g. emerald or ruby. Some projects' docs ration warmth to earned moments.
  - P3, one session only (2026-09-24), not yet a rule: draw every variant at once; a toggle never moves shared parts. “the red wires jump around a lot between plan B and plan A.” Promote it (to P2 or P3) when a second session backs it.
  - P4 (moved from P4 by the 2026-10-15 size distill): on document-viewing surfaces the document is the hero; navigation collapses around it. One project's rubric viewer is the document-hero case (its notes are in ledger.md's snapshot). A media demo may be width-capped at a fixed aspect ratio (pi.dev).
  - P5: “how come when i go into a game, in says (game not receiving input.. despite it receiving input?)” Internal values that leaked as labels: "skipped", "(Master)", "exception", "other". The one "are you sure" case: a pipeline answer or rewrite note with no #X target. One click is fine even to kill a running task; Retry covers mistakes. Banners: tint the row or highlight the limitation; scratch work stays in the background; a whole-page banner fits when the whole page is stale (a setup wizard). Pictures: a program is code, not a hardware box; nothing pops into existence, belts run one way, paper isn't sliced by a seam; match the real setup (keyboard, mouse). Data rides drawn lines as dots: hand-offs travel along drawn connections, never as papers flying through the air; a save adds no objects, a brief light where the dots arrive is enough. On trust-building pages, each why names the failure it prevents (moved from P5 by the 2026-10-15 size distill), e.g. “so it cannot reword or skip one”.
  - P5: a user asked for a warning before a room switch that empties the room, though the switch can be undone (2026-10-11, from a summary, not their typed line). It is not yet a rule, and it does not count toward P5; P5 still says recoverable actions fire on one click.
  - Calm work pages, from the old kinds table: motion only conveys state; short noun labels; tabular mono numbers.
  - Explaining pages, from the old kinds table: quiet Apple, near-white, hairline figures; no themed world. 3+ steps: scroll walk. Dim to focus (overrides P3). Claim headings end in a period. One face, tabular figures. A newcomer's onboarding story. Term legend on request.
  - Explaining pages: Motion explains, never decorates. Claim heading example “Quotes are found, not trusted.”; open with a one-line thesis. Full look and craft numbers: gallery.md.
- Evidence per merged item, in the old numbering of the ledger snapshot. Only session counts were recorded; no item has a correction count.
  - Principle rulings dated 2026-10-08: 8.6 (P1), Continuity (P2), 8.4 and 8.10 (P5). The misalignment entry in `ledger.md` dated 2026-10-11 counts as one 2.14 session (P4).
  - P1: 2.1: 10, 2.4: 12, 2.8: 7, 8.3: 5, 8.6: 1 + ruling, One piece at a time: 5, Hide the machinery: 3, Edit in place: 4.
  - P2: 2.2: 10, 2.6: 9, Continuity: 2 + ruling, No truncation: 3. Real volume (2) counts in section 5 step 1 only. One Continuity session (8be9e1f7) answers a text proposal, not built UI.
  - P3: 2.5: 13, 2.10: 7, Ration decoration: 4, Glass: 7, Color per category in figures: 2; Shadows: 2 doc sources. The playful side of motion rests on one trip-planner quote, one request for over-the-top effects (2026-09-27), plus one project's PRODUCT.md.
  - P4 type: a voice means a display face, a thin weight, or a serif over a plain sans (style-likes study, 2026-10-16). Explaining pages keep one face.
  - P4: 2.7: 9, 2.12: 3, 2.14: 4, One selector style: 4, Scoped controls: 3; Type: 5 and Density: 3 doc sources; Tokens: 5 sources, incl. the user's own call on one project.
  - P5: 2.3: 9, 2.9: 7, 2.11: 6, 8.4: 3 + ruling, 8.5: 1; 8.10: ruling only. Two 8.4 sessions weigh low: 880512c4 is a cabinet drawing that had to match the real panels, and 8be9e1f7 answers a text proposal, not built UI.
  - Never: 2.13: 4 sessions; Reduce-motion: 3 doc sources; card grids: docs only, 0 direct corrections, overlaps common design-skill boilerplate.
  - The ladder (old kinds table): 8.1: 2, 8.12: 2, 8.2: 1 + ruling, 5.9: 1; 8.7, 8.8, 8.9, 8.11: ruling only; Theme (now in section 5, step 2): 3 doc sources.
  - Explainers are always the quiet Apple look plus hairline (2026-10-08). The Oct 2 "Season Record Book" themed showcase was a one-off; cure a clinical feel with motion and big pictures. 8.1: “hmm kinda boring. ... create an animation thats smooth, sleek, and showcases how it works” “the clinical look and feel makes it hard to follow and care”
