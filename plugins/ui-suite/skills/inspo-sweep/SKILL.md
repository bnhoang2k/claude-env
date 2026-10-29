---
name: inspo-sweep
description: Use when the user wants visual inspiration or "has anyone done this" examples for a UI idea - "find inspiration", "mobbin this", "what do other apps do for X", "search Mobbin", "references for this screen". A cheap haiku fan-out over Mobbin and the open web that returns cited links grouped by idea. Not for prior art on a whole product or feature (use workflow:prior-art-check), and not for the user's own taste references (use ui-suite:ui-taste's gallery).
---

# Inspiration sweep

A cheap search fan-out: about 10 haiku agents, each searching one angle, about 1 unit total.
The main loop sorts the results. No agent saves, comments or creates collections anywhere.

## 1. Pick the angles

Write 8-10 angles from the user's idea, each a different way in. Spread them:

- **Mobbin screens** (web and ios): the kind of screen in plain words, with the kind of app
  ("workflow automation builder canvas", "CI pipeline run graph").
- **Mobbin sections**: landing-page sections that draw the idea ("how it works process diagram").
- **Mobbin flows**: how a user opens and edits the thing.
- **The open web** (2-3 angles): galleries (Dribbble, Awwwards, Godly), product pages and docs
  with screenshots, open-source examples.
- One **sideways** angle: the same shape in another domain (a delivery tracker for a pipeline,
  a transit map for a flow).

## 2. Run the workflow

Launch it with the Workflow tool, every agent pinned to `model: 'haiku'`, one agent per angle,
in `parallel()`, capped at 10. State the TIERS block and "N haiku = N/10 units" in the launch
message. Each agent's brief:

- The idea and why the user wants it, in one or two sentences.
- Its one angle and the tool to use. Mobbin: load the tools with ToolSearch "mobbin search",
  use mode "deep", read the returned images (never describe from metadata), cite each
  `mobbin_url`, and copy any `ai_usage_notice` word for word. Web: WebSearch mode "standard",
  cite the page URL.
- Return 5-10 strong results only, as `{title, url, shows, steal, score 1-5}`: what the visual
  shows (from looking at it) and the one idea worth taking. For Mobbin, also return the
  result's `image_url`; for the web, an image URL from the page when one exists.
- Read-only on every service.

## 3. One review page (always)

Drop results scored below 3 and duplicates. Put everything that remains on ONE local page
the user can review at a glance:

- Download each image into the scratchpad (`<scratchpad>/inspo/img/`); Mobbin image URLs
  expire after 30 days, so never hotlink them.
- Write `<scratchpad>/inspo/index.html`: a grid of cards grouped by idea (not by source), best
  first. Each card: the image, the title as a link to its `mobbin_url` or page URL, and the
  one-line "steal". A result with no image gets a text card. Light ground, readable text.
- Serve the folder (`python3 -m http.server`) and open it in the browser pane, or send it with
  SendUserFile when the user is away. It is a private review page: don't publish it as an
  Artifact, since it holds other companies' screens.

## 4. Report

In chat: the page link, the 3 ideas that matter most for the user's design, and one next
step. Show any Mobbin `ai_usage_notice` verbatim, as its own block.
