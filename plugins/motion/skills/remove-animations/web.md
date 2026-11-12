# Removing animations on the web

Web details for the rules in [SKILL.md](SKILL.md), from Emil Kowalski's `remove-animations` skill (MIT, see LICENSE). Use these to find candidates, to name the reduced version, and to clean up after cuts the user asked for.

## Reducing, in CSS terms

| Today | Reduced to |
| --- | --- |
| Hover with `scale`, lift (`translate`) or growing `box-shadow` | `color`, `background-color` or `opacity` change only, 150ms or less, `ease` |
| Slide or scale entrance on a frequent surface | `opacity` only, 150ms, `ease-out` |
| UI animation over 300ms | 200 to 250ms, same curve |
| Stagger over 80ms per item, or over 300ms total | Cap at 30ms per item, or drop the stagger and fade the group as one |
| `infinite` loop (pulse, shimmer, glow) on a persistent element | Run once (`animation-iteration-count: 1`), or remove the loop and keep the static end state |

## Where to hunt on the web

**Keyboard and high frequency**
- Command palette, menu or dialog opened by a shortcut, with an enter or exit transition.
- Tab switches, segmented controls and sidebar navigation that slide or crossfade.
- Route or page transitions inside the app (not on marketing pages).
- `:hover` transforms on rows and list items.

**Decoration**
- Fade-in on scroll on every section: `whileInView`, `IntersectionObserver` reveal classes, AOS, `animate-fade-in` utilities.
- Hover `scale` or lift on cards that are not the primary action.
- Endless loops: pulsing badges, gradient orbs, glowing borders, spinning icons that are not loading indicators.
- Staggered entrances on lists the user loads many times a day.

**Functional data**
- Charts that redraw from zero on every mount or refresh.
- Numbers that count up on page load.
- Table rows that animate in when data loads.

**Over-engineering**
- `transition: all`. Delete it and list only the properties that need to transition, or none.

Useful searches: `transition`, `animation`, `@keyframes`, `motion.`, `animate={`, `whileInView`, `whileHover`, `AnimatePresence`, `layout`, `stagger`, `infinite`, `animate-`, `IntersectionObserver`, `transition: all`.

## Removal hazards on the web

- **Hidden start states.** Keyframes with `animation-fill-mode: forwards` that start from `opacity: 0`. Motion's `initial={{ opacity: 0 }}`. A reveal class that sits at `opacity: 0` until an observer fires. Delete the animation without the start state and the element stays invisible forever. Remove both.
- **Code that waits.** `onAnimationEnd`, `transitionend` listeners, `onExitComplete` and `setTimeout` calls sized to a duration.
- **Exit animations that delay unmount.** `AnimatePresence` keeps a component in the DOM until its exit ends, and `onExitComplete` fires after. Once the exit is gone, the component unmounts at once. Move whatever ran in `onExitComplete` to the point where the component closes.
- **Layout animations hiding a jump.** Motion's `layout` prop or a FLIP animation may mask a layout shift. Remove it and the jump appears. If it does, keep the animation and list the shift as a finding.
- **Focus.** Focus moved inside an animation callback must move immediately once the animation is gone.
- **Tests.** Tests that wait for animation classes or durations need the same cut.

## Cleanup on the web

After applied cuts, remove what they left behind.

- `@keyframes` and animation utilities that nothing references.
- `motion.div` to `div` (and the other `motion.*` elements) where no motion props remain.
- Empty `AnimatePresence` wrappers and unused variants objects.
- Motion imports in files that no longer animate.
- Animation entries in the Tailwind config or token files with zero references.

If the motion library is no longer imported anywhere, say so and propose removing the dependency. Do not run the uninstall yourself.

## Verify after applying

Run the type checker and tests if the project has them. Search for every removed keyframe, class and variant name to confirm nothing still references it.
