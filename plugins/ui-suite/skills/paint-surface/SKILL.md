---
name: paint-surface
description: Use when the user asks for a web page or page section whose surface should look made of a real material under real light, in any project - paper under a lamp, denim or cloth, halftone print, water with caustics, frosted glass, holographic foil, heated metal, burning paper, or "make it look real, tactile, lit". Asks first whether to paint it in WebGL2 with paint-kit, then follows the kit's own AGENTS.md. Not for flat UI, icons, CSS gradients or shadows, 3D models (use models:build-models), or motion timing (use the motion skills).
---

# Paint a lit surface: ask first

A request for a page surface that light falls on starts with one question. Ask it before writing any shader, canvas or CSS texture code.

## 1. Ask

Use AskUserQuestion, one question, the first option recommended:

- **Question:** "Paint this surface with paint-kit?"
- **Option 1 (Recommended):** "Yes, use paint-kit". The surface is drawn in WebGL2 from a material and real lights, and paint-kit's gate checks that the light obeys real laws (a lamp dims with distance, a raised edge casts a shadow).
- **Option 2:** "No, build it another way". Say what way, or leave it to the session.

Skip the question only when the user already said how to build it in this request ("with paint-kit", "plain CSS", "hand-write the shader").

To help the user choose, point them at the live gallery of finished examples: https://bnhoang2k.github.io/paint-kit/

## 2. On yes

paint-kit has no install command. Get a working clone first:

1. Ask whether a paint-kit clone already exists on this machine, and use it if so. Otherwise clone https://github.com/bnhoang2k/paint-kit into a folder the user agrees to, then check out its newest tag (`git tag --sort=-v:refname | head -1`).
2. In the clone, run `pnpm install`, `pnpm exec playwright install chromium` and `pnpm build`. The kit needs Node 26 and pnpm. When one is missing, say which and ask how to continue. Do not fall back to another method on your own.
3. Read the clone's `AGENTS.md` and follow its steps in order: name the surface and its laws, find the nearest example ("bar") in `bars/INDEX.md`, copy it, change the words and colours, run `gate`, then render and read `sheet`. Do not paraphrase the steps from memory; they change with the kit.
4. Colours come from the page's own CSS custom properties, so take them from the user's project, not from the copied bar.
5. The page loads the engine through an import map to `/dist/src/engine/index.js`. The kit's `init` command (in `AGENTS.md`) copies the engine into the folder the project serves at `/`. When the project has no such folder, say so and ask how to continue.
6. Before showing the page, run `ui-suite:lint-ui` on it, like any other web page.

## 3. On no

Build it the way the user chose. Do not ask again this session for the same kind of request.
