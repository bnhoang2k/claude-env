---
name: build-models
description: Use when the user asks you to make, build, model, create or generate a 3D model, prop, furniture, character, tree, piece or .glb/.blend asset, in any project. Asks first whether to build it in Blender through model-kit, then follows `model-kit guide`. Not for 2D art, icons, CSS or SVG, and not for checking a model that already exists (use models:break-models).
---

# Build 3D models: ask first

Any request to make a 3D model starts with one question. Ask it before writing any Blender or three.js code.

## 1. Ask

Use AskUserQuestion, one question, the first option recommended:

- **Question:** "Build this in Blender through model-kit?"
- **Option 1 (Recommended):** "Yes, use model-kit". Blender builds the piece, and model-kit's gate checks it against real-world rules.
- **Option 2:** "No, build it another way". Say what way, or leave it to the session.

Skip the question only when the user already said how to build it in this request ("in Blender", "with model-kit", "hand-write the three.js").

## 2. On yes

1. Run `command -v model-kit`. When it prints nothing, say model-kit is not installed here, name the install repo https://github.com/bnhoang2k/model-kit, and ask how to continue. Do not fall back to another method on your own.
2. Run `model-kit guide` and follow the steps it prints, in order. Do not paraphrase them from memory; the guide changes with the kit.
3. Before showing the finished piece, run `models:break-models` on it (and `models:break-scene` when it sits in a room).

## 3. On no

Build it the way the user chose. Do not ask again this session for the same kind of request.
