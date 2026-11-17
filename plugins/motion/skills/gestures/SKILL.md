---
name: gestures
description: Use when the user moves something by hand and it does not follow. Signs - "it teleports around", "I just want to click and drag and drop", a slider or knob that jumps on click instead of following the pointer, something that should be grabbed, flicked, lifted or swiped away, a sheet or drawer, drag-to-reorder, a fling that should land where it was heading. Covers 1:1 tracking while held, a release that keeps the hand's speed, dismiss on distance or speed, and catching motion mid-way. Any platform.
---

# Gestures

A gesture is direct manipulation. While the hand is down, the interface is the hand. When the hand lifts, physics takes over. Every rule here follows from that split. Whether something should move at all belongs to `motion:find-animation-opportunities`. Several things moving for one event belong to `motion:choreograph`. Frame drops belong to `motion:animation-performance`.

Adapted from Emil Kowalski's `gestures` and `apple-design` skills (MIT, see LICENSE). The second one distills Apple's WWDC talks, chiefly on fluid interfaces. Platform code lives in a side file: read [web.md](web.md) when the project is a web page or web app. On other platforms (SwiftUI, Unity, Three.js, a game engine), apply the same rules with that platform's tools.

The through-line: an interface feels alive when motion starts from the current on-screen value, inherits the user's speed, projects momentum forward, and can be grabbed and reversed at any instant.

## First decision: build it, or use what exists

A good drawer or sheet gesture needs momentum, an overlay that matches drag progress, velocity-aware dismissal, focus handling and a way to close from the keyboard. That is weeks of edge cases. For a sheet or drawer, use an existing solution for the platform first. Build the gesture yourself only when nothing covers the interaction (a custom swipe card, a bespoke drag). The web options are in [web.md](web.md).

## The two phases of every gesture

Mixing the phases up is the most common cause of a gesture that feels wrong.

```
Is the pointer currently down?
|-- Yes: TRACK phase. Position maps 1:1 to the pointer.
|        No easing. No duration. No spring. The element IS the hand.
`-- No:  RELEASE phase. Physics finishes the motion.
         A spring seeded with the release velocity, or an eased transition
         when the component is built without springs (a CSS-only sheet,
         hold-to-confirm). Never a clip that restarts from zero.
```

### Track phase

- **1:1 means 1:1.** Drive position straight from the pointer. A spring or a transition during tracking makes the element trail the hand, like dragging through syrup.
- **Respond on press, not on release.** Show feedback the moment the pointer goes down. Waiting for the lift feels dead.
- **Respect the grab offset.** Keep the distance between the grab point and the element's anchor. Snapping the element's center to the pointer breaks the illusion at once.
- **Keep tracking when the pointer leaves the element.** Capture the pointer for the whole gesture.
- **Keep a short velocity history.** Store the last few positions with timestamps, not only the current point. You need the speed at release.
- **Feedback stays continuous during the gesture.** A drag, slider or drawer updates 1:1 the whole way. Never animate only when the gesture ends.
- **Do not make the update path heavy.** Write the position straight to the element. Do not trigger a full re-render or a style recalculation of unrelated elements on every move event.
- **Rubber-band at the edges.** Past a boundary, resist progressively: the further past, the less the element follows. A hard stop reads as frozen. Growing resistance reads as responsive, with nothing further here.
- **Hint in the direction of the gesture.** People predict the end state from the path. Make in-between frames point toward the outcome, not only interpolate to it.
- **Wait for a small movement before choosing a direction** (about 10px), then track 1:1. Watch every plausible gesture in parallel from the first move and cancel the losers once intent is clear. Do not rely on recognizers that report only a final state ("swiped left"), because they throw away the continuous tracking you need.
- **Pay for a disambiguation delay only where it is needed.** A double tap delays every single tap, so use it only where a double tap exists.

### Release phase

- **Custom drags finish with a spring, seeded with the gesture's velocity.** The element leaves the hand at the speed the hand had. A fixed-duration ease makes every fling land the same way, which reads as fake. Some spring APIs want relative velocity: divide the hand's speed by the distance still to go.
- **Project momentum.** Do not snap to the nearest target from the release point. Use the release velocity to project where the motion would come to rest, then pick the target nearest that point. This makes a flick feel like a throw.

  `projected = current + (v / 1000) * d / (1 - d)`, with `v` in px/s and `d` about 0.998 for a normal scroll feel (about 0.99 for snappier). Use this exponential-decay form. The textbook `v^2 / (2 * decel)` is not what Apple uses.
- **Dismiss on distance or on speed.** Passing about 40 to 50% of the travel dismisses, and so does a fast flick over a short distance. Distance-only thresholds make flicks feel ignored.
- **Decide reverse or commit from the projected endpoint, not from the release position.** Use the projection above. A hand moving fast back toward the start projects back, so it reverses even when it is past halfway.
- **Bounce belongs only after a drag.** A drag applies force, so a slight bounce on release feels physical. The same element closed by a button press gets no bounce, because no force was applied. Keep bounce small (0.1 to 0.3 in a bounce-style spring API such as Motion's), and remember that small elements need more bounce to read the same.
- **Snap-back is fast.** If the gesture did not pass the threshold, return quickly. A slow snap-back feels like the interface disagreeing in slow motion.

### Choosing the spring

Think in two numbers, not in mass, stiffness and damping.

- **Damping ratio** sets the overshoot. 1.0 settles with no bounce. Below 1.0 overshoots and oscillates.
- **Response** is how fast the value reaches its target. Lower is snappier. A spring has no fixed duration: the settle time comes from these numbers.

Start most UI at damping ratio 1.0. Lower it to about 0.8 (a little bounce) only when the gesture carried momentum: a flick, a throw, a drag release. Overshoot on a menu that just faded in feels wrong. Overshoot on a card you flicked feels right. Starting values by interaction are in [web.md](web.md).

## Interruptibility is not optional

The user must be able to catch a sheet mid-close and drag it back. A closing panel the user grabs should follow the hand, not finish closing and then reopen.

- **Never lock out input during a transition.**
- **Start every new motion from the live on-screen value, never from the target value.** On interrupt, read where the element is now. Starting from the logical target causes a visible jump.
- **Use springs, not fixed clips, for anything a gesture can touch.** A spring re-targeted mid-flight keeps its current velocity, so the redirect is seamless. A scripted clip restarts from zero and cannot be caught.
- **Blend velocity at a reversal.** Replacing one animation with another at a reversal cuts the velocity and feels like a brick wall. Use a spring that carries velocity through a re-target.
- **Split 2D motion into independent X and Y springs.** One spring on the 2D distance desyncs when the two axes have different speeds.

## Linked values

The dragged element is rarely alone. An overlay fades, the page behind scales. Derive these from the drag progress. Do not animate them separately. One source of truth means the overlay is always exactly as faded as the sheet is dismissed, including mid-gesture and when the user reverses. Two separate animations drift apart as soon as a gesture is interrupted.

## Spatial consistency

- **An element dismisses in the direction it entered.** A toast that slides up from the bottom is dismissed by swiping down. Enter and exit share one axis, so the gesture is felt, not learned.
- **Enter and leave along the same path.** A panel that slides in from the right leaves to the right.
- **Anchor to the source.** A menu, popover or sheet grows from the element that triggered it, not from its own center.

## Hold gestures are asymmetric

Hold-to-delete and other press-and-hold actions use a linear curve during the hold. The animation shows time passing, and time passes linearly. Any other curve lies about how long is left. On release before completion, snap back fast with an ease-out. The deliberate phase is slow and honest. The cancel is instant. Symmetric timing here is a bug.

## Feel checklist

Run this for every gesture you ship.

- **Tap:** highlight on press, commit on lift. Add about 10px of padding around the target. Let the user cancel by dragging away, and re-arm by dragging back.
- **Drag or swipe:** small movement threshold first, then 1:1 tracking.
- **Hit targets** are at least 44 by 44 points. Enlarge small visuals with an invisible hit area, not with layout.
- **Test on a real device with a real finger.** A mouse or trackpad simulation lies about touch. A slow display also hides roughness that a fast one shows.
- **Native scrolling must not fight the gesture.** Tell the platform which axis your gesture owns.
- **No hover effects on touch.** Touch can fire phantom hovers on tap.
- **Review frame by frame.** Record the gesture and scrub it. Look at what is in each frame, not only the frame rate. Keep the per-frame jump small enough to avoid strobing. For very fast motion, a subtle blur or stretch along the path encodes speed better than a hard, sharp streak.

## Feedback in more than one sense

When you pair motion with sound or touch feedback, use three rules.

1. **Causality.** Fire it on the real cause (the switch flipping, the item snapping home). Match its character to how physical the action is.
2. **Harmony.** The visual, the sound and the touch feedback land on the same frame. Latency between them breaks the illusion.
3. **Utility.** Add feedback only where it earns its place: success, error, commit, snap. Too much trains users to ignore all of it.

## Reduced motion

Tracking is direct manipulation. The user produces the motion, so it stays. What reduces: momentum flings, bounce, parallax and any decorative motion around the gesture. On release, settle with a short fade or small position change instead of a bouncy spring. Reduced motion does not mean no feedback. It means a gentler equivalent that does not cause dizziness. Avoid large moving objects while they travel, or make them semi-transparent.

## When it still feels wrong

A weird spring is usually fixed by raising the damping. A gesture that stutters is a performance problem: check the track-phase rules first, then read `motion:animation-performance`. To diagnose a feeling you cannot name, record the gesture and scrub it frame by frame. Slow motion shows what full speed hides.

## Source sections left out

Emil's `apple-design` also covers translucent materials and depth, typography, the eight design principles and a design process. They are about visual design, not gestures. See `ui-suite:ui-taste` for look.
