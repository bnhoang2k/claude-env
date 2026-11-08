# Defect Catalog

Defects that shipped or nearly shipped, grouped by kind. Use the rows that apply to the model in front of you. Each row says what you see, where it hides, and where it came from. Rows marked **general** are common 3D defects; the rest come from real reviews of rigged characters and furnished rooms. Treat them as examples.

Sources, short names used below:

- **build spec**: the design spec and build plans of the furniture
- **contract**: an outline-and-material contract
- **pack**: a pack folder (a pack checker script, clip scripts, a clip list)
- **review**: a review of a furnished piece (an office, a counter, an open cabinet, a rack)
- **test run**: a run of this skill on a furniture pack and a full scene

---

## Parts melt or merge

Distinct elements must stay distinct, and their outlines must show it. Parts that mold into each other (a prop on a table, a piece against a building) read as one blob.

| What you see | Where it hides | Source |
| --- | --- | --- |
| Two pieces read as one blob with no line between them | Flush joins between separate parts; same white fill | review |
| A chair seat and back pressed into a cabinet's drawers | Side views of a furnished room | review |
| Three cable tubes read as one pole | Back views | review |
| Clerk heads merge with the counter and signs at the camera angle | Walk-through camera, az 45 el 30 | review |
| Side vents merge into one box | Grazing angles | review |

## Floats and gaps

| What you see | Where it hides | Source |
| --- | --- | --- |
| A tablet head hangs 5 mm above its post; the post's flat top cap shows whole | el 30 views from the front and the right; close-up of the post joint | test run (`checks.py`: near miss 0.005) |
| A unit floats over the floor with nothing under it | Low views; hidden at the walk angle | review |
| A part floats with no path to the floor | x-ray views; `floating part` in `checks.py` | **general** |

## Coplanar faces (z-fighting)

| What you see | Where it hides | Source |
| --- | --- | --- |
| Dashed line along an outer corner seam | az 225 to 270 | review |
| Dashed seam between a door top and its overhang | az 22.5 | review |
| End-cap top flush with the counter underside; doubled dark line from below | Bottom and low views | review |
| Door back face and floor front face on the same plane | Contact faces, checked by number | review |
| Tablet screen face flush with the head: the frame's top line is missing | Back views at el 30 and 60, top view | test run |
| Bar kick ends flush with the end cap's outer face: a stray line across the cap's foot | End-on and three-quarter views of the bar ends | test run |
| Bottle base ring dashed on the cabinet top | Back-bar close-ups | test run |

## Outline lines: stray, doubled, missing

| What you see | Where it hides | Source |
| --- | --- | --- |
| Crease lines on curved parts that are not real edges | Any rounded joint where one step bends more than 25 degrees | build spec (25-degree rule) |
| Doubled lines at every bevel corner; corner strips pinch into a Y | Receipt printer, all angles | test run |
| Doubled outline round the chair's side panel and seat-to-back bend | Chair side and top views | test run |
| Hooks where a turned post flares into its foot | Stool and table posts, all low views | test run (judged a note: smooth join, no crease) |
| Heavy doubled line on a unit's front top edge | el 60 views | review |
| Outline drawn inside the shape | Mirrored geometry with reversed winding | build spec ("if the outline draws inside the shape, the winding is wrong") |
| A 9-slice seam draws a line in the joined top | Open seam sides; slices not merged and welded | build spec, contract |
| Eye outlines broken into crescents | Faces sunk into the head; check whether the game skips that mesh | test run (the outline pass skips the eye mesh) |

## Hidden or lost parts

| What you see | Where it hides | Source |
| --- | --- | --- |
| A cable organiser hidden behind the door rail; only its slot shows | Walk-through angle | review |
| A side wall hides the cabinet and a desk monitor | az 292.5 to 315 | review |
| A spoon shows in the rest pose, poking sideways out of the hand | Rest-pose orbit; the clips scale it to 0 | test run |
| The face is lost from a high camera: eyes reduced to arcs at the head's edge | el 60 front views of the character | test run |

## Topology

| What you see | Where it hides | Source |
| --- | --- | --- |
| A thin slab turned inside out by a bevel | Parts under 0.08 thick | build spec (a soft-slab bevel turns thin parts inside out) |
| Open edges read as holes or ink lines | Split normals before welding; open backs | **general**; `weld()` in `common.py` |
| Open seam sides are intended on 9-slice tops; a loose line shows through them when a slice is drawn alone | Table edge, el 60 | test run, build spec |
| Edges shared by three or more faces, loose vertices, zero-area faces | `topology` lines in `checks.py` | **general** |

## Fits the character

Furniture must be scaled so the character can operate it. Work surfaces sit where the character's clips put its hands. Seats sit where the seated pose puts its hips.

| What you see | Where it hides | Source |
| --- | --- | --- |
| Counter top at the clerk's eye line; heads peek over it | Front and walk views with the character placed | review (eyes 0.55 to 0.70, top 0.60) |
| Pieces sized against a remembered character height; the rig measures shorter | Any piece built from a remembered height | review |
| The eat clip sweeps hands 0.33 in front at every table height | Seated clips at a table | build spec (known collision case) |
| Seated character sinks into the chair seat, 0.06 deep | The seated clip on a placed chair | test run (`checks.py` prop check) |
| Reach to compare: tap hand.R up to 0.42 high and 0.15 forward; take_ticket up to 0.44; seated reach about 0.27 | `reach` notes in `checks.py` | test run, build spec |
| Heights the pack must match: seat 0.32, table 0.55, bar 0.52, checkout 0.46 | `--expect sizes.json` | build spec, pack checker |

## Clips

| What you see | Where it hides | Source |
| --- | --- | --- |
| Feet cut flat by the floor during the stride | walk and carry, frames at 0, half and end (0.017 below) | test run |
| Feet dip through the floor while sitting down or standing up | sit, sit_hang, stand, middle frames (0.017 to 0.029) | test run |
| stand starts from sit's legs-out pose, not sit_hang's shins-down pose | stand frame 1 after a sit_hang guest | test run |
| Plate rim cuts through both hands | carry close-ups | test run (`crosses 0.000`) |
| Hand tucks under the chin | tap and tap_seated, raised frames | test run; the clip script tips the head back for this |
| A loop that starts after a lead-in reports a false pop | A phone-look clip (`loopFrom` 14) | pack (clip list) |
| A wave that reads as a raised fist at small size | wave middle frames | test run |
| Props must follow the hand with one fixed offset from a reference frame | Every frame of a prop clip | pack (clip script) |

## Budget

| What you see | Where it hides | Source |
| --- | --- | --- |
| Too many triangles for a game piece | `tris` lines in `checks.py`; budget about 2,000 per piece | build spec, pack checker, review (6,504 tris for 52 meshes) |
| A bulb or lamp with too few segments reads as a faceted mushroom | Close-ups of round parts | review |
