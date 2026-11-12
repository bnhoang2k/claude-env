# Gestures on the web

Web code for the rules in [SKILL.md](SKILL.md), from Emil Kowalski's gestures and apple-design recipes (MIT, see LICENSE). The values are starting points, so tune them on a real phone.

## Build or use: web options

For a bottom sheet or drawer, default to [Vaul](https://vaul.emilkowal.ski/). It exists because this gesture is hard to hand-roll. Build it yourself only for a custom swipe card or a bespoke drag.

## Track phase

- **Drive position from a `useMotionValue`** (or direct `transform` writes), never a spring or a transition.
- **Write `transform` directly on the dragged element.** Never update a CSS variable on a parent to move children. CSS variables inherit, so every change recalculates styles for all descendants. This exact bug made Vaul's drag laggy past about 20 list items. Setting `transform` on the element fixed it.
- **No React state per move event.** A re-render on every `pointermove` drops frames. Motion values and direct style writes skip the render cycle.
- **Rubber-band edges:** in Motion, `dragElastic` around 0.2.

Pointer Events with capture keep tracking when the pointer leaves the element. Keep the grab offset and a position and timestamp history for the release velocity.

```js
el.addEventListener('pointerdown', (e) => {
  el.setPointerCapture(e.pointerId);
  const grabOffset = e.clientY - el.getBoundingClientRect().top; // respect where they grabbed
  // ...track position + timestamp history for velocity
});
```

Progressive resistance past a bound:

```js
// The further past the bound, the less the element follows - real things slow before they stop
function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
```

## Response on press

```css
/* Feedback lives on the press, and it's instant */
.button:active {
  transform: scale(0.97);
  transition: transform 100ms ease-out;
}
```

Also audit debounces, artificial timers and transition waits on the input path. Anything not essential is a regression.

## Release phase

Read distance and velocity together from `onDragEnd`:

```jsx
<motion.div
  drag="y"
  dragConstraints={{ top: 0 }}
  dragElastic={0.2}
  onDragEnd={(e, info) => {
    if (info.offset.y > threshold || info.velocity.y > 500) dismiss();
  }}
/>
```

`dragMomentum` is on by default. It is right for a flung card and wrong for a simple reposition. Disable it when the element should stop where the finger stops. `dragConstraints` takes a ref or a bounds object.

Momentum projection and the handoff to a spring:

```js
// decelerationRate ~ 0.998 for normal scroll feel; 0.99 for snappier
function project(initialVelocity /* px/s */, decelerationRate = 0.998) {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}

const projectedEndpoint = currentPosition + project(releaseVelocity);
const target = nearestSnapPoint(projectedEndpoint);   // choose target from the projection
animateSpringTo(target, { velocity: releaseVelocity }); // then hand off velocity
```

For spring APIs that want relative velocity, use `gestureVelocity / (targetValue - currentValue)`. Example: element at `y=50`, target `y=150`, finger at 50px/s gives `50 / 100 = 0.5`. Motion takes absolute px/s through its `velocity` option, so there you usually pass the raw value.

## Springs in Motion

The `bounce` plus `duration` spring API maps closely to damping plus response.

```js
import { animate } from 'motion';

// Critically damped default (no overshoot)
animate(el, { y: 0 }, { type: 'spring', bounce: 0, duration: 0.4 });

// Momentum interaction - a little bounce, only because a flick preceded it
animate(el, { y: target }, { type: 'spring', bounce: 0.2, duration: 0.4 });
```

Starting values Apple ships:

| Interaction | Damping | Response |
| --- | --- | --- |
| Move or reposition (for example picture-in-picture) | 1.0 | 0.4 |
| Rotation | 0.8 | 0.4 |
| Drawer or sheet | 0.8 | 0.3 |

## Interruptibility

- **Avoid CSS transitions and `@keyframes` for anything gesture-driven.** They cannot be grabbed and reversed smoothly. Springs animate from the current value by default. CSS `@keyframes` restart from zero. This is why Sonner's early CSS enter animation made toasts jump when a second toast arrived.
- **Read the live transform on interrupt** (the computed style or the motion value), then start the new animation from there.
- Use a spring library that re-targets from the current velocity, so a reversal does not hard-cut it.

## Linked values

```jsx
const y = useMotionValue(0);
const overlayOpacity = useTransform(y, [0, drawerHeight], [1, 0]);
```

## Sheets without springs: the Vaul curve

Vaul mimics the iOS sheet with pure CSS: `cubic-bezier(0.32, 0.72, 0, 1)` over 500ms. The curve is very steep at the start. That lets a 500ms duration still feel snappy and land with a gentle, spring-like settle. Two rules follow.

- A small floating drawer (not touching the screen edge) should override to about 200ms. The 500ms timing only reads right on a full-width, edge-attached sheet.

  ```css
  [vaul-drawer]  { transition: transform 0.2s cubic-bezier(0.165, 0.84, 0.44, 1); }
  [vaul-overlay] { transition: opacity  0.2s cubic-bezier(0.165, 0.84, 0.44, 1); }
  ```

- The component must feel like one entity. If the drawer opens in 200ms, its height changes and content crossfades belong to the same timing family. One slow sub-animation makes the whole thing feel broken.

Mark interactive children with `data-vaul-no-drag`, so pressing a button inside the drawer does not start a drag.

## Spatial consistency

Set `transform-origin` to the trigger element, so a menu, popover or sheet grows from the button that opened it. For reversible transitions, use inverse cubic-bezier control points for the two directions. Sonner's toast slides up from the bottom, so swiping down dismisses it.

## Hold gestures

Use `linear` for the hold phase and `ease-out` for the fast snap-back on early release.

## Touch checklist

- **Test on a real phone.** Hit the dev server by local IP. Trackpad simulation lies about touch. A 60Hz desktop monitor hides opacity-transition roughness that a 120Hz phone shows.
- **Hit targets at least 44 by 44px.** Enlarge small visuals with an invisible `::before` hitbox instead of growing the layout.
- **`touch-action`** on the drag axis (`touch-action: pan-x` for a vertical drag, and so on), so the browser does not fight the gesture with native scrolling.
- **Gate hover effects** behind `@media (hover: hover) and (pointer: fine)`.
- **Haptics:** the Vibration API can give touch feedback on supported devices. Do not let a CSS transition lag behind the audio or vibration, so they fire on the same frame.

## Smoothness

`requestAnimationFrame` is the web's display-synced clock. Animate only compositor-friendly properties, `transform` and `opacity`, and hint with `will-change` where motion is imminent.

## Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  .sheet { transition: opacity 200ms ease; transform: none !important; }
}
```

Replace slides, springs and parallax with short opacity cross-fades, drop elastic and overshoot, and keep opacity and color changes that aid comprehension. In Motion, `useReducedMotion` gives the same signal in code.

## When it still feels wrong

A weird spring: raise `damping`. A gesture that stutters: check the track-phase rules above, then use the `animation-performance` skill.
