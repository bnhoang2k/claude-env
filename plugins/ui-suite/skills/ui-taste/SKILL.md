---
name: ui-taste
description: "Use before any UI/visual design work, in any project: building, restyling, or critiquing a web or native interface, creating an Artifact page, and whenever artifact-design or any taste-skill:* skill runs. The user's cross-project visual taste, mined from their corrections: 5 principles, a Never list, a ladder of attention (Quiet, Expressive, Immersive, Playable) with a look dial, and a gallery of references. Edit it with /ui-suite:taste."
---

# The user's UI taste

## 1. Principles

### 1. Form speaks, words don't
If layout, color or behavior says it, cut the words: obvious subtext, change logs, a clear-X where delete works, a second button where "are you sure" works. No hint lines or instruction headings; a why goes in a hover card, row-end icon or (i). Captions only on a chart or readout. Metadata is smaller, grayer plain text: no decorative pills, chips, kind or monogram tiles, checkmarks, card-in-card borders. Done states dim. Row actions: small same-style icon buttons on hover at the text's far end, or a right-click menu; a whole-row click gets no chevron; rare lists and keys wait behind an icon, popover or switcher. Double-click edits in place; click-out autosaves; Escape exits; Save only before an expensive rerun. Pictures carry the story; words only label parts, plainly, never long lists.
Test: Delete every string. Bring back only those whose meaning is lost.
Check: ui-suite:lint-ui copy pass and `bannedCopy`.

### 2. The frame holds still
Overflow scrolls inside a height cap; labels and legends stay pinned. A new element takes its siblings' slot, never appended below. A card keeps one size across data: fixed slots, an empty one drawn as its shape, no height beyond them; a click opens the full view. Labels and metadata sit on one line in set-width boxes, cut, whole on hover; text read or navigated by wraps, leaving room for a badge. Status areas are reserved. A helper with nothing to say is not drawn (pager dots under two pages, an empty rail) but keeps its slot; empty content draws its shape, centered, idling subtly. Reference and log pages fit the view or split into clicks or tabs, never infinite scroll. Live pages auto-update and keep scroll, open disclosures, edit state and selection; back returns to the item left; no flash or reload spam.
Test: Change data and state. Nothing jumps, reflows or loses scroll.
Check: ui-suite:break-ui.

### 3. Restraint, one accent
Saturation lives in the background or one small carrier; cards and panes stay muted. Restraint is not plainness: give a bare gray surface one deliberate touch (a hued marker, muted tinted badge, logo or idle cue) within its signed-off siblings' sizes and chrome. Decorations use the object's own palette; check a tint reads on its ground. To make one thing pop, give it a richer color; never dim the rest. Glass only on floating chrome. One motion emphasis per moment; no glow stacked on one that works; a lone glow may signal state. One hero decoration, not repeats. Light shadows.
Test: Squint. Exactly one thing pops.
Check: none.

### 4. Order you can measure
Align text, not containers: a row or column shares one text edge; a tint, edit fill or padded control bleeds past it by its padding. Columns align by type: names left, money and rates right, counts and short values centered under their header at one even pitch. An icon that would push text off its edge or hang outside its container moves to the text's other side. Labels clear lines and each other; text stays inside its box and the margins; no scroller clips a ring, glow or hover lift. Size each box to its content on both axes; freed room goes to a neighbor or new region, never a gutter or a stretched element; bare canvas only when nothing belongs there. A card of only a control or two goes; they join the page header. Grids stay even: the column count divides the items, none alone on a row. One selector style per surface, one pattern per job, one column per dimension; dependent options follow their parent instantly. Anything styled clickable is clickable. Hierarchy from weight and size. Controls match their neighbors' size and weight: beside small icon buttons, Next or Finish is one too; badges stay compact; one light dropdown cue per app, no dark chevron; the primary stands out by color, not bulk. Tools: one sans, one mono, text ~12-14px, tight spacing, radii ~6-10px, rows ≥28px. Values are tokens grouped by function; no one-off hex.
Test: Overlay a grid. Every text edge, gap and size matches a token.
Check: ui-suite:lint-ui ruler and `text-edge.js`.

### 5. The screen tells the truth
Labels say what happened in human task words, never internal tags, symbols or enums. Timestamps are correct and readable. One name per thing in every view. Long work shows a live status (doing, sent, got back). Recoverable actions fire on one click; a manual stop stays stopped until they retry. Only ambiguous, consequential input gets one "are you sure". Navigation never spends. A stateful tool they return to asks first. Signal on the item, not a loud block atop the pane; drop alarms that change no output; a banner only when the whole page is stale. Draw things as what they are; metaphors obey physics; show where the human acts. Drag, never teleport: a knob follows the pointer, and a click never jumps it; a floor-and-ceiling range has two; rows reorder by drag, not arrow buttons; a file box takes drops, shaded with an icon while one hovers.
Test: Each label and state matches what the system did.
Check: none.

Section 6: explainers, nontechnical users, figures, popovers, showcases, refs per rung.

## 2. Never

- ASCII or Mermaid diagrams, unless they ask.
- Identical icon-heading-text card grids, cards as default container, a centered hero over a card grid.
- Gradient text, neon-on-black "AI tool" styling, "AI-POWERED" badges, side-stripe accents.
- Browser-default form controls; an unthemed popup or input reads as a bug.
- Em/en dashes or arrow glyphs in deliverables; use short, polite wording that flows.
- Re-pitching an approved look; drawing a control without naming the approved part it reuses, or saying none exists.
- Motion that ignores reduce-motion; a static cue still shows the change.

## 3. The ladder

How much attention a page draws; any app fits any rung. Each rung is the one below plus one thing. Pick the rung, open its gallery folder, copy the liked pages' feel, never their layout. At any rung, polish alone earns a 3; an idea made for this page, the 5.

1. Quiet: motion only confirms your touch, at once. `gallery/1-quiet/`
2. Expressive: + every action answers with visible, well-timed motion. Nothing moves without a cause; new data may pop or write itself in. `gallery/2-expressive/`
3. Immersive: + motion is the page's ground, or scroll moves a camera that takes you in; motion in a box stays rung 2. It may move on its own, on an arc that lands; you choose when to go in and out. Ask first about 3D models. `gallery/3-immersive/`
4. Playable: + one heavy object made for this page moves 1:1 with your input; a scroll scrub counts. Ask first. `gallery/4-playable/`

On `<html>` set `data-rung` and the look dial, `data-look` (quiet = one accent, calm layout, P3 holds; bold; loud). Idle motion from rung 3; below it only on ask, kept subtle: a slow echo of the entrance after idle seconds, never showy. Every rung keeps interruptible motion and readable text. Pace motion to be read, slower when unsure: ease over a visible span, count numbers up readably, let an idle effect last long enough to tell; a flash or snap reads as a glitch; motion never spills over a neighbor.

Kits. Motion feel and numbers come from the motion-kit example a page copies (`motion:use-motion-kit`), never a mood word or a guess; lit surfaces from paint-kit (`ui-suite:paint-surface`); 3D from model-kit (`models:build-models`).

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

1. **Walk it on the real target before "done."** Before showing a look, drive it the way the user will: reach each state by clicking through, never by opening the state directly, so its entrance motion gets seen; type the real input and commands; hover the rows; spam-click every repeatable action (skip, toggles) and watch for glitches. Real device (iPhone Safari and Chrome), every host (Chrome, Claude app), published page, fresh machine, worst-case content, then the `ui-suite:lint-ui` skill; a page with an anatomy figure also runs anatomy's audit and lines.mjs. Worst case: 20 guests with 70 items, one item, empty, diacritics; lists scroll inside, numbers never truncate (method: `ui-suite:break-ui`). Check smoothness at real data volume (e.g. 400 queued rows with skip animations) and in Chrome, not just the preview pane; on glass-heavy pages check backdrop-filter cost. Confirm their running build is the one you changed and the new feature shows. Scripted motion (scroll walks, choreographed beats, morphs) gets a per-frame sampler at two viewport sizes (e.g. 1440x900 and 1280x800): report move counts for things meant to be still, fix layout shifts, long frames and objects that swap mid-flight. One watch-through is not proof; “smooth, sleek” is the bar.
2. **Show the real thing, substance first.** Open a clickable local server or spike, not screenshots or prose. Ask about a look only once it shows: check with read_page or a screenshot that the exact page or story is in the browser pane; never ask from an ASCII preview or a word list, and a pick made from words stays provisional until the user has seen it built. Judge a token or part inside the real page it sits on, beside its real neighbors, reloading as it changes; a lone swatch or a mockup on a separate port earns only "fine" and settles nothing. Review one page at a time, top to bottom, before the next. At the desk use the pane, never the user's own browser; on the phone, one screenshot or recording per look, at the app's main width first. HTML mockups; diagrams for systems. When the subject is a video with many moving parts, a box diagram is not enough: cut one short looping clip per part from the video and show each clip under the label it is being sorted into, so the user sees what moves. Before asking the user to choose, draw it: problem then fix, left to right, real names inside; compare text side by side, not as counts. Build mockups from the current production page's structure, real content density, edge cases, readable text. Design every list for its huge case in the first proposal: ask what 1,000 items look like, bound its height and give a way to search, filter or jump; scrolling alone is not the answer, and no dropdown is unbounded. When asking for sign-off on a list or card, show the worst-case data next to the demo data. A redesign moves placement and keeps all content. One master visual mockup before splitting UI into sub-phases. Pick the theme from each surface's scene sentence, never by reflex (e.g. "dark because it's a thinking tool"); if a product ships light and dark, maintain both fully. Settle content, structure and layout shape first; then a wide spread of distinct visual directions or an asset gallery. Make at least one direction clearly bolder; three calm versions of one idea read as sterile. The bolder one still keeps its signed-off siblings' sizes, type and chrome. Label every option by number or letter, all on one page, so the user can cut them by label in one message. Structural changes get at least two options with plain tradeoffs. Autonomous runs pause after design/spike to brief the user before implementing.
3. **Approved designs and originals are contracts.** Port literally, reuse earlier decisions and components, dig up old specs instead of re-deriving. Before drawing any control (a button, select, calendar, chat, badge or dot strip), name the approved part it reuses; if none exists, say so in the proposal and build it in the project's component home. A port copies its source exactly; when the user says "like X", ask one question first: reuse X's exact part, or carry X's style fitted to the new content. A list of values gets a list control, never comma-joined text. Before asking for sign-off on a look, run each principle's Test line on it and fix what fails; build it only from the project's approved parts (its DESIGN.md) and name them in the question. If the user has to type /ui-taste, this pass was skipped. A port behaves exactly like its source (e.g. a kiosk app to its web version): no new flashes or broken assets. While on a page, rebuild every part built before the current look from the job it does, never by patching its styles, unless the user said it is fine; check the parts inside it in the same pass. Delete what is unused instead of making it prettier; two parts or pages that do one job become one place. If layout differs by host or viewport (Claude app vs Chrome), tell the user up front. Keep the effect layer separate from function so chrome can be swapped (2 doc sources). A removal removes every instance, incl. empty/withheld states and later rounds, with no placeholder (e.g. a "click to add" spot); if an edge case would lose a capability, name the tradeoff in one line and let the user rule. Feedback lists: handle every lettered item, scan for unlisted issues, place each change exactly where their screenshot points.
4. **Design stack and research (web UI only).** Load the project's design skill first, if it has one, then artifact-design (for Artifact pages) or the taste ladder. Chain design skills they name. When a design hook flags findings, fix the code; don't suppress. Not for native SwiftUI. When UI bugs recur or the call is outside their expertise, fan out research before patching. Run ui-suite:inspo-sweep without being asked when a look is rejected twice, or when a pattern has no precedent in the app; build the next option from what it finds. UI agent briefs carry the layout constraints (fit one screen or navigate by clicks, no infinite scroll): the UI case of injecting standing rules into subagents.
5. **Open a surface review on the live screen.** Show its current screen live in the pane, then ask what the user usually comes there to do. Never ask them to recall one past moment ("walk me through the last time").
6. **Looks first, backend later.** Every part or page that shows data has three data sets beside each other: empty, worst and normal. Where the real data does not exist yet, show the ideal with made-up content marked “(a made-up example)”, never a weaker stand-in (counts in place of the real changes). Real names and real numbers about the user wait for the backend. File each backend gap as a one-line issue and keep going on the front end.

## 6. Where the rest lives

- `gallery.md`: references, anti-references and approved work. Never injected. Search: `grep -iA3 "^- .*<tag>" gallery.md`, then read the 2-3 closest entries. Bold or loud results they keep go there tagged `overdrive`; they never edit the principles.
- Per-project exceptions: each repo's DESIGN.md, section `## UI taste` (at most 1,000 characters; the hook pastes it). An exception names the principle it overrides.
- `ledger.md`: append-only record of every `/ui-suite:taste` input, plus the verbatim pre-restructure snapshot (2026-10-11). `/ui-suite:taste distill` rebuilds the principles from it. Every quote and example the principles cut is there.
- `ui-suite:lint-ui` skill: measures the rendered page (copy pass, lintapple ruler, text-edge check).
- `ui-suite:break-ui` skill: worst-case data method.
- Precedence: project DESIGN.md/PRODUCT.md > this file > design skill defaults.
- Showcases (landing pages, portfolios, heroes, demos, "more wow"): breathe with empty space and large imagery; one focal object that moves, carried start to end; headline type with a voice (a display face, thin weight, or serif over a plain sans); phone heroes large, sharp, unsqueezed by side bars.