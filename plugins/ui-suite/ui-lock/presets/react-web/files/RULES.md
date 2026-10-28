# ui-lock react-web rules

Copied from the ui-suite plugin's `ui-lock/presets/react-web/files/`. Do not edit here: change the preset in the plugin and run `ui-lock.py sync`.
Changing files/ requires a VERSION bump (check 70 enforces it).

| Rule | Enforces |
|---|---|
| `ui-lock/no-raw-values` (ESLint) | R1: no hex or color functions, no Tailwind arbitrary values or properties (`p-[13px]`, `md:max-w-[65ch]`, `[margin:13px]`), no literal sizes, numbers or colors in `style={{...}}` (`0`, keywords like `'none'`, a bare `var(--x)` and computed values are fine; raw colors inside a computed template are still caught), outside the token home |
| `ui-lock/no-raw-controls` (ESLint) | R2: no raw `button`, `input`, `select`, `textarea` outside the component home |
| `color-no-hex`, `color-named`, `function-disallowed-list` (Stylelint) | R1 colors in CSS, outside the token home |
| `declaration-property-value-allowed-list` (Stylelint) | R1 fonts in CSS: `font-family` and `font-size` must be `var(...)` or `inherit`, outside the token home |
| `@eslint-community/eslint-comments/require-description`, `reportDescriptionlessDisables` | every disable carries a reason |

Paths come from the `## UI system` block in DESIGN.md. Stories and tests are exempt.

R1 covers the component home too, shadcn components included:
- After `npx shadcn add`, run lint and convert each reported raw value to a token class or `var(--…)`.
- Re-running `shadcn add` on the same component overwrites those conversions. Review the diff and reapply them.

Not enforced in v1: raw spacing and sizes in CSS (`margin: 13px`). In TSX they are caught as literal `style` values and Tailwind arbitrary values.
