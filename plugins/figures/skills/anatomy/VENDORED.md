# Vendored: anatomy

Source: https://github.com/wheresryan22/anatomy at 240a9bf7c50cc6226148762a1017466fcbc08523 (2026-10-11), MIT.

Kept: SKILL.md, LICENSE, references/, kit/, scripts/, evals/, and the source files of examples/.
Dropped: the built examples/**/*.html (about 9MB; `node examples/<name>/build.mjs` rebuilds them next to the script), README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG, .github/.

Safety read before install (read-only, no code run): no agent-directed instructions, no network calls except the local DevTools port of the headless Chrome it starts with a temp profile, no obfuscation, no runtime downloads.

## Local patches (reapply on every upstream refresh)

1. `SKILL.md` description: narrowed from "any diagram ... even if they never say isometric" to finished, publishable figures. It points in-chat explanations to `explain-as-machine` and plain flow diagrams to `artifact-diagramming`.
2. `SKILL.md`, 3D section, "Verify with `--audit`" bullet: the full turn audit runs in the background from the main thread only, and a helper process runs `--quick` in the foreground. Reason: a background task started by a helper process can finish after that process ends, and no one is told.
3. `references/verify.md`, Orbit block: same note on the backgrounded full-audit line.
4. `SKILL.md` description: ends with a pointer that sends an exploded view or reveal film of a real product to `anatomy-reveal` (vendored next to this skill).
