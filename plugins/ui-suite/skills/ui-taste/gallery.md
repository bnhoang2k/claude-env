# Gallery

References, anti-references and the user's approved designs. Never injected. Find entries with `grep -iA3 "^- .*<tag>" gallery.md` and read the 2-3 closest; open an entry's folder or link only after it matches. Add entries with `/ui-suite:taste add`. Shape, one entry per block: `- **name** · tags · link`, then indented `use when:`, `take:` and `not for:` lines (anti-references: one `never:` line).

## Approved

The user's own work. Copy the feel, not the layout: never copy an approved page's layout, content or colours. The ladder pages' palettes and type were a random draw, not a choice. Each `gallery/` folder holds page.html, light.png, dark.png and notes.md with the behavior numbers.

- **Spectral Drape** · 3-immersive, bold, calm, backdrop, webgl · gallery/3-immersive/spectral-drape/
  use when: one living backdrop carries a page with little text (hero, landing, intro)
  take: it drifts on its own, light rides the crests of the folds, and the pointer and a click answer softly (a dent, a gentle ring); tune its glow against measured brightness, not screenshots
  not for: dense reading or tools; text stacked over it without a measured contrast check; strong ripples that read as tearing
- **Expense form** · 1-quiet, quiet, snappy, form · gallery/1-quiet/expense-form/
  use when: a form or list where every change must land at once
  take: changes land at once; the receipt drop zone's states; a dense list whose head row holds in Safari
  not for: showcase pages
- **Team calendar** · 1-quiet, bold, sleek, calendar · gallery/1-quiet/team-calendar/
  use when: overlapping blocks of time share one column
  take: the overlap cascade: the first event fills its column, later ones sit on top with a 2 px edge, and no block is drawn shorter than its real time
  not for: nothing recorded
- **Recipe box** · 1-quiet, loud, whimsical, search · gallery/1-quiet/recipe-box/
  use when: a loud look must stay calm in behavior
  take: search and servings change the page at once, with no motion at rest
  not for: nothing recorded
- **Transit timetable** · 1-quiet, quiet, calm, table · gallery/1-quiet/transit-timetable/
  use when: dense rows the user scans for the next item
  take: the next departure stands out on its own row; dense rows you scan, not read
  not for: nothing recorded
- **Bike share, quiet** · 1-quiet, quiet, sleek, chart · gallery/1-quiet/bike-share/
  use when: a chart where a few marks matter most
  take: the busiest hours stand out on the marks themselves, with one accent
  not for: nothing recorded
- **Chat** · 2-expressive, quiet, whimsical, messages · gallery/2-expressive/chat/
  use when: a list of conversations with unread state
  take: unread shown by a badge and a bold row; bounce only answers a touch, so a friend's reply arrives without one
  not for: nothing recorded
- **Music player** · 2-expressive, loud, sleek, media · gallery/2-expressive/music-player/
  use when: media with a loud, type-led look
  take: big type and one colour panel per song; sleek springs with almost no bounce
  not for: nothing recorded
- **Habit tracker** · 2-expressive, bold, snappy, checklist · gallery/2-expressive/habit-tracker/
  use when: done and not-done items share one list
  take: not-done rows stay bold and done rows step back; a check fills the ring, rolls the count and pulses today's cell, and any click interrupts it
  not for: nothing recorded
- **Kanban board** · 2-expressive, quiet, calm, board, drag · gallery/2-expressive/kanban-board/
  use when: cards move between columns
  take: my cards marked by an edge and avatar; a moved card flies to its column while the gap behind it closes on a calm spring
  not for: nothing recorded
- **Bike share, expressive** · 2-expressive, quiet, sleek, chart · gallery/2-expressive/bike-share/
  use when: deciding what rung 2 adds to a chart
  take: the same chart as the quiet version with rung 2 springs; compare the two to see what Expressive adds
  not for: nothing recorded
- **Bike share, linked pictures** · 2-expressive, quiet, sleek, chart, linked · gallery/2-expressive/bike-share-linked/
  use when: several charts and a map show one dataset
  take: hovering an hour lights both charts and filters the map; a picked station's routes draw out of its dot, then its share fills the bars in order
  not for: nothing recorded
- **Cache explainer** · 2-expressive, quiet, sleek, explainer, diagram · gallery/2-expressive/cache-explainer/
  use when: explaining a system step by step with one figure
  take: the figure is the explanation: an arm on a gantry carries blocks between a 3-slot rack and a shelf, and the lit block is the one the step is about
  not for: nothing recorded
- **Mortgage calculator** · 2-expressive, bold, calm, calculator, form · gallery/2-expressive/mortgage-calculator/
  use when: inputs drive several outputs and the user should see what moved
  take: lines run from the changed input to each part it moved, labelled “up $29”; each input shows how much it moves the payment
  not for: nothing recorded
- **Photo editor** · 2-expressive, loud, snappy, history, tool · gallery/2-expressive/photo-editor/
  use when: a tool with an undo history worth scrubbing
  take: the tools a step changed get a ring, a tick marks the old value, and the thumb springs to the new one
  not for: its code-drawn lake picture (waits for a still-kit)
- **Flight search** · 2-expressive, quiet, whimsical, filters · gallery/2-expressive/flight-search/
  use when: filters remove items from a result list
  take: each filter says how many flights it removed, and each removed flight says why in plain words; the latest change is the one accent
  not for: nothing recorded
- **How-it-works guide (scroll walk)** · explainer, scroll, diagram, motion · none on file
  use when: an explainer page or guide; the exemplar explainer
  take: near-white ground, grey ramp, one blue, soft paper shadows, hairline figures. Scroll walk for 3+ steps: pin the picture, scroll picks the stop, about one screen (~92vh) per stop so a flick or Page Down never skips one; one caption at a time beside one picture, swapping in place (old leaves ~.2s, new waits ~.18s); under ~900px unpin and show a chosen still frame; no “scroll to play” hints. Radius: paper pictures near-square (2-3px), interface cards round softly, pills fully round; never round a document picture like a card. Numbers: one face with tabular figures. The page reads top to bottom as onboarding for a new hire, each section placed by its spot in the story.
  not for: light-only (an omission, not a choice)
- **Arcade-cabinet anatomy pages** · 3-immersive, 4-playable, explainer, diagram · none on file (a cabinet, a controller and an electronics assembly, each drawn part by part)
  use when: the craft bar for rungs 3 and 4 (Immersive, Playable)
  take: real machines drawn part by part, anatomy's audit and line checks, motion that explains
  not for: copying their arcade subject or layout; feel only
- **The user's own reference images and hand-polished exemplars** · tool, explainer, personal, overdrive · the image or file the user shares in the session; save it under `gallery/`
  use when: the user shares one
  take: match them literally
  not for: reinterpreting or re-pitching them

## References

- **Apple Liquid Glass** · tool, chrome, glass, motion · none on file
  use when: floating chrome (toolbars, pills, panels) over a vivid field; one of their clean-and-smooth references (“I want something clean, and smooth. apple's liquid glass is something that comes to mind.”)
  take: frosted floating chrome
  not for: long-reading surfaces or static cards; washed-out or over-tinted glass (raise opacity or mute the tint); laggy backdrop-filter (check Chrome)
- **Apple HIG** · native, swiftui, tool · https://developer.apple.com/design/human-interface-guidelines
  use when: native SwiftUI work
  take: the source for native SwiftUI, together with the project's DESIGN.md
  not for: web; and web design skills are not for native SwiftUI
- **Attio** · tool, table, density, metadata · https://attio.com
  use when: a dense data tool
  take: crisp density; quiet metadata as smaller grey text
  not for: copying its brand color
- **Folk** · tool, warmth, color · https://www.folk.app
  use when: a dense tool that should still feel warm
  take: warmth in a dense tool
  not for: nothing recorded
- **Linear, Stripe, Notion** · tool, density, metadata · https://linear.app, https://stripe.com, https://www.notion.so
  use when: quiet, dense, trustworthy tools
  take: quiet density and trust
  not for: Notion's corporate cards (see the anti-reference below)
- **pi.dev** · explainer, showcase, scroll, layout · https://pi.dev
  use when: a scroll showcase with a demo
  take: demo pinned top-left at a fixed aspect ratio; narrow copy rail. Measure it in the browser, don't guess.
  not for: stretching one element across the width; split the width into regions
- **apple.com/mac-studio** · explainer, showcase, scroll, motion · https://www.apple.com/mac-studio/
  use when: a scroll-driven showcase
  take: scroll-driven showcase
  not for: nothing recorded
- **shadcn/ui Button + lucide spinner** · tool, buttons · https://ui.shadcn.com/docs/components/button, https://lucide.dev
  use when: buttons with a busy state in a tool
  take: a review bar's buttons and their spinner
  not for: spelled-out text buttons for row actions
- **Google Docs margin comments** · tool, review, hover, metadata · https://docs.google.com
  use when: evidence or notes attached to text
  take: evidence on hover, pinned on click
  not for: nothing recorded
- **hairline** · diagram, explainer, overdrive, motion · https://github.com/lucasmarkes/hairline (MIT)
  use when: every diagram on a page, guide or Artifact (the default style)
  take: thin non-scaling stroke (~0.9px), five tokens (plate, hi, edge, mid, lo), one highlight stroke, no per-figure colors, springs that answer the pointer. Pick the view per figure. Flow diagrams (a codebase map): boxes in flow order so a highlighted path reads straight left to right, no zigzag or backtracking; orthogonal, circuit-style edges with corners at 45° (a how-it-works guide). Evidence: 1 session + 2026-10-08 ruling; 3 records.
  not for: the isometric view by default (not always wanted); quick inline chat diagrams, which stay plain and may use red/green/gray meaning colors. Not installed as a skill.
- **break-ui** · tool, testing, worst-case · https://ui-skills.com (by emilkowalski; catalog https://github.com/ibelick/ui-skills, MIT)
  use when: walking a UI before done (the Process walk)
  take: map every rendered value, build one plausible worst-case fixture, flip a dev-only Demo/Worst case toggle, report breaks with fixes, then stop
  not for: nothing recorded
- **lintapple** · tool, testing, alignment, lint · https://github.com/gholtzap/lintapple (MIT)
  use when: checking a rendered page; run it through the `ui-suite:lint-ui` skill
  take: measures the rendered page against a policy: type scale, contrast, control spacing, alignment, overflow, banned hint phrases
  not for: trusting a glance; a glance misses misaligned text
- **Kahoot** · personal, join, mobile · https://kahoot.com
  use when: people join a shared session from their phones
  take: join by phone QR scan
  not for: nothing recorded
- **Real PCB routing** · diagram, explainer · none on file
  use when: wiring in a diagram
  take: orthogonal traces, 45° corners
  not for: nothing recorded
- **anatomy** · overdrive, explainer, motion, diagram · the figures:anatomy skill
  use when: a system should read as a real physical machine
  take: figures that show a system as a real physical machine, animated
  not for: physics that lies (things popping into existence, belts running both ways)

## Anti-references

- **Notion/Coda corporate cards** · tool, cards · https://www.notion.so, https://coda.io
  never: corporate card layouts as the default container
- **ChatGPT chat-first UI** · tool, layout · https://chatgpt.com
  never: a chat box as the main surface of a tool
- **Roam/Tana/Obsidian "productivity-bro" styling** · tool, styling · https://roamresearch.com, https://tana.inc, https://obsidian.md
  never: "productivity-bro" styling
- **Bento-grid AI-startup UI** · tool, layout, cards · none on file
  never: bento grids in the AI-startup look
- **LinkedIn/Indeed clutter** · tool, density · https://www.linkedin.com, https://www.indeed.com
  never: clutter
- **Generic SaaS analytics** · tool, analytics, dashboard · none on file
  never: generic SaaS analytics dashboards
- **Editorial-serif brand lane** · type, brand · none on file
  never: the editorial-serif brand look
