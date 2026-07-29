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
| **T** | textures on / off |
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

Two more checks are worth re-running after any change to `js/plan.js`,
both from the browser console via `window.TEXOMA`:

- **Reachability.** Flood-fill the floor on a 0.25 ft grid using
  `TEXOMA.walker.blocked()`, starting at the front walk, and confirm
  every room can be reached. This is what caught a vanity, a bed and a
  run of closet shelving sitting across doorways.
- **Leaks.** From eye height all over the great room, cast rays in
  every direction and check that none escapes to open sky or lands on
  the roof. This is what caught the ceiling breaking through the roof,
  and later a missing soffit where the kitchen opens onto the hall.

## Files

```
index.html        page + UI
css/style.css     overlay chrome
js/plan.js        the house in feet: walls, openings, rooms, fixtures
js/build.js       turns plan.js into flat-shaded geometry
js/controls.js    first-person walker + orbit rig
js/textures.js    procedural surfaces, drawn to canvases at load
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

## The roof and the vault

These two are one problem, so they are worth reading together.

The listing photos show a vaulted great room. The first attempt at it
did not work: with a hip roof on this footprint the north end slopes
down to meet the eave, and the roof plane over the rear wall sits at
about **11'-3"** — below where a vaulted ceiling needs to be. The
ceiling came out through the roof, which is not a bug in the geometry so
much as an honest structural conflict.

The fix is the one the real house almost certainly uses: **gable the
rear instead of hipping it**. With a gable, the ridge runs all the way
out to the rear wall and the roof cross-section is constant along the
whole depth of the great room, so there is headroom to vault into.

So the roof is now **hipped at the front, gabled at the rear**:

- ridge at x = 20, 4:12 pitch, eave at 10'-9", ridge underside 17'-11"
- the rear gable closes the triangle between the eave and the ridge;
  from inside the great room you see its lower few feet above the
  windows, painted the same as the walls
- the great room ceiling climbs at 3:12 off the 9' plate and flattens
  at **12'-6"**, leaving 2'-3" of clearance under the roof at the
  tightest point

Where the vault meets a flat 9' space — the hall, the primary entry —
a soffit drops down to close the step. Miss one and you get a hole
straight into the attic; the ray-casting check below is what catches
them.

## The closet block, and the pantry

Two places in the plan are easy to read as one room and are not.

The block between the hall and the garage looked like a single mud
hall. It is actually **three closets around a solid core**, each
opening a different way: linen faces north into the hall, coats faces
west into the mud hall, and bedroom 4's reach-in faces east into the
bedroom. The mud hall is only the strip west of them. Three wall lines
carry that — x = 24.0, x = 26.45 and z = 43.6 — and all three were
missing at first.

The **pantry** was the same mistake: it is a small walk-in room off the
kitchen with its own door at the north-east corner, not the run of
cabinets it was first modelled as.

`closet-check.png` is a zoom of the overlay across both areas, which is
the quickest way to see that the walls and door swings line up.

## Deliberate simplifications

- **Closet interiors are mostly bare.** Only the walk-in and the pantry
  have shelving. The reach-ins are left empty so you can step inside.
- **The front elevation is plainer than the real one.** No gabled
  board-and-batten entry feature, and no lower roof over the garage.
- **Fixtures are boxes.** The island, counters, vanities, tubs, washer
  and dryer are placed where the plan shows them, but they are blocks,
  not modelled casework. Three of them (bath 2 vanity, bedroom 4 bed,
  closet shelving) were nudged off doorways they were sitting across.

## Textures

**Textures** in the toolbar (or `T`) switches between textured and the
plain flat-shaded model. Both are the same geometry.

The surfaces are **generated, not photographs**. Two reasons: a page
opened straight off the filesystem cannot load local image files at all
— CORS treats every local file as its own origin — and shipping the
listing photos would mean redistributing someone else's photography.
So `js/textures.js` draws each map to a canvas at load: staggered
wide-plank flooring, tile with grout, lap siding, board-and-batten on
the gable, shingle courses, quartz speckle, a shaker panel on the
cabinet faces, and a barely-there mottle on the painted walls.

What *does* come from the photos is the proportions, measured off them:

| | sampled | used as |
|---|---|---|
| plank tone spread | luminance 134 – 176 | 0.90 – 1.05 |
| plank seam | 74 vs 155 | 0.55 |
| drywall mottle | 179 vs 193 | 0.96 – 1.00 |
| tile grout | 97 vs 139 | 0.72 |

Every map is a light/dark modulation around white, so it *multiplies*
the existing palette instead of replacing it. That is why switching
textures off lands back on exactly the original colours, and why the
maps carry no colour of their own.

The geometry has no texture coordinates, so `planarUV()` in `build.js`
projects each triangle down its dominant axis, in world feet. Floors
and ceilings take z/x — which is what makes planks run the long way
down the house and roof courses run parallel to the eave — and walls
take height plus whichever of x/z they face. Because the projection is
in world space, a plank is the same width in every room and adjacent
surfaces line up with no seam bookkeeping at all.

## Colours

Sampled from the listing photos rather than invented: warm cream walls,
light wide-plank floors, white cabinets and quartz, one navy accent wall
in the family room, greige siding with a brown-grey roof.
