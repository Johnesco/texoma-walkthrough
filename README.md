# Texoma — 3D Walkthrough

A first-person walkthrough of the Texoma floorplan, built with three.js.
Plain flat-shaded geometry, no textures.

**[Open the walkthrough →](https://johnesco.github.io/texoma-walkthrough/)**

Or clone and open `index.html` — it runs straight off the filesystem by
double-click. three.js is vendored in `vendor/`, so there is no build
step, no package install and no network access required.

## Controls

| | |
|---|---|
| **W A S D** / arrows | move |
| **Mouse** | look (click once to capture the cursor) |
| **Shift** | run |
| **Esc** | release the cursor |
| **1 / 2 / 3** | walk / dollhouse / exterior |
| **M** | hide the minimap |

**Walk** is the first-person view, with collision against walls and
fixtures. **Dollhouse** drops the roof and ceilings and looks down into
the plan. **Exterior** is an orbit around the outside. Drag to orbit,
wheel to zoom, right-drag to pan. The *Jump to* list drops you into any
room, and *Furniture* toggles the fixtures.

## Where the geometry comes from

Everything was traced from `source/floorplan.png`.

The footprint measures 289 × 505 px in that drawing. At 7.22 px/ft that
is exactly **40'-0" × 70'-0"**, which set the scale for everything else.
Wall lines were found by scanning the image for columns and rows of dark
pixels; the gaps in those runs are the doorways, and the places where the
wall is drawn as a thin double line are the windows. So door and window
positions are measured, not estimated.

`floorplan-check.png` overlays the model's walls back onto the original
drawing — red for wall, colour-coded for each type of opening. That is
the check that the 3D matches the plan.

## Files

```
index.html        page + UI
css/style.css     overlay chrome
js/plan.js        the house in feet: walls, openings, rooms, fixtures
js/build.js       turns plan.js into flat-shaded geometry
js/controls.js    first-person walker + orbit rig
js/main.js        scene, lighting, view modes, minimap
vendor/           three.js r156
source/           the floorplan everything was measured from
```

`js/plan.js` is the file to edit. A wall is one line: an axis, a
position, a start and end, and a list of openings. Everything else —
geometry, collision, the minimap — is generated from it, so moving a wall
or a door moves it everywhere at once.

`window.TEXOMA` exposes the scene, camera, walker and plan for poking at
things from the console.

three.js is pinned to **r156** on purpose. It is the last release with a
UMD build, and a UMD build loaded by a plain `<script>` tag is what lets
`index.html` work when opened directly off disk — ES modules are blocked
by CORS on `file://` origins. r156 logs a deprecation warning about
this; that warning is expected. Moving to a modern three.js means moving
to modules, which means the page would only run from a web server.

## Deliberate simplifications

- **The great room is a raised flat ceiling (10'-3"), not a vault.** The
  listing photos clearly show a vault, but a true vault will not fit
  under a hip roof on this footprint — the ridge sits 21' in from the
  eave, so the ceiling plane breaks through the roof near the rear wall.
  A gable over the great room would be needed to do it properly.
- **Small closets are not framed out.** The linen and coat closets off
  the mud hall, and the reach-ins, are drawn as open floor area.
- **The roof is a plain 4:12 hip.** The real elevation has a gabled
  board-and-batten entry feature and a lower roof over the garage.
- **Fixtures are boxes.** The island, counters, vanities, tubs, washer
  and dryer are placed where the plan shows them, but they are blocks,
  not modelled casework. Three of them (bath 2 vanity, bedroom 4 bed,
  closet shelving) were nudged off doorways they were sitting across.

## Colours

Sampled from the listing photos rather than invented: warm cream walls,
light wide-plank floors, white cabinets and quartz, one navy accent wall
in the family room, greige siding with a brown-grey roof.
