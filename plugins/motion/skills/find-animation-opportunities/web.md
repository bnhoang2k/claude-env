# Finding animation opportunities on the web

Web values for the rules in [SKILL.md](SKILL.md), from Emil Kowalski's find-animation-opportunities skill (MIT, see LICENSE). The values are starting points, so tune them on a recording. Use the project's own tokens first if it has them.

## Recon

Look for existing easing and duration custom properties, and the motion library in use (CSS only, Motion, or other). Suggestions extend those and never add a parallel set.

## Where to hunt: web patterns

**Feedback gaps**
- Pressable elements with no `:active` state: `transform: scale(0.97)` with `transition: transform 160ms ease-out`. Subtle range: 0.95 to 0.98.
- Destructive actions confirmed by a plain click: a hold-to-confirm fill. Use a `clip-path: inset(0 100% 0 0)` overlay, 2s linear on press, and a 200ms ease-out snap-back on release.

**Teleporting state**
- Content that swaps, appears or vanishes: fade and scale in from `scale(0.95 to 0.97)` and `opacity: 0`, ease-out, never `scale(0)`. Use `@starting-style` for entry without JS.
- Accordions that snap open: a height and opacity transition.
- List items added or removed in a list that is not high frequency: enter and exit transitions. Use CSS transitions, not keyframes, so rapid triggers retarget smoothly.

**Missing spatial story**
- Panels, popovers and menus with no link to the trigger: scale in with `transform-origin` at the trigger (Base UI: `var(--transform-origin)`). Modals stay centered.
- Toasts and sheets that exit a different way than they entered: symmetric paths, using `translateY(100%)` percentages, not hardcoded pixels.

**Group entrances**
- A grid or list that pops in all at once on an occasional view: a 30 to 80ms stagger. Decorative, and it never blocks interaction.

**Gesture seams**
- Draggable or swipeable elements that snap: springs (`{ type: "spring", duration: 0.5, bounce: 0.2 }`, bounce 0.1 to 0.3), velocity-based dismissal (`Math.abs(distance) / elapsedMs > ~0.11`), and rubber-banding at boundaries instead of hard stops.

**Sweeps**
- Search for conditional renders with no transition (`{isOpen &&`, `display: none` toggles), `onClick` handlers on elements with no `:active` or transition styles, `details` and accordion markup, drag handlers, `.map(` renders of entering lists, and empty-state and success components.

## Curves

Prefer the project's own curves. Emil's set, if the project has none:

- `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`
- `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`
- `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`

## Output rules for web recipes

- Animate `transform` and `opacity` only.
- Include reduced-motion handling: gentler motion, not zero.
- Gate hover effects with `@media (hover: hover) and (pointer: fine)`.
- Give exact values, never approximations.
