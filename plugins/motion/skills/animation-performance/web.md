# Animation performance on the web

Web names and code for the principles in [SKILL.md](SKILL.md), from Emil Kowalski's animation-performance skill (MIT, see LICENSE). Always measure on a recording from a real device.

## Symptom table

Start here. Match what the user sees, then read the matching section.

| Problem | Solution |
| --- | --- |
| Animation stutters | Animate `transform`/`opacity`, not `width`/`height`/`top`/`margin` |
| Shadow animation is choppy | `filter: drop-shadow()` (composited in Chrome; measure elsewhere) |
| Jank only during navigation or loading | Move the animation to CSS or WAAPI so it runs off the main thread |
| Motion `x`/`y` drops frames | Upgrade to `motion` 14.2+, or animate the full `transform` string |
| Hand-rolled animation drops frames in React | Write to `ref.current.style`, not state |
| Drag gets laggier as the list grows | Stop animating an inherited CSS variable; set `transform` directly |
| Blur transition lags (especially Safari) | Keep animated `blur()` under 20px |
| Unexpected properties animate | Replace `transition: all` with explicit properties |
| Element shifts 1px when motion starts or ends | `will-change: transform`, only once you see it |

Never write `transition: all`. List the exact properties. `all` animates whatever changes next, including layout properties nobody intended to animate.

## The pipeline and the property tiers

The browser runs up to three steps: layout, paint, composite. Every property enters at one of three points:

| Tier | Properties | Cost |
| --- | --- | --- |
| Composite only | `transform`, `opacity` | Cheapest. Browsers promote these to their own layer. |
| Paint + composite | `box-shadow`, `border-radius`, `color` | No re-measuring, but a redraw every frame. |
| Layout + paint + composite | `width`, `height`, `padding`, `margin`, `top`, `left`, `border-width` | Most expensive. One growing element can move everything around it. |

`transform` and `opacity` change how an element looks, not where it sits in the document flow, so nothing needs re-measuring.

## Swapping down a tier

| Instead of | Animate |
| --- | --- |
| `width` / `height` / `padding` to grow or shrink | `scale()` |
| `top` / `left` / `margin` to move | `translate()` (percentages are relative to the element's own size) |
| `display` / `visibility` swaps | `opacity`, then `visibility: hidden` once it ends so it stops taking clicks |
| `box-shadow` | `filter: drop-shadow(…)` (Chrome composites `filter`; other engines may repaint, so measure) |

The last one is the one people miss. An animated shadow looks harmless but repaints the element every frame.

Animating a sidebar's `margin-left` pushes the content beside it on every frame; `translateX` does not.

## Which driver runs where

| Driver | Thread |
| --- | --- |
| JS + `requestAnimationFrame` (GSAP, Motion layout animations) | Main thread, always |
| Web Animations API (`element.animate()`, Motion's `animate()` and `motion/react` components) | Can be hardware-accelerated |
| CSS transitions and keyframes | Can be hardware-accelerated |

Hardware acceleration means the animation runs off the main thread, so it stays smooth no matter what JavaScript is doing. "JS" and "main thread" are not synonyms: a JS library that hands off to WAAPI can be accelerated, a `requestAnimationFrame` loop cannot.

Reliably accelerated: `transform` and `opacity`. Gaining support: `filter`, `clip-path`, `background-color`.

The pattern to watch for is motion that runs while the page is doing heavy work. Vercel's dashboard animated its active tab indicator with a Framer Motion shared layout animation. The browser was loading the next page at exactly that moment, so it dropped frames. Moving it to a CSS animation fixed it.

## Motion's acceleration

Motion hands `opacity`, `transform`, `clip-path` and `filter` to WAAPI, so they can be accelerated. The `x`, `y`, `scale`, `rotate` shorthands depend on the version:

```jsx
<motion.div animate={{ x: 100 }} />                          // motion 14.2+: hardware-accelerated. Before: main thread, can jank
<motion.div animate={{ transform: "translateX(100px)" }} />  // hardware-accelerated in every version
```

From `motion` 14.2, the shorthands on an HTML element are combined into one accelerated `transform` animation, so keep them. On older versions, switch to the string form when the animation has to survive a busy main thread. In every version, these stay on the main thread: layout animations (`layout`, `layoutId`), `onUpdate`, `transformTemplate`, inertia, and values driven every frame by a motion value (drag, `useTransform`).

## Acceleration is progressive enhancement

Browsers silently decline acceleration under conditions that change between versions. Chrome, for example, historically did not accelerate percentage-based transforms. That is not a reason to stop using `translateY(100%)`. Percentages are the right call for elements of unknown size (it is how Sonner and Vaul position toasts and drawers), and correctness beats a best-effort optimization.

## React: write to the ref, not to state

Animation libraries animate outside React's render cycle, so they are fine. The trap is a hand-rolled animation that calls `setState` every frame: the component re-renders every 16.7ms and the render alone blows the budget.

```jsx
// Drops frames: one re-render per frame
setY(nextY);

// Smooth: no re-render
ref.current.style.transform = `translateY(${nextY}px)`;
// or with a motion value: y.set(nextY)
```

Look for state updates inside `requestAnimationFrame`, `pointermove`, `scroll`, or drag handlers.

## Two traps that look correct

Both of these use `transform` and still drop frames.

**Inherited CSS variables.** Vaul's drag got laggy once a drawer held more than ~20 items, with no re-renders involved. The drag distance was written to a CSS variable that `translateY()` read:

```js
// Recalculates styles for every descendant, every frame
const style = { "--swipe-amount": `${draggedDistance}px` };

// Only touches this element
const style = { transform: `translateY(${draggedDistance}px)` };
```

CSS variables inherit, so changing one on a parent triggers style recalculation for every child. The more content, the slower each frame. Suspect this whenever a `transform` animation degrades as content grows.

**Blur.** `filter: blur()` gets expensive fast, especially in Safari. Keep animated blur under 20px; 2 to 5px is enough to soften a crossfade.

## `will-change`

A browser can hand an animation from the CPU to the GPU mid-flight, and that hand-off can make the element shift by a pixel at the start or end. `will-change` promotes the element up front so no hand-off happens:

```css
.drawer {
  will-change: transform;
}
```

**Add it only once you see the shift or measured dropped frames.** Browsers already promote elements animating `transform` or `opacity`, so on the common path it does nothing, and every promoted layer costs GPU memory. Put it on the element that animates, never on `*` or large containers.

Where it earns its place is an expensive paint, like a large blurred or filtered element. Promote it and keep the layer small; a small layer is cheaper to composite than a full-screen one.

## CSS vs JS animation

Do not avoid JS animation on principle. Main-thread animation only suffers when the page is busy during it, which is rare.

Framer Motion gives you things CSS cannot: real springs, shared layout animations, exit animations for unmounted components, momentum gestures. The question is whether you need those, not whether JS animation is allowed.

**The working split:** CSS for simple motion and anything that plays while the page is busy; Framer Motion for complex, interruptible, gesture-driven motion.

## Diagnosis steps with web names

Work down this list, ordered by how often each is the cause:

1. **Which properties animate?** Layout properties first, then `box-shadow` and `border-radius`.
2. **Does the jank coincide with navigation, fetching, hydration or a long task?** Move the animation to CSS or WAAPI.
3. **Is React re-rendering per frame?** State updates in `requestAnimationFrame`, pointer, or scroll handlers.
4. **Does it get worse as content grows?** An inherited CSS variable, or too many nodes animating at once.
5. **Is a CSS variable animated at all?** Or Motion's `x`/`y`/`scale` on a version before 14.2?
6. **Any animated `blur()` above 20px?**
7. **Still shifting or stuttering?** Now add `will-change: transform` to the animating element.

Expand `transition: all` and Motion shorthands into what they actually animate before you start.

## DevTools steps

Confirm with a recording, not by feel:

- The Performance panel shows dropped frames and long tasks.
- The Animations panel slows motion down so you can inspect it.
- Profile on a real mid-range phone over remote debugging. CPU throttling in desktop DevTools models a slow CPU, not a weak GPU or a small memory budget.

## Report example

```
**Card hover**: `card.tsx:42`
Cause: layout property animated
Before: `transition: all 200ms` (animates `padding`, triggers layout)
After: `transition: transform 200ms` with `scale(0.97)`
Verified: from code / needs a device recording
```
