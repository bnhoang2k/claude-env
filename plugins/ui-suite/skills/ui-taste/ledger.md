---
title: "ui-taste ledger"
type: ledger
created: 2026-10-11
---

# ui-taste ledger

Append-only. One line per input: `- <date> · <project> · <session8> · “verbatim quote” · routed: <P1-P5 | process | check | exception:<repo> | gallery | unrouted>`. Append every entry line and every distill marker line (`- <date> · distill · rebuilt P1-P5`) at the end of this file, under `## Entries`. `/ui-suite:taste distill` rebuilds the principles from this file plus any research notes the user keeps. Never edit past lines; mark a superseded line with `> superseded by <date>`.

## Pre-restructure snapshot (2026-10-11)

The full SKILL.md body (§1 to §8) and projects.md as they stood before the restructure, verbatim. Every fact the new files condensed is here.

### SKILL.md

```markdown
# The user's UI taste

## 1. How to use this

- The user's standing design brief, for every project and every Artifact. Apply it on top of /frontend-design, /impeccable or artifact-design; impeccable says the brief wins, and this is the brief.
- Precedence: a project's own DESIGN.md or PRODUCT.md > that project's section in `projects.md` (next to this file) > this file > a design skill's defaults.
- Artifacts are usually single-viewer pages for the user: everything here applies. Explainers (guides, showcases, explainer Artifacts) also follow section 8, and get a term legend when the user asks (2.4 exception). Personal artifacts start with vibe questions (5.9).
- Section 2 is ranked by corrections × sessions: top items are what Claude gets wrong most.
- "(N sessions)" = distinct transcript sessions plus memory/DESIGN files recording the same point. "(docs)" = rests on design-doc text, not the user's corrections; several overlap impeccable defaults.
- Loaded automatically by the `ui-taste-inject` hook. To change it, use `/ui-suite:taste add|remove|list`; the source is claude-env, and a hand edit in `~/.claude` is overwritten by the next `chezmoi apply`.

## 2. Defaults Claude keeps getting wrong (ranked)

1. **Cut what the UI already says or does.** Self-explanatory subtext, change-log lines in task lists, an edit button beside double-click editing, a clear-X when deleting the text works, two buttons where one plus "are you sure" works. Row actions are small icon buttons in one shared style, never spelled-out text buttons (review-app, model-app: “I don't like the buttons that (a) spell out what it does, maybe use icons”). Keep controls that do real work (“we have the check and X buttons perfectly usable”). “like what is this man? its just redundant information” (10 sessions; mostly review-app, backed by model-app, job-app and map-app records)
2. **Keep the frame fixed.** Overflowing containers get a height cap and scroll inside; labels stay pinned. A new element takes its siblings' slot, never appended below. In review-app each pane's status area is reserved and doesn't resize. Reference and log pages avoid long infinite scroll: fit the view or split behind clicks or tabs. “the box extends below the limit instead of being a container that has scrolling text inside” (9 sessions)
3. **Labels tell the truth in human task words.** Say what actually happened; no internal tags, symbols or enum values ("skipped", "(Master)", "exception", "other"). Timestamps correct and readable. One name per thing in every view (“make it so the parts share the same names”). “how come when i go into a game, in says (game not receiving input.. despite it receiving input?)” (9 sessions; mostly review-app, plus two arcade-app)
4. **Workspace and review pages stay implicit; details on hover.** No instructional headings or hint lines. Color and placement carry meaning; the why sits in a hover card or small row-end icon. A flagged state must still explain itself on hover. Exceptions: learning/explainer artifacts get a term legend when the user asks (prep-app: “with a legend for all the terms that I might’ve forgotten”); a caption stays visible when the page can't be read without it (job-app). “humans are not dumb to need text everywhere that explains whats happening” (12 sessions)
5. **Muted color, one accent.** Saturation lives in the background or one small carrier; cards and panes stay muted. Decorations use the object's own palette. Match a reference image's restraint; check a tint reads on its ground. To make one thing pop, make it richer, never dim the rest (explainers: 8.7). “the color is good but its too powerful on the cards. it should be muted like the picture above” (13 sessions)
6. **Live pages never lose your place.** Auto-update, no manual refresh; keep scroll, open disclosures, edit state, selection. Back from a detail view lands on the item they left. No white/dark flash, no visible reload spam. “if to scroll all the way down on the output it jitters and returns to the top” (9 sessions)
7. **Use the allocated space.** Fill wide surfaces with more regions or more tiled controls; never a narrow centered column or one element stretched into an empty bar. Media demos may be width-capped at a fixed aspect ratio (pi.dev). On phones, hero imagery is large and sharp, not tiny, low-res or squeezed by side bars. “have the right side column fill out its space. it has a lot of empty spacae.” (9 sessions)
8. **Quiet metadata.** No decorative status pills, tag chips, file-kind or monogram tiles, or decorative checkmarks. Metadata is smaller, grayer plain text; done states dim; radii ~6-10px; no card-in-card borders or side stripes. Exception: clickable or status-slot pills are fine, size-capped with full text on hover (review-app: “put a cap on pill size”). The blanket badge ban traces to one doc-app incident (2026-07-13) recorded in 3 files. “It feels like a card in a card. meaningless spacing.” (7 sessions)
9. **Make background work visible.** Long-running work gets a status row or live stream: what it's doing, what it was sent, what came back. Terminals too: a live bar or timed spinner. Silence reads as broken or slow. “cause right now i have no idea what if its working or not” (7 sessions)
10. **Motion matches the register.** Tools: motion only conveys state, quietly. One emphasis per moment; no glow/glint stacked on one that works (a glow is fine as the only state signal, e.g. job-app's glow ring). Personal browsing artifacts (trip planner) feel interactive, not plain scrolling. Showcases feature one thing (section 3, decoration). Playful side rests on one trip-planner quote plus dev-site PRODUCT.md. “Just scrolling up and down is boring. add more fun effects” (7 sessions)
11. **The user controls state changes.** Recoverable actions (job-app task kill) fire on one click, no confirm; a manual stop stays stopped until the user retries. Consequential, possibly ambiguous actions (review-app answer with no detected #X) get "are you sure". Navigation never spends. A stateful tool the user returns to asks what they want instead of silently resuming. “you'd have to figure out what i want first by asking” (6 sessions)
12. **Popovers small, anchored, themed.** A picker opens a small menu anchored to its pill, no native select. Same-size options, current value omitted, menu stays inside its row. Anything styled clickable must be clickable. “clicking the dropdown opens a huge thing at the bottom right hand corner.” (3 sessions)
13. **Generated text in the user's voice.** Text in the user's voice or for their deliverables (review-app deliverables, job-app cover letters and QA answers, their emails): no em/en dashes, no arrow glyphs; use wording that flows. Short, concise, polite. ("Tool voice, not persona" for AI features is an map-app doc rule; apply it there.) “basically we're forbidding arrows and want to use something that flows easier to substitute to it” (4 sessions)
14. **Things line up.** Items in a row or column share one edge. A label sits clear of lines and of other labels. Text stays inside its box and the page margins, print headers too. Check the rendered page with the `lint-ui` skill; a glance misses it. “in front end, there's always text misaligned” (a user, 2026-10-11) “numbers are going over lines and over each other making it hard to read” (3 sessions)

## 3. Broader principles (mostly design docs, few or no corrections)

- **Type (dev-site, job-app):** hierarchy from weight and size in one sans + one mono. Standalone comparable numbers: tabular mono in tools, tabular sans in explainers (8.9). Ask before adding a display face; reader-app's serif for verbatim quotes shows a role can justify one. (5 sources, docs)
- **Shadows:** restrained; never heavy a shadow to "make it pop". job-app: flat at rest, hairline borders, glow/lift only on state. map-app and reader-app Depth allow quiet resting elevation. (2 sources, docs)
- **Tokens:** design values live in tokens, grouped by function and codebase location, for uniformity (a user, map-app). No one-off hex in components (job-app, dev-site, map-app docs). dev-site only: author color in OKLCH, avoid pure #000/#fff. (5 sources)
- **Reduce-motion:** every animation honors it; movement goes, a static cue still shows the state change. Convention in job-app, map-app, dev-site docs, not voiced by the user. (3 sources, docs)
- **Theme:** pick from each surface's scene sentence, never by reflex ("dark because it's a thinking tool"). If a product ships light and dark, maintain both fully. (3 sources, docs)
- **Density:** tool UIs desktop-dense: UI text ~12-14px (11.5pt native-Mac in map-app), tight spacing, modest radii. Clickables trackpad-comfortable: rows ≥28px, buttons ≥32px square (job-app UI_LAWS). (3 sources, docs)
- **Ration decoration:** one hero decoration, not repeats (one dragon, statues "1 or 2 no more"). A page showing one feature cuts everything competing with it. Direct evidence arcade-app; job-app and map-app docs ration warmth to earned moments. Counter: trip planner wanted "more fun effects". “don't spam the dragons though, pick one or the other.” (4 sessions)
- **One selector style per surface** (no stacked tabs, dropdowns, chips, pills); one styled pattern per job app-wide. On document-viewing surfaces the document is the hero and navigation collapses around it (reader-app Rubric). “ONE document formatted nicely, switch easily in the same tab.” (4 sessions)
- **One piece at a time:** dense explanations and reviews (e.g. post-interview review) go part by part in plain words. job-app prep surfaces read under pressure: a glanceable board, not a list of story text. (3 sessions)
- **Ports:** the original is the spec; behave exactly like the source (e.g. Pi kiosk to web/phone), no new flashes or broken assets. If layout differs by host or viewport (Claude app vs Chrome), tell the user up front. “the pi didn't have this behavior.” (2 sessions)
- **Real volume:** the motion side of 5.1's worst-case check. Before handoff, check smoothness at real data volume (e.g. 400 queued rows with skip animations) and in Chrome, not just the preview pane. Glass-heavy pages: check backdrop-filter cost. (2 sessions)
- **Hide the machinery.** Tools for nontechnical people: paste in, result out. No terminals, no surprise files, output opens itself, first run works on a fresh machine without the user. Never touch their other setup. “i want it to be usable for nontechnical people. no pulling up terminals to do these things.” (3 sessions)
- **No truncation** of text the user reads or navigates by. Capped status pills fine if hover shows full text. (3 sessions)
- **Diagrams: hairline style, view per figure.** Default for every diagram on a page, guide or Artifact (not quick inline chat diagrams, which stay plain and may use red/green/gray meaning colors): thin non-scaling stroke (~0.9px), five tokens (plate, hi, edge, mid, lo), one highlight stroke, no per-figure colors, springs that answer the pointer. Pick the view per figure; isometric is not always wanted. Flow diagrams (map-app Codebase Map): boxes in flow order so a highlighted path reads straight left to right, no zigzag or backtracking; orthogonal, circuit-style edges with corners at 45° (dev-site, review-app guide). (1 session + 2026-10-08 ruling; 3 records)
- **Continuity, never a cut:** wherever an object persists, in tools too, it moves or morphs into its next state; never fade it out and fly a restyled copy in. A morph lands on something that clearly reads as the real output. A surface the user is watching moves once, at the start of a step, then holds; it never scrolls itself while text types. “i want the review page to change so it looks like a report” (1 session + 2026-10-08 ruling)
- **Effect layer separate from function** so chrome can be swapped. (2 sources)
- **Glass: best on floating chrome.** Liquid Glass is one of the user's clean-and-smooth references: toolbars, pills and panels over a vivid field. Long-reading surfaces stay solid (map-app, doc-app); prep-app's muted frosted drill cards are the exception. Washed-out or over-tinted: raise opacity or mute the tint. Laggy: check Chrome. “I want something clean, and smooth. apple's liquid glass is something that comes to mind.” (7 sessions)

## 4. Never do

- ASCII or Mermaid diagrams, unless the user explicitly asks.
- Identical icon-heading-text card grids, cards as default container, centered hero over a card grid. (docs only, 0 direct corrections; overlaps impeccable boilerplate)
- Gradient text, decorative glassmorphism, neon-on-black "AI tool" styling, "AI-POWERED" badges, side-stripe accent borders. "Decorative" matters: see §3 Glass.
- Browser-default form controls. An unthemed popup or input (reader-app's dark native select popup, review-app's white edit box) reads as a bug; use a themed control.
- Em/en dashes or arrow glyphs in generated prose or deliverable text (review-app deliverables; job-app candidate-voice prose).
- Re-pitching an approved look, or inventing icons and buttons when approved ones exist.

## 5. Process (ranked)

Plain English, AskUserQuestion, ceremony sizing and blind review live in the always-on rules; these are the UI-specific ones.

1. **Walk it on the real target before "done":** real device (iPhone Safari and Chrome), every host (Chrome, Claude app), published page, fresh machine, worst-case content (20 guests with 70 items, one item, empty, diacritics: lists scroll inside, numbers never truncate; method: `break-ui`), then the `lint-ui` skill. Confirm their running build is the one you changed and the new feature shows. “i don't see the step 2b in its own thing? i thought that was the whole point of this?” (10 sessions)
2. **Show, don't describe.** Open a clickable local server or spike, not screenshots or prose. HTML mockups; diagrams for systems. Before asking the user to choose, draw it: problem then fix, left to right, real names inside; compare text side by side, not as counts. “don't send screenshots, just open up the server for me to click around and play around” “no like diagram the problem and proposed solns” (15 sessions)
3. **Approved designs are contracts.** Port literally, reuse earlier decisions and components, dig up old specs instead of re-deriving. “as long as you LITERALLY just copy it over exactly don't do any bs of inventing your own icons or buttons” (9 sessions)
4. **Start from the real thing.** Mockups from the current production page's structure, real content density, edge cases, readable text. A redesign moves placement and keeps all content. One master visual mockup before splitting UI into sub-phases. “the current design works, it shows me what was sent and received; the information just needs to be better placed” (8 sessions)
5. **Substance first, then options.** Settle content, structure and layout shape; then a wide spread of distinct visual directions or an asset gallery. Structural changes: at least two options with plain tradeoffs. Autonomous runs: pause after design/spike to brief the user before implementing. “give me 10 different frontend-imaginations.” (7 sessions)
6. **Design stack (web UI only).** Load impeccable up front (job-app: with the design skill). Chain design skills the user names. When a design hook flags findings, fix the code; don't suppress. Not for native SwiftUI (see `projects.md`, music-app). “Fix it so the hooks stop triggering, don’t ignore them” (5 sessions)
7. **Research, not whack-a-mole.** When UI bugs recur or the call is outside their expertise, fan out research before patching. “we were just smokewalking and whack-a-moling.” (3 sessions)
8. **Layout constraints in UI agent briefs** (fit one screen or navigate by clicks, no infinite scroll): the UI case of inject-standing-rules-into-subagents.md. “Remember to tell the agents to format the layout in a way that I don’t have to scroll” (1 session)
9. **Personal artifacts (trip planner):** many vibe questions up front, concise research reports; big pictures, few words (8.3). “ask me lots of questions to make the vibe perfect.” (1 session)
10. **Sample frames before calling motion done.** Any scripted motion (scroll walks, choreographed beats, morphs) gets a per-frame sampler at two viewport sizes (e.g. 1440x900 and 1280x800) before "done". Report move counts for things meant to be still, and fix layout shifts, long frames and objects that swap mid-flight. One watch-through is not proof. “smooth, sleek” is the bar. (1 session + 2026-10-08 ruling)

## 6. References the user cites

- **Apple Liquid Glass:** frosted floating chrome. **Apple HIG:** source for native SwiftUI.
- **Attio:** crisp density, quiet metadata. **Folk:** warmth. **Linear, Stripe, Notion:** quiet, dense, trustworthy tools.
- **pi.dev:** scroll showcase, demo pinned top-left, narrow copy rail; measure it in the browser. **apple.com/mac-studio:** scroll-driven showcase.
- **shadcn/ui Button + lucide spinner:** review-app review-bar buttons. **Google Docs margin comments:** evidence on hover, pinned on click.
- **hairline (github.com/lucasmarkes/hairline, MIT):** default diagram style; their /hairline-create skill. Copy the stroke, tokens and spring motion, not the isometric view by default (3.Diagrams). **review-app how-it-works guide** (a how-it-works page): their exemplar explainer (section 8).
- **break-ui (emilkowalski, via ui-skills.com; catalog github.com/ibelick/ui-skills, MIT):** the worst-case data method behind 5.1: map every rendered value, build one plausible worst-case fixture, flip a dev-only Demo/Worst case toggle, report breaks with fixes, then stop.
- **lintapple (github.com/gholtzap/lintapple, MIT):** measures the rendered page against a policy: type scale, contrast, control spacing, alignment, overflow, banned hint phrases. Run it through the `lint-ui` skill.
- **Kahoot:** join by phone QR scan. **Real PCB routing:** diagram wiring. **The user's own reference images and hand-polished exemplars:** match literally.
- **Anti-references:** Notion/Coda corporate cards, ChatGPT chat-first UI, Roam/Tana/Obsidian "productivity-bro" styling, bento-grid AI-startup UI, LinkedIn/Indeed clutter, generic SaaS analytics, editorial-serif brand lane.

## 7. Contradictions

Resolved:

- **Dense vs. airy:** fill with whatever carries meaning. Tools tile dense controls; showcases use large imagery, few words.
- **Pills:** per project. doc-app and job-app ban them. Where used (review-app), a pill is a clickable control or live status slot, size-capped, full text on hover. Decorative metadata stays plain muted text; anything that looks clickable must be.
- **Glass vs. glassmorphism ban:** glass for floating chrome; static cards and reading surfaces solid (prep-app glass cards excepted; see §3 Glass).
- **Mute vs. enrich:** large surfaces muted; in tools the one highlight gets a richer color of its own (emerald, ruby), never dim the surroundings. Explainers dim to focus (8.7).
- **Banners and alarms:** signal on the item it is about (tint the row, highlight the limitation), never a loud block at the top of the pane. An alarm that doesn't change the output is removed, not restyled; scratch work stays in the background. A whole-page banner only when the whole page is stale (job-app wizard). “why not just highlight the limitation instead or something?” (review-app, 1 session)
- **Quiet vs. playful explainers:** always the quiet Apple look plus hairline (a user, 2026-10-08). The Oct 2 "Season Record Book" themed showcase was a one-off; cure a clinical feel with motion and big pictures (8.1, 8.3), not a themed world.
- **Confirm:** act instantly on one click, even killing a running task (Retry covers mistakes). One "are you sure" only for ambiguous input, e.g. review-app rewrite note with no #x target.
- **Fill canvas vs. width-capped pi.dev demo:** never stretch one element; split the width into regions.
- **"10 directions" vs. "no pick-a-card rounds":** substance first, then a wide visual spread.
- **Hover vs. visible captions:** visible when needed to interpret a chart or data readout (axis meaning, what's counted; job-app). Elsewhere, incl. setup hints on form rows, (i) icon with hover reveal (map-app, the user's pick).

Open:

- **Color alone.** DESIGN files: never convey meaning by color alone. review-app review page is "a color and a hover card, no legend, no labels"; the live-call wave waived its label. Proposed: color + hover text is fine for a single-user tool; ask before shipping a new surface.

## 8. Explainer register (guides, showcases, explainer Artifacts)

Pages that teach how something works, read top to bottom by scrolling (trackpad or wheel). Sections 2-7 still hold unless an entry here overrides them. The look is always quiet Apple: near-white ground, grey ramp, one blue, soft paper shadows, hairline figures. Exemplar: the review-app how-it-works guide.

1. **Show the mechanism moving.** A static box-and-line diagram reads as boring or clinical. Animate how the system works, beat by beat; the part doing the work looks alive. Motion explains, never decorates. “hmm kinda boring. ... create an animation thats smooth, sleek, and showcases how it works” “the clinical look and feel makes it hard to follow and care” (2 sessions)
2. **Scroll walk for 3+ steps.** Pin the picture; scroll picks the stop. Each stop gets about one screen (~92vh) of scroll so a flick or Page Down never skips one. One caption at a time beside one picture, swapping in place (old leaves ~.2s, new waits ~.18s). Under ~900px, unpin and show a chosen still frame. No “scroll to play” hints. (1 session + 2026-10-08 ruling)
3. **Big pictures, few words.** Drawings and reference sheets too, not only explainers. The picture carries the story; words only label or call out something in it, never fill space or sit as bullets under a chart. “Use words only when necessary not to fill space” (5 sessions)
4. **Pictures tell the truth.** Draw a thing as what it is: a program is code, not a hardware box. Physical metaphors obey physics: nothing pops into existence, belts run one way, paper isn't sliced by a seam. Show where the human acts (keyboard, mouse) and match the real setup. “it's not a literal server though is it ? it's like still code” (1 session + 2026-10-08 ruling)
5. **Data rides the wires; the scene holds still.** Hand-offs travel as dots along the drawn connections, never as papers flying through the air. A save adds no objects; a brief light where the dots arrive is enough. “pages shouldn't fly from the share to the server. make it dots that go the line.” (1 session)
6. **Only what the app does.** Cut lines about using the page itself, internal names, case-number trivia and dev-history stats. Use one real run's data; label anything invented “(a made-up example)”. “I want all explicit information thats unnecessary to the app removed” (1 session + 2026-10-08 ruling)
7. **Dim to focus.** In each beat the acting part stays at full strength and the rest dims. Overrides 2.5 for explainers only; tools still enrich. (2026-10-08 ruling)
8. **Claim headings with a period.** Section heads state the point as a short sentence (“Quotes are found, not trusted.”); open with a one-line thesis. Explainers only; tools keep short noun labels. (2026-10-08 ruling)
9. **Numbers in tabular sans.** Explainers keep one face with tabular figures; tools keep tabular mono (section 3, Type). (2026-10-08 ruling)
10. **Why lines name the failure they prevent.** On trust-building pages, each step's why says what it rules out (“so it cannot reword or skip one”). (2026-10-08 ruling)
11. **Radius says what it is.** Pictures of real paper stay near-square (2-3px); interface cards round softly; pills fully round. Never round a document picture like a card. (2026-10-08 ruling)
12. **A story a newcomer can follow.** The page reads top to bottom as onboarding, not a reference grid for an insider; place each section by its spot in that story. “Create the artifact assuming I'm an intern new hire trying to get up to speed” (2 sessions)
```

### projects.md

```markdown
# Project-specific UI taste

Per-project overrides and details for `SKILL.md`. The `ui-taste-inject` hook injects only the section whose heading matches the current repo name (worktrees resolve to their parent repo). A project's own DESIGN.md or PRODUCT.md still wins over its section here.

Heading = exact repo folder name. Add a project with `/taste add --project <name> ...`.

## review-app

- icon-only buttons; tiny gapless check/X buttons off the box corner; old text struck through in gray at full length; #X tags blue; category pills centered, color-coded; rows in workflow order with a sort toggle; AI text tinted inline on white; one continuous progress record; current run only; C/D builds gated behind "Build anyway".
- **remove (likely general):** remove every instance, incl. empty/withheld states and later rounds; no placeholder (e.g. "click to add" spot). If an edge case would lose a capability, name the tradeoff in one line and let the user rule. “WHAT IS THE REASONING BOX GET RID OF IT. i told you 5 times”
- **scoped controls:** one column per dimension; dependent-column options constrained by the parent classification, updating instantly. History/clock button scoped to its column (their responses) and current prompt (e.g. only 101-p3). “not like that i thought you were gonna split it by columns, but just have what's allowed tied to the clasiffication”
- **edit in place:** double-click edits text anywhere; click-out autosaves, no Save button; Escape or blur exits; edit field matches the page, never a raw white box; dropdown changes update dependent text instantly and are recorded as output. “there shouldn't be a save button, you just should click out and it remembers everything in there.” Exception: controls triggering an expensive rerun (p1 class and box dropdowns, which re-run p2/p3) keep an explicit Save.
- **feedback lists:** handle every lettered item, scan for unlisted issues, place changes exactly where their screenshot points. “scan for others”
- **templates:** fixed prose with narrow AI blanks in the letter's register, user-editable; review page is WYSIWYG.
- **in-use item:** the candidate printing in the letter is pale green with a solid edge, others amber; hover text alone is not enough. No provenance hover lines.
- **how-it-works guide:** section 8 exemplar. Its set pieces and patch-layer CSS stay here. New sections reuse its tokens, nav and hairline kernel. Light-only was an omission.

## job-app

- line tabs only; hero-plus-bento canvas, data-ink charts; load-bearing captions visible; wizard dark-first, two rails, no Skip, single indigo Apply; stale states dim but keep hue; kill ✕ fires on one click, History shows grey "Cancelled"; keep doom-fire flames unchanged.
- **analytics:** every aggregate shows its denominator; "not listed", "Unscored", "Unknown" buckets explicit; no vanity figure hides gaps. The hero-metric ban in job-app, dev-site and map-app docs is an impeccable default, not a separate the user preference.
- **Open: theme.** Code defaults dark on first paint (ThemeProvider) and the wizard plan accepted dark-first; DESIGN.md says "Light-primary with a fully maintained dark theme". Ask the user which is canonical before theming new job-app surfaces.

## arcade-app

- web port matches the Pi kiosk; games stay in the app shell; "Crafty Coder"-style placeholder names; coherent pixel scenes (anchored in clouds, same scale, facing the focal point, wispy layered clouds, coral/gold/navy). Menu-game transitions: no white flash or dark blink; on phones no side black bars squeezing the game.
- **art:** organic art (clouds, scenery) via an AI image generator driven through Claude in Chrome, matching the reference style. When procedural shapes look bad, switch instead of iterating on code (the user had earlier asked “can we make the clouds more bulbous?”). “no those clouds look horrid you might need to take it an throw it into the ai img thing”

## dev-site

- pi.dev layout; no modals; reject default fonts and editorial serif; motion is the default texture; choreographed phases run in sequence; test at 1920x1080.

## map-app

- tinted opaque body under a glass edge; custom metaphor, not three-pane chrome; ambient motes; symmetric settings rows.

## reader-app

- "Depth" identity; custom on-theme dropdowns.

## doc-app

- porcelain for what holds still, glass for what floats; crisp ground, aurora dimmed; margin-comment receipts.

## music-app

- skinnable tokens; the user's eye beats the notation textbook; enrich, don't dim. Native SwiftUI: no web design skills (frontend-design, ui-ux-pro-max), whose output “feels weak compared to everything on the internet”; use project DESIGN.md and Apple HIG. Consider the same for other SwiftUI projects.

## prep-app

- one-screen refresher sheets with equations, term legends, ELI5 text for a smart reader who forgot the details.

## model-app

- edit mode: drag pans the view by default; place and delete tools are armed on purpose. “We should make dragging to move around the default in edit mode. it shouldn't be auto set to placing a tile or deleting”
```

## Entries

- 2026-10-11 · claude-env · 7d799cbc · “in front end, there's always text misaligned” · routed: P4
- 2026-10-11 · (open) · — · Color alone: DESIGN files say never convey meaning by color alone; review-app review page uses color + hover card only; the live-call wave waived its label. Proposed: color + hover text is fine for a single-user tool; ask before shipping a new surface. · routed: unrouted
> superseded by 2026-10-14
- 2026-10-12 · review-app · — · “there shouldn't be a save button, you just should click out and it remembers everything in there.” · routed: P1 (moved from projects.md review-app; review-app specifics now in review-app DESIGN.md)
- 2026-10-12 · review-app · — · “not like that i thought you were gonna split it by columns, but just have what's allowed tied to the clasiffication” · routed: P4 (moved from projects.md review-app; review-app specifics now in review-app DESIGN.md)
- 2026-10-12 · review-app · — · “WHAT IS THE REASONING BOX GET RID OF IT. i told you 5 times” · routed: process (§5 step 3) (moved from projects.md review-app; review-app specifics now in review-app DESIGN.md)
- 2026-10-12 · review-app · — · “scan for others” · routed: process (§5 step 3) (moved from projects.md review-app; review-app specifics now in review-app DESIGN.md)
- 2026-10-13 · claude-env · e0fb7911 · “https://github.com/Leonxlnx/taste-skill i removed anthropics frontend design. can you reference this instead and incorporate that into our /ui-taste ? also get rid of /[plugin]:ui-ux-pro-max” · routed: unrouted (design-stack swap in §1, not a taste rule)
- 2026-10-15 · claude-env · 193f52c4 · “(no quote: structural change decided in research 04, part 1; plain-words rename per memory plain-words-not-shorthand.md)” · routed: unrouted (structure: pasted sections first; Registers renamed Kinds of page)
- 2026-10-15 · claude-env · 193f52c4 · “(no quote: two 2026-10-12 lines used the process route, which the header did not list; research 04, part 9)” · routed: unrouted (ledger header and /taste now list the process route)
- 2026-10-15 · claude-env · 193f52c4 · “(no quote: a setup question, the user chose delete; no reader-app repo found)” · routed: unrouted (removed projects.md reader-app; SKILL.md section 6 P4 line now points at the ledger snapshot)
- 2026-10-15 · claude-env · 193f52c4 · “record: commits 51b18ca, 34dff7b, 4a8cb85 edited ui-taste without /taste” · routed: unrouted (f800cd1 has its ledger lines)
- 2026-10-14 · arcade-app · — · “why not either have them (pre colored for the edges and have a legend) OR hover them” · routed: P3 (color per category in figures with a legend or hover; research 04, part 4; settles the 2026-10-11 Color alone open line)
- 2026-10-15 · claude-env · 193f52c4 · “(no quote: plain-words rename per memory plain-words-not-shorthand.md)” · routed: unrouted (gallery.md: explainer page's craft; outside an Overdrive page)
- 2026-10-15 · distill · rebuilt P1-P5
- 2026-10-15 · claude-env · c047217a · “point the kinds-of-page table at impeccable and taste-skill's words” · routed: process (Kinds of page: Tool and Overdrive rows name impeccable Operate/quieter/Restrained/overdrive and taste-skill --tone, --keep palette,type)
> superseded by 2026-10-15
- 2026-10-15 · claude-env · c047217a · “I don't like the impeccable overdrive and everyday. I feel like ours was better.” · routed: process (Tool and Overdrive rows restored to their pre-a9beb84 text)
- 2026-10-15 · claude-env · ee6fca8d · “rewrite it now. The old ui-taste table explains what things should look like according to their classification. the new table allows you to do anything you want, WHILE having references to show how crazy they can go” · routed: process (Kinds of page rebuilt as a 5-rung ladder: tool, lively, explainer, world, top tier, each with references; old Tool and Explainer look rules moved to section 6; Personal and Overdrive rows dropped)
- 2026-10-15 · claude-env · 683af8f5 · “also add the anatomy artifacts we made for arcade-app to tier 4-5” · routed: gallery (Kinds of page rows 4 and 5 References; gallery.md entry "arcade-app anatomy pages")
- 2026-10-15 · claude-env · 683af8f5 · “send the three-part check fix to the original session so it adds them before resuming the builders” · routed: process (row 3 References: a page with an anatomy figure runs anatomy's audit and lines.mjs)
- 2026-10-15 · distill · rebuilt P1-P5
- 2026-10-15 · claude-env · 683af8f5 · “24px — lint is right; Principle 4 should say 24px” · routed: P4 (tool buttons ≥24px square, matching lint-ui minControlSize 24; was ≥32px)
- 2026-10-15 · claude-env · faffb551 · “I don't want strict anchoring like the tool, lively, explainer” / “you can have motion. you can make it other pop in kinda like imessage, or written in like claude or chatgpt” · routed: process (Kinds of page rebuilt as The ladder: 5 stacked rungs of feel, Quiet/Expressive/Traceable/Immersive/Playable, plus look and feel dials and data-rung; old rung names removed from the description, the taste-skill line, section 6 labels and one gallery tag; research 05 and 06)
- 2026-10-15 · claude-env · 5c7f6593 · “rung 2 and 3 feel like they should be transformed into one, so there are four rungs.” / “the point of rungs is to be a scale of "how much attention is this drawing"” · routed: process (The ladder: 4 rungs, Quiet, Expressive, Immersive, Playable, a scale of attention; Traceable retired; showing what changed, linked pictures and cause-to-effect travel become patterns any rung may use; Idle from rung 3)
- 2026-10-15 · claude-env · 5c7f6593 · approved at the gallery review on 2026-10-15 (session 7e29ca3c), after the Safari list head and calendar cascade fixes; his exact words were not recorded · routed: gallery (add --approved 1-quiet gallery/1-quiet/expense-form/)
- 2026-10-15 · claude-env · 5c7f6593 · approved at the gallery review on 2026-10-15 (session 7e29ca3c), after the Safari list head and calendar cascade fixes; his exact words were not recorded · routed: gallery (add --approved 1-quiet gallery/1-quiet/team-calendar/)
- 2026-10-15 · claude-env · 5c7f6593 · approved at the gallery review on 2026-10-15 (session 7e29ca3c), after the Safari list head and calendar cascade fixes; his exact words were not recorded · routed: gallery (add --approved 1-quiet gallery/1-quiet/recipe-box/)
- 2026-10-15 · claude-env · 5c7f6593 · approved at the gallery review on 2026-10-15 (session 7e29ca3c), after the Safari list head and calendar cascade fixes; his exact words were not recorded · routed: gallery (add --approved 1-quiet gallery/1-quiet/transit-timetable/)
- 2026-10-15 · claude-env · 5c7f6593 · “it doesn't matter, rungs 1 and 2 are fine.” (gallery review, 2026-10-15) · routed: gallery (add --approved 1-quiet gallery/1-quiet/bike-share/)
- 2026-10-15 · claude-env · 5c7f6593 · “Ii like them” (gallery review, 2026-10-15) · routed: gallery (add --approved 2-expressive gallery/2-expressive/chat/)
- 2026-10-15 · claude-env · 5c7f6593 · “Ii like them” (gallery review, 2026-10-15) · routed: gallery (add --approved 2-expressive gallery/2-expressive/music-player/)
- 2026-10-15 · claude-env · 5c7f6593 · “Ii like them” (gallery review, 2026-10-15) · routed: gallery (add --approved 2-expressive gallery/2-expressive/habit-tracker/)
- 2026-10-15 · claude-env · 5c7f6593 · “Ii like them” (gallery review, 2026-10-15) · routed: gallery (add --approved 2-expressive gallery/2-expressive/kanban-board/)
- 2026-10-15 · claude-env · 5c7f6593 · “it doesn't matter, rungs 1 and 2 are fine.” (gallery review, 2026-10-15) · routed: gallery (add --approved 2-expressive gallery/2-expressive/bike-share/)
- 2026-10-15 · claude-env · 5c7f6593 · “yes looks more different” (gallery review, 2026-10-15, built as rung 3 Connected; the user then merged rungs 2 and 3) · routed: gallery (add --approved 2-expressive gallery/2-expressive/bike-share-linked/)
- 2026-10-15 · claude-env · 5c7f6593 · “they all look good.” (gallery review, 2026-10-15, as rung 3 before the ladder merged) · routed: gallery (add --approved 2-expressive gallery/2-expressive/cache-explainer/)
- 2026-10-15 · claude-env · 5c7f6593 · “they all look good.” (gallery review, 2026-10-15, as rung 3 before the ladder merged) · routed: gallery (add --approved 2-expressive gallery/2-expressive/mortgage-calculator/)
- 2026-10-15 · claude-env · 5c7f6593 · “they all look good.” (gallery review, 2026-10-15, as rung 3 before the ladder merged); his one complaint: the lake picture is drawn from a few code shapes · routed: gallery (add --approved 2-expressive gallery/2-expressive/photo-editor/)
- 2026-10-15 · claude-env · 5c7f6593 · “they all look good.” (gallery review, 2026-10-15, as rung 3 before the ladder merged) · routed: gallery (add --approved 2-expressive gallery/2-expressive/flight-search/)
- 2026-10-16 · claude-env · 1ba06c48 · “honestly amazing redesign.” · routed: gallery (add --approved 3-immersive gallery/3-immersive/spectral-drape/)
- 2026-10-16 · claude-env · 1ba06c48 · “if were storing effects animation xyz attached to a - when xyz shouldnt it keep it short?” · routed: gallery (format: one line plus use when / take / not for)
- 2026-10-16 · distill · rebuilt P1-P5
- 2026-10-16 · claude-env · 1ba06c48 · “why not just remove it” / “why are you trimming job-app again? i told you to get rid of it in claude.env” · routed: process (projects.md retired; each repo keeps its exceptions in its own DESIGN.md `## UI taste` section, at most 1,000 characters, pasted by the ui-taste-inject hook; music-app dropped; model-app and doc-app get theirs with their new DESIGN.md)
- 2026-10-27 · job-app · fill-profile redesign · “ALIGN TEXT not containers.” · routed: P4 (first sentence sharpened: text edges align; fills and tints bleed by their padding)
- 2026-10-27 · distill · rebuilt P1-P5
- 2026-10-27 · claude-env · “we don't need all those lines in principles, but say if [the user] asks for xyz, or more xyz then refer to showcase” · routed: process (showcase-only lines moved from P3/P4 to section 6 Showcases; P4 points there)
- 2026-10-27 · job-app · 8125164d · “don't make employment an "item" that sits alone and lonely on its own row. If you can, use even grids (in this case 2x2)” · routed: P4 (grids stay even; no lone cell on a row)
- 2026-10-27 · job-app · e8de9674 · “if elements like icons go into padding try putting them on the other side so its still within the container AND doesnt keep the text from being aligned” · routed: P4 (icon moves to the text's other side; no hanging into padding)
