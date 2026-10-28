# break-scene catalog

Load this in Pass 4. Part A is corrections that come from real scene reviews, stated generally. Part B is general
set-dressing practice, marked as general. Try every row that applies to the scene.

## Part A: Corrections from real reviews

### A1. Zoning: every actor has a believable job

Typical correction: the furniture is not arranged to make sense. Kitchen gear belongs in the kitchen with
characters cooking. A lead character oversees the others. Serving characters carry food to tables.

- Check: each piece sits in the zone where its work happens.
- Check: each actor is doing the job of that zone, with hands on a task, not standing beside it.
- Check: a lead role (a supervisor) can see the people they oversee.

### A2. Rooms and walls, not clutter on a floor

Typical correction: everything sits in one room with odd lines at the bottom. Use an actual layout for the
kind of place being shown.

- Check: separate jobs get separate rooms or clearly walled zones.
- Check: no abstract marks, lines or tiles on the floor that are not part of a real place.

### A3. Scale to the operator

Typical correction: scale the furniture down so the character can operate it.

- Check: measure the character from the model file (`scripts/measure_actor.py`), never from a brief.
- Check: every seat, counter and control against that size and the project's size table.
- Check: hand top and hand reach against each surface the actor works at.

### A4. Objects face their user

Typical correction: a phone faces the wrong way for the character holding it.

- Check: every screen, keypad, till and form faces the person using it.
- History: a fix turned the screen to the camera for readability and broke this. A later fix brought
  the same bug back. Readability for the viewer never overrides how the object is used.
- Same class: a cash machine on a back desk faced away from its clerk.

### A5. Reads as its job without labels

Typical correction: the scene does not read as a place that does business or handles money.

- Check: hide every label and sign in your head. Can a viewer still tell what the place does?
- Check: the cold reader's first guess at the place matches the intent.

### A6. Duplicates: every object earns its place

Typical correction: the office has an extra table behind the table.

- Check: two pieces doing the same job (two work surfaces in a row, three payment devices).
- Check: for each duplicate, can the viewer see why there are two? If not, remove one.
- Note: two reviewers who had read the brief missed this one. The blind cold read caught it.

### A7. Places with people working beat abstract icons

Typical correction: the stand-ins for a payment server or a card company do not work.

- Check: a bank facade, a vault on a stand, a floating logo are symbols, not places. They did not read
  as places where work happens.
- Check: replace the symbol with a small room where people do the work.
- Check: the metaphor fits the real thing. A card company approves payments; it does not keep a cash
  vault.

### A8. Parts that merge into each other (cross-reference)

Typical correction: code-built figures where parts mold into each other.

- This is a geometry defect. Use `models:break-models`, not this skill. Run it before break-scene.

### A9. One view: everything square to the room

Typical correction: one desk is not drawn at the same view as the rest. It was turned 45 degrees to face the
camera inside a room whose walls, and the rack beside it, sat square to the room.

- Check: every piece and furniture group is square to the room's walls, so at the real camera each one
  shows its top and two sides at the same tilt. A piece turned to face the camera head-on draws as a
  flat front view and looks pasted in from another drawing.
- Check: for a face to show, turn the actor within the square layout (three-quarter view is fine), not
  the furniture. This is the camera-side twin of A4: pose for use and for the shared view, never for
  the lens.

## Part B: general set-dressing practice (general)

### B1. Circulation (general)

- Every actor has a clear path from where they enter to where they work.
- Paths do not cross through work zones (a waiter does not walk through the cook's station).
- Doors and openings sit on those paths. Leave room for a door or drawer to swing.

### B2. Sightlines (general)

- The audience camera sees each actor's face or hands at work, not their back, unless the back is the
  point.
- A tall piece in front does not hide the story's key action.
- Staff who must watch something (the door, the room, a screen) can see it from where they stand.

### B3. Grouping by use (general)

- Things used together sit together: the till next to the counter, the menu at the table.
- One task, one cluster. Spread-out tools read as clutter.

### B4. One focal point per zone (general)

- Each zone has one main object or action the eye goes to first.
- Two equal focal points in one zone split the story.

### B5. Believable density (general)

- Too empty reads as a showroom. Too full reads as storage.
- Add a few lived-in props (a mug, papers) only where people work, not on every surface.
- Props support the job. They never compete with the focal point.

### B6. Consistent scale across a set (general)

- All pieces of one building share one scale.
- A sign, a door or a window sized for a different scale breaks the set even when each piece is fine
  alone.
