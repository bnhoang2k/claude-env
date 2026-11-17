---
name: animation-performance
description: Use when motion is slow to draw rather than badly designed. Signs - the user says the app feels "unoptimized", has "little freezes and glitches", lag or stutter while something animates or while typing, or a drag gets slower as content grows. Finds the cause first (an expensive property, work on the main thread, a re-render every frame, a large blur), then fixes it. Any platform. Not for objects passing through each other in a 3D scene (models:break-models), layout jumping on hover or spam clicks breaking state (ui-suite:break-ui), slow model inference or slow pipelines, or audio.
---

# Animation Performance

A diagnostic skill. It does one thing: make motion finish every frame. It does not pick easing or duration. It does not judge whether the motion should exist (see `motion:find-animation-opportunities` and `motion:remove-animations`). The question here is never "does it look right?" but "does each frame finish in time?".

Adapted from Emil Kowalski's `animation-performance` skill (MIT, see LICENSE). Platform code lives in side files: read [web.md](web.md) when the project is a web page or web app. On other platforms (SwiftUI, Unity, Three.js, a game engine), apply the same principles with that platform's tools and profiler.

## Why this matters

Take a polished toast or drawer and run it at 30 frames per second. The easing is the same. The durations are the same. The code is the same. Nobody would care about it. Performance is not a polish pass after the motion is good. It is what lets good motion register at all.

## Posture

You are a design engineer who has shipped drawers, toasts and dashboards to real devices. Each trap below has bitten you in production. You know the developer's laptop is the least representative device the animation will ever run on.

Two failure modes. The first is worse.

1. **"It's smooth on my machine."** A fast laptop hides almost every problem in this skill. The bar is a mid-range phone. On a 120Hz screen the budget is half what you think.
2. **Sprinkling a layer-promotion hint and calling it fixed.** A hint that tells the platform to prepare a layer is the last step, not the first. Most jank is the wrong property or a busy main thread, and the hint fixes neither.

## Hard rules

1. **Animate move, fade and scale by default.** Anything else needs a reason. If a cheaper property gives the same visual, use it, even when the expensive one "seems fine".
2. **Name the cause before changing code.** Every fix names which cause below it addresses. "Added a hint, seems smoother" is not a diagnosis.
3. **Never conclude "it's fine" from a fast machine.** Say which findings you verified from code and which need a recording on a real device.
4. **Never animate "everything".** List the exact properties. A catch-all animation also animates whatever changes next, including size and position properties nobody meant to animate.
5. **Do not trade correctness for a best-effort optimization.** Hardware acceleration is something the platform may grant. Which properties you animate is something you control. Spend effort on the second.
6. **Never update app state every frame.** Write straight to the animated element (or its animation value) instead.

## The frame budget

60 frames per second is what the brain reads as fluid motion, and it matches most refresh rates. It gives each frame **16.7ms** (1000 divided by 60). On a 120Hz screen, which is now most phones and many laptops, each frame gets **8ms**. Design against the smaller number.

For scale: a layout recalculation on a complex page can take over 100ms. That is not one missed frame. It is a dozen.

Two things decide whether you stay inside the budget:

1. **What you animate.** How much work each frame costs.
2. **Where it runs.** Whether that work can be blocked by everything else the app is doing.

## What you animate

To show a visual change, a renderer runs up to three steps:

- **Layout:** work out the size and position of every element.
- **Paint:** draw the elements into layers.
- **Composite:** put those layers on screen.

Every property enters this pipeline at one of three points, and the cost differs by an order of magnitude:

| Tier | What changes | Cost |
|---|---|---|
| Composite only | Move, fade and scale of an element as a whole | Cheapest. The element sits on its own layer, so only the layers are re-combined. |
| Paint, then composite | Appearance without size or position: shadows, corner rounding, text color | No re-measuring, but the element is redrawn every frame. |
| Layout, paint, then composite | Anything that changes size or position inside the layout: width, height, padding, margin, offsets | Most expensive. One growing element can move everything around it. |

Move, fade and scale change how an element looks, not where it sits in the layout, so nothing needs re-measuring.

**Swap down a tier** when the visual allows it:

- To grow or shrink, scale the element instead of changing its size or padding.
- To move, translate the element instead of changing its position or margin. Percentage moves are relative to the element's own size.
- To show or hide, fade the element instead of switching its visibility. When the fade ends, hide it for real so it stops taking clicks and taps.
- For a shadow, try the lighter shadow effect the platform offers for the same look, then measure it, because not every engine draws it more cheaply. An animated shadow looks harmless but redraws the element every frame.

Two things follow:

- **Layout animations do not always drop frames.** An absolutely placed element, or one with few children, may animate its padding with no visible cost. But when scaling gives the look you want, only scaling cannot regress on a slower device, so pick it. Scaling also scales the children and keeps the layout space, so it does not always look the same as padding.
- **Layout properties also move the wrong things.** Animating a sidebar's margin pushes the content beside it on every frame. Moving the sidebar does not. For a dashboard next to an opening sidebar, that is the whole page laid out again 60 times a second.

## Where it runs

Script code runs on the main thread, and that thread is shared with everything else the app does. An animation driven by a per-frame callback competes with all of it. When the main thread is busy, the callback cannot run and the frame is late.

An animation that the platform can hand off runs elsewhere (off the main thread), so it stays smooth whatever the app code is doing. Hand-off is not the same as "no scripting": a script library that gives the work to the platform's own animation system can be accelerated, and a per-frame loop cannot.

Reliably handed off: move, fade and scale. Support for the other cheap effects is still growing.

**Watch for motion that runs while the app is doing heavy work.** Examples: page transitions, a tab indicator during navigation, anything that fires beside data loading or startup. A dashboard animated its active tab indicator with a shared layout animation driven by script. The browser was loading the next page at that exact moment, so frames dropped. Moving the indicator to a plain declarative animation fixed it.

**Acceleration is progressive enhancement.** Platforms silently decline it under conditions that change between versions. That is not a reason to give up a correct design. A percentage-based move is the right call for an element of unknown size, and correctness beats a best-effort optimization.

## Never animate through app state

Animation libraries animate outside the app's render cycle, so they are fine. The trap is a hand-rolled animation that updates app state every frame. The view then re-renders every 16.7ms, and the render alone blows the budget.

Write straight to the animated element, or to the animation value the platform provides. Look for state updates inside per-frame callbacks and inside pointer, scroll and drag handlers.

## Two traps that look correct

Both use a cheap property and still drop frames.

**A value that many children depend on, changed every frame.** In one drawer, a drag got laggy once it held more than about 20 items, with no re-renders involved. The drag distance was stored in a shared value that the animated element read, and the children inherited it. Changing that value every frame forced every descendant to recompute. The more content, the slower each frame. Suspect this whenever a cheap animation degrades as content grows. Set the animated property directly on the one element instead.

**Blur.** A blur effect gets expensive fast, especially on Safari. Keep animated blur under 20px. 2 to 5px is enough to soften a crossfade.

## Layer-promotion hints

Some platforms let you tell them to prepare a layer before an animation starts. Without it, a platform may hand an animation from the CPU to the GPU mid-flight, and that hand-off can shift the element by a pixel at the start or end.

**Add the hint only once you see the shift or measured dropped frames.** The platform already promotes elements that animate move, fade or scale, so on the common path the hint does nothing, and every promoted layer costs GPU memory. Put it on the element that animates, never on a whole page or a large container.

Where it earns its place is an expensive paint, such as a large blurred or filtered element. Promote it and keep the layer small, because a small layer is cheaper to combine than a full-screen one.

## Should you avoid script-driven animation?

No. Main-thread animation only suffers when the app is busy during it, which is rare, and now you know how to spot that case.

Script libraries give you things the declarative route cannot: real springs, shared layout animations, exit animations for removed views, momentum gestures. The question is whether you need those, not whether script animation is allowed.

**The working split:** declarative animation for simple motion and anything that plays while the app is busy. Script-driven animation for complex, interruptible, gesture-driven motion.

## Workflow

### Phase 1: Find what animates

List every animation in scope with its driver, its properties and what the app is doing while it plays:

| Element | Driver | Properties | Plays during |
|---|---|---|---|
| Tab indicator | Script, shared layout | layout | route change |
| Drawer | Declarative transition | move | user drag |
| Card hover | Declarative transition | "everything" | hover |

Expand any catch-all animation and any shorthand into the properties it really animates.

### Phase 2: Diagnose

Work down this list. It is ordered by how often each item is the cause.

1. **Which properties animate?** Anything other than move, fade and scale is the first suspect. Layout properties come first. Then shadows and corner rounding, which do not look like layout and are easy to miss.
2. **Does the jank coincide with the app being busy?** Navigation, loading, startup, a long task. Move the animation to a declarative or handed-off driver.
3. **Is app state updating per frame?** Look in per-frame, pointer and scroll handlers.
4. **Does it get worse as content grows?** A shared value that many children depend on, or too many nodes animating at once.
5. **Is an inherited value animated at all, or a shorthand that the platform's version cannot hand off?**
6. **Any animated blur above 20px?**
7. **Still shifting or stuttering?** Now add a layer-promotion hint to the animating element.

Confirm with a recording, not by feel. Use the platform's profiler to find dropped frames and long tasks, and its slow-motion view to inspect the motion. Profile on a real mid-range phone. CPU throttling on a desktop models a slow CPU, not a weak GPU or a small memory budget.

### Phase 3: Report

For each finding:

```
**[Element]**: file and symbol
Cause: [which of the causes above]
Before: [what animates now, and why it is costly]
After: [the cheaper property or driver]
Verified: from code / needs a device recording
```

Order findings by cost: layout before paint, busy main thread before idle. Then stop. Apply fixes when asked.
