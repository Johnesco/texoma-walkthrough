/* ------------------------------------------------------------------
   plan.js — the house, in feet.

   Every wall segment, doorway and window below was traced off
   signal-2026-07-28-15-56-46-896.png. The drawing measured
   289 x 505 px for the footprint; at 7.22 px/ft that is exactly
   40'-0" wide by 70'-0" deep, which is the scale used throughout.

   Coordinates:  x = 0 (west/left)  -> 40 (east/right)
                 z = 0 (north/rear) -> 70 (south/front, street side)
                 y = up, 1 unit = 1 foot
------------------------------------------------------------------ */

const PLAN = (function () {

  const T_EXT = 0.6;   // exterior wall thickness
  const T_INT = 0.42;  // interior wall thickness
  const H_STD = 9.0;   // standard ceiling

  /* EXT_TOP is the eave line: exterior walls run up to meet it. */
  const EXT_TOP = 10.75;

  /* ---- Roof ------------------------------------------------------
     Hipped at the front, gabled at the rear. The rear gable is what
     makes the vaulted great room possible: hip the north end instead
     and the roof plane drops to 11'3" over the rear wall, which is
     below where the ceiling needs to be.

     With the gable, the roof cross-section is constant from the rear
     wall back to z=50, so the ceiling can climb toward the ridge. */
  const ROOF = { eave: EXT_TOP, over: 1.5, pitch: 4 / 12, ridgeX: 20 };

  // underside of the roof at a given x (constant in z over the gable)
  function roofH(x) {
    const fromEave = Math.min(x + ROOF.over, 40 + ROOF.over - x);
    return ROOF.eave + ROOF.pitch * fromEave;
  }
  const RIDGE_Y = roofH(ROOF.ridgeX);            // 17'-11"

  /* ---- The vault -------------------------------------------------
     Great room ceiling: climbs at 3:12 from the 9' plate toward the
     ridge and flattens at 12'-6". Kinks at x=14 and x=26, where it
     meets the cap — ceiling panels are split there. */
  const VAULT = { slope: 0.25, cap: 12.5, ridgeX: ROOF.ridgeX };
  function vaultH(x) {
    const rise = VAULT.slope * (VAULT.ridgeX - Math.abs(x - VAULT.ridgeX));
    return Math.min(VAULT.cap, H_STD + Math.max(0, rise));
  }
  const VAULT_KINKS = [14, 26];

  /* Walls around the great room run to this — comfortably above the
     vault, with the ceiling hiding whatever sticks up past it. Too
     tall is invisible; too short leaves a gap. */
  const H_VAULT_TOP = 12.6;

  /* Opening profiles: sill height -> head height */
  const HOLE = {
    door:   { y0: 0,   y1: 6.75 },  // standard swing door
    arch:   { y0: 0,   y1: 8.0  },  // cased opening
    win:    { y0: 3.0, y1: 6.5  },  // standard window
    slider: { y0: 0,   y1: 6.9  },  // rear door to patio
    gdoor:  { y0: 0,   y1: 7.5  },  // overhead garage door
  };

  /* ---- Wall schedule -------------------------------------------
     axis 'x'  -> wall runs along z at constant x
     axis 'z'  -> wall runs along x at constant z
     a, b      -> extent along the running axis
     top       -> height the wall runs up to
     out       -> which side faces outdoors (+1 / -1), exterior only
     holes     -> [start, end, type] in the same units as a/b
  ---------------------------------------------------------------- */
  const walls = [
    /* ---------- EXTERIOR SHELL ---------- */
    // West wall — two dining, two flex, one bedroom 2 window
    { axis:'x', at:0, a:0, b:70, t:T_EXT, ext:true, out:-1, top:EXT_TOP,
      holes:[[2.1,5.1,'win'],[5.8,8.7,'win'],
             [27.7,30.6,'win'],[31.3,34.2,'win'],[43.5,46.4,'win']] },
    // East wall — primary shower window + bedroom 4
    { axis:'x', at:40, a:0, b:70, t:T_EXT, ext:true, out:+1, top:EXT_TOP,
      holes:[[16.8,20.5,'win'],[37.5,40.6,'win']] },
    // Rear wall: great-room windows + door out to the covered patio
    { axis:'z', at:0, a:0, b:40, t:T_EXT, ext:true, out:-1, top:EXT_TOP,
      holes:[[0.4,4.4,'win'],[7.6,9.6,'win'],[9.7,12.5,'slider'],
             [12.5,14.4,'win'],[21.2,24.9,'win'],
             [25.6,29.2,'win'],[36.0,39.6,'win']] },
    // Front wall: bedroom 3 windows, recessed porch, garage door
    { axis:'z', at:70, a:0, b:40, t:T_EXT, ext:true, out:+1, top:EXT_TOP,
      holes:[[3.7,6.4,'win'],[7.3,10.0,'win'],
             [13.7,18.98,'arch'],[21.2,37.7,'gdoor']] },

    // Rear gable: sits on the rear wall and closes the triangle up to
    // the ridge. Split at the ridge so each half is a flat plane.
    // Inside it is painted wall — you see it above the great room.
    { axis:'z', at:0, a:0, b:20, t:T_EXT, ext:true, out:-1, gable:true,
      outMat:'gable', y0:EXT_TOP, top:roofH(0), topB:RIDGE_Y },
    { axis:'z', at:0, a:20, b:40, t:T_EXT, ext:true, out:-1, gable:true,
      outMat:'gable', y0:EXT_TOP, top:RIDGE_Y, topB:roofH(40) },

    /* ---------- INTERIOR ---------- */
    // Family / primary suite divider (carries the raised ceiling)
    { axis:'x', at:25.2, a:0, b:16.1, t:T_INT, top:H_VAULT_TOP },
    // Primary bath vanity wall
    { axis:'x', at:28.95, a:15.8, b:22.9, t:T_INT, top:H_STD },
    // Bedroom 4 west wall + its door off the hall
    // ...and further along, the door to bedroom 4's own reach-in
    { axis:'x', at:28.95, a:34.9, b:49.0, t:T_INT, top:H_STD,
      holes:[[37.8,40.4,'door'],[45.0,47.5,'door']] },
    // Laundry / bath 3 divider
    { axis:'x', at:31.16, a:25.6, b:35.3, t:T_INT, top:H_STD },
    /* The east strip of the primary bath is three rooms stacked front
       to back, not one: the shower (glass front, door in the glass),
       then a linen closet, then a water closet with its own door.
       The two z-walls are what separate them; the x=36.7 pieces are
       the linen closet's door jambs. */
    { axis:'z', at:21.2, a:36.49, b:40, t:T_INT, top:H_STD },     // shower / linen
    { axis:'x', at:36.7, a:21.0, b:22.4, t:T_INT, top:H_STD },    // linen north jamb
    { axis:'x', at:36.7, a:24.9, b:26.2, t:T_INT, top:H_STD },    // linen south jamb
    { axis:'z', at:26.1, a:30.95, b:40, t:T_INT, top:H_STD,
      holes:[[32.05,34.43,'door']] },                             // water closet
    // Garage water-heater alcove
    { axis:'x', at:36.7, a:48.8, b:51.7, t:T_INT, top:H_STD },
    // Hall east wall / closet / garage-foyer wall
    { axis:'x', at:18.98, a:20.78, b:37.0, t:T_INT, top:H_STD },
    { axis:'x', at:18.98, a:41.1, b:43.4, t:T_INT, top:H_STD },
    { axis:'x', at:18.98, a:47.6, b:70,   t:T_INT, top:H_STD },
    // Kitchen return + hall west wall (door to the bath-2 vestibule)
    { axis:'x', at:13.45, a:22.7, b:25.07, t:T_INT, top:H_VAULT_TOP },
    { axis:'x', at:13.45, a:36.7, b:70, t:T_INT, top:H_STD,
      holes:[[51.6,54.6,'door']] },
    // Bath 2 east wall + its door
    { axis:'x', at:9.83, a:47.9, b:58.7, t:T_INT, top:H_STD,
      holes:[[51.1,53.5,'door']] },
    { axis:'x', at:6.25, a:47.9, b:50.7, t:T_INT, top:H_STD },

    // Primary suite south wall: suite door + opening into the bath
    { axis:'z', at:15.93, a:25.2, b:40, t:T_INT, top:H_STD,
      holes:[[25.45,28.45,'door'],[31.9,34.4,'arch']] },
    // Family / walk-in closet divider
    { axis:'z', at:20.78, a:18.8, b:25.2, t:T_INT, top:H_VAULT_TOP },
    { axis:'z', at:20.78, a:25.2, b:29.2, t:T_INT, top:H_STD },
    // Soffits: where the raised great-room ceiling opens into a 9'
    // space the ceiling steps down, so a short drop closes the gap.
    { axis:'z', at:20.78, a:13.45, b:18.8, t:T_INT, y0:H_STD, top:H_VAULT_TOP },
    { axis:'x', at:25.2, a:16.1, b:20.78, t:T_INT, y0:H_STD, top:H_VAULT_TOP },
    // ...and the same again where the kitchen opens onto the hall
    { axis:'x', at:13.45, a:20.78, b:22.7, t:T_INT, y0:H_STD, top:H_VAULT_TOP },
    // Kitchen / flex divider
    { axis:'z', at:25.07, a:0, b:13.7, t:T_INT, top:H_VAULT_TOP },
    // Pantry: a small walk-in off the kitchen. One door, in the east
    // wall at its north end — the north wall is solid. The drawing's
    // door is a hair narrower; it is widened to 2'-2" so the walker
    // (radius 0.85') fits through, same as the nudged fixtures.
    { axis:'z', at:20.3, a:0, b:4.85, t:T_INT, top:H_VAULT_TOP },
    { axis:'x', at:4.85, a:20.3, b:25.07, t:T_INT, top:H_VAULT_TOP,
      holes:[[20.55,22.75,'door']] },
    // Closet / laundry+bath 3 divider
    { axis:'z', at:29.64, a:18.8, b:40, t:T_INT, top:H_STD },
    // Bath 3 south wall + door into bedroom 4
    { axis:'z', at:35.18, a:28.7, b:39.9, t:T_INT, top:H_STD,
      holes:[[37.0,39.9,'door']] },
    // Flex / bedroom 2 divider
    { axis:'z', at:36.84, a:0, b:13.7, t:T_INT, top:H_STD },
    // Laundry south wall + laundry door
    { axis:'z', at:36.84, a:18.8, b:29.1, t:T_INT, top:H_STD,
      holes:[[24.9,27.6,'door']] },
    /* The block between the hall and the garage is not one space: it
       is three closets around a solid core, each opening a different
       way. Linen faces north into the hall, coats faces west into the
       mud hall, and bedroom 4's reach-in faces east into the bedroom.
       The mud hall is only the strip west of them. */
    { axis:'z', at:41.27, a:18.8, b:29.1, t:T_INT, top:H_STD,
      holes:[[25.2,27.7,'door']] },              // linen closet door
    { axis:'x', at:24.0, a:41.27, b:48.89, t:T_INT, top:H_STD,
      holes:[[45.0,47.5,'door']] },              // coat closet door
    { axis:'z', at:43.63, a:23.96, b:29.1, t:T_INT, top:H_STD },
    { axis:'x', at:26.45, a:43.63, b:48.89, t:T_INT, top:H_STD },
    // Bedroom 2 south wall + closet door
    { axis:'z', at:48.06, a:0, b:10.0, t:T_INT, top:H_STD,
      holes:[[1.9,4.4,'door']] },
    // Garage north wall + door into the house
    { axis:'z', at:48.89, a:18.8, b:40, t:T_INT, top:H_STD,
      holes:[[20.8,23.4,'door']] },
    // Closet / bath 2 divider
    { axis:'z', at:50.55, a:0, b:10.4, t:T_INT, top:H_STD,
      holes:[[6.9,9.0,'arch']] },
    // Bath 2 south wall
    { axis:'z', at:55.96, a:0, b:10.4, t:T_INT, top:H_STD },
    // Bedroom 3 closet (bifold) + the front door wall
    { axis:'z', at:58.59, a:0, b:10.0, t:T_INT, top:H_STD,
      holes:[[2.6,7.3,'arch']] },
    { axis:'z', at:58.59, a:13.45, b:18.98, t:T_EXT, top:H_STD,
      holes:[[14.7,17.8,'door']] },
  ];

  /* ---- Rooms: floors, ceilings and the label you see while walking
     Listed front-to-back priority; first match wins for labelling. --- */
  const rooms = [
    { id:'dining',  name:'Dining',       x0:0,     x1:13.45, z0:0,     z1:15.9,  floor:'wood',     ceil:'vault' },
    // pantry before kitchen: they overlap, and first match wins
    { id:'pantry',  name:'Pantry',       x0:0,     x1:4.85,  z0:20.3,  z1:25.07, floor:'wood',     ceil:H_STD },
    { id:'kitchen', name:'Kitchen',      x0:0,     x1:13.45, z0:15.9,  z1:25.07, floor:'wood',     ceil:'vault' },
    { id:'family',  name:'Family Room',  x0:13.45, x1:25.2,  z0:0,     z1:20.78, floor:'wood',     ceil:'vault' },
    { id:'pentry',  name:'Primary Entry',x0:25.2,  x1:28.95, z0:16.1,  z1:20.78, floor:'wood',     ceil:H_STD },
    { id:'primary', name:'Primary Suite',x0:25.2,  x1:40,    z0:0,     z1:15.93, floor:'wood',     ceil:H_STD },
    // the three small rooms come before pbath: they overlap it, and
    // first match wins
    { id:'shower',  name:'Shower',       x0:36.7,  x1:40,    z0:15.93, z1:21.2,  floor:'tile',     ceil:H_STD },
    { id:'plinen',  name:'Linen Closet', x0:36.7,  x1:40,    z0:21.2,  z1:26.1,  floor:'tile',     ceil:H_STD },
    { id:'wc',      name:'Water Closet', x0:31.16, x1:40,    z0:26.1,  z1:29.64, floor:'tile',     ceil:H_STD },
    { id:'pbath',   name:'Primary Bath', x0:28.95, x1:40,    z0:15.93, z1:29.64, floor:'tile',     ceil:H_STD },
    { id:'wic',     name:'Walk-In Closet',x0:18.98,x1:31.16, z0:20.78, z1:29.64, floor:'wood',     ceil:H_STD },
    { id:'flex',    name:'Flex Room',    x0:0,     x1:13.45, z0:25.07, z1:36.84, floor:'wood',     ceil:H_STD },
    { id:'hall',    name:'Hall',         x0:13.45, x1:18.98, z0:20.78, z1:48.06, floor:'wood',     ceil:H_STD },
    { id:'foyer',   name:'Foyer',        x0:13.45, x1:18.98, z0:48.06, z1:58.59, floor:'wood',     ceil:H_STD },
    { id:'ehall',   name:'Hall',         x0:18.98, x1:29.0,  z0:36.84, z1:41.27, floor:'wood',     ceil:H_STD },
    { id:'coats',   name:'Mud Hall',     x0:18.98, x1:24.0,  z0:41.27, z1:48.89, floor:'wood',     ceil:H_STD },
    { id:'linen',   name:'Linen Closet', x0:24.0,  x1:28.95, z0:41.27, z1:43.63, floor:'wood',     ceil:H_STD },
    { id:'coatcl',  name:'Coat Closet',  x0:24.0,  x1:26.45, z0:43.63, z1:48.89, floor:'wood',     ceil:H_STD },
    { id:'bed4cl',  name:"Bedroom 4 Closet", x0:26.45, x1:28.95, z0:43.63, z1:48.89, floor:'wood', ceil:H_STD },
    { id:'laundry', name:'Laundry',      x0:18.98, x1:31.16, z0:29.64, z1:36.84, floor:'tile',     ceil:H_STD },
    { id:'bath3',   name:'Bath 3',       x0:31.16, x1:40,    z0:29.64, z1:35.18, floor:'tile',     ceil:H_STD },
    { id:'bed4',    name:'Bedroom 4',    x0:28.95, x1:40,    z0:35.18, z1:48.89, floor:'wood',     ceil:H_STD },
    { id:'bed2',    name:'Bedroom 2',    x0:0,     x1:13.45, z0:36.84, z1:48.06, floor:'wood',     ceil:H_STD },
    { id:'cl2',     name:'Closet',       x0:0,     x1:9.83,  z0:48.06, z1:50.55, floor:'wood',     ceil:H_STD },
    { id:'bath2',   name:'Bath 2',       x0:0,     x1:9.83,  z0:50.55, z1:55.96, floor:'tile',     ceil:H_STD },
    { id:'vest',    name:'Hall',         x0:9.83,  x1:13.45, z0:48.06, z1:58.59, floor:'wood',     ceil:H_STD },
    { id:'cl3',     name:'Closet',       x0:0,     x1:9.83,  z0:55.96, z1:58.59, floor:'wood',     ceil:H_STD },
    { id:'bed3',    name:'Bedroom 3',    x0:0,     x1:13.45, z0:58.59, z1:70,    floor:'wood',     ceil:H_STD },
    { id:'garage',  name:'2-Car Garage', x0:18.98, x1:40,    z0:48.89, z1:70,    floor:'concrete', ceil:H_STD },
    { id:'porch',   name:'Front Porch',  x0:13.45, x1:18.98, z0:58.59, z1:70,    floor:'concrete', ceil:8.0, outdoor:true },
    { id:'patio',   name:'Covered Outdoor Living', x0:1.2, x1:13.7, z0:-8.7, z1:0, floor:'concrete', ceil:9.0, outdoor:true },
  ];

  /* ---- Fixtures & furniture: plain boxes, all from the plan ------ */
  const B = (x0,x1,z0,z1,y0,y1,mat) => ({x0,x1,z0,z1,y0,y1,mat});
  const fixtures = [
    // Kitchen — island with sink, perimeter run, uppers, fridge, pantry
    B(6.05, 9.74, 10.9, 18.5,  0,   3.0,  'cab'),
    B(5.75, 10.04, 10.6, 18.8, 3.0, 3.18, 'counter'),
    B(0.0,  2.1,  10.5, 20.3,  0,   3.0,  'cab'),
    B(0.0,  2.3,  10.5, 20.3,  3.0, 3.18, 'counter'),
    B(0.0,  1.15, 10.5, 20.3,  4.6, 7.0,  'cab'),
    B(0.0,  2.1,  13.6, 16.5,  0,   3.1,  'steel'),   // range
    B(9.97, 12.5, 21.9, 24.6,  0,   6.0,  'steel'),   // refrigerator
    // pantry shelving, along the back and side so you can still step in
    B(0.0,  1.2,  20.4, 25.07, 0,   6.6,  'cab'),
    B(1.2,  4.85, 23.9, 25.07, 0,   6.6,  'cab'),

    // Dining
    B(4.2, 9.2, 3.2, 6.6, 2.1, 2.45, 'wood2'),
    B(4.5, 4.9, 3.5, 6.3, 0, 2.1, 'wood2'), B(8.5, 8.9, 3.5, 6.3, 0, 2.1, 'wood2'),

    // Family — sofa, coffee table, media console + TV on the accent wall
    B(15.2, 21.6, 8.6, 11.6, 0, 2.3, 'sofa'),
    B(16.8, 20.0, 5.4, 7.4, 0, 1.4, 'wood2'),
    B(23.9, 25.0, 3.0, 9.0, 0, 2.2, 'wood2'),
    B(24.8, 25.05, 3.6, 8.4, 3.0, 6.0, 'tv'),

    // Primary suite — bed + nightstands
    B(30.0, 36.6, 0.4, 7.2, 0, 2.1, 'bed'),
    B(29.0, 30.0, 0.4, 2.0, 0, 1.9, 'wood2'), B(36.6, 37.6, 0.4, 2.0, 0, 1.9, 'wood2'),
    // Primary bath — double vanity, then the shower: pan up to the
    // linen divider, glass front with the entry gap at z 17.6–19.7
    // where the plan draws the pivot door.
    B(28.95, 31.16, 16.2, 20.8, 0, 2.9, 'cab'),
    B(28.95, 31.36, 16.2, 20.8, 2.9, 3.05, 'counter'),
    B(36.7, 40, 16.14, 20.99, 0, 0.35, 'tile2'),
    B(36.68, 36.82, 16.14, 17.6, 0.35, 7.0, 'glass'),
    B(36.68, 36.82, 19.7, 20.99, 0.35, 7.0, 'glass'),

    // Walk-in closet — shelving. The east run stops short of z 26 so
    // it does not sit across the opening from the primary bath.
    B(19.2, 20.6, 21.0, 29.4, 0, 6.6, 'cab'),
    B(29.9, 31.1, 26.6, 29.4, 0, 6.6, 'cab'),

    // Laundry — washer + dryer
    B(19.3, 22.3, 30.3, 33.0, 0, 3.0, 'steel'),
    B(19.3, 22.3, 33.2, 35.9, 0, 3.0, 'steel'),

    // Bath 3 — tub + vanity
    B(31.4, 33.4, 30.0, 35.0, 0, 1.6, 'tile2'),
    B(37.4, 40, 29.64, 31.6, 0, 2.9, 'cab'),
    B(37.2, 40, 29.64, 31.8, 2.9, 3.05, 'counter'),

    // Bath 2 — tub on the outside wall, vanity along the south wall
    // so the doorway on the east side stays clear.
    B(0.5, 2.5, 51.0, 55.6, 0, 1.6, 'tile2'),
    B(3.4, 9.83, 54.6, 55.96, 0, 2.9, 'cab'),
    B(3.2, 9.83, 54.4, 55.96, 2.9, 3.05, 'counter'),

    // Bedrooms 2 / 3 / 4 — beds + nightstands
    B(3.0, 8.0, 37.4, 44.0, 0, 2.0, 'bed'),
    B(3.0, 8.0, 63.4, 69.4, 0, 2.0, 'bed'),
    B(35.4, 40.0, 40.2, 46.8, 0, 2.0, 'bed'),

    // Mud hall bench + garage water heater
    B(19.2, 22.4, 41.5, 42.9, 0, 1.5, 'wood2'),
    B(37.0, 39.6, 49.2, 51.4, 0, 4.8, 'steel'),
  ];

  /* Accent wall — the deep navy behind the TV in the listing photos */
  const accents = [ { axis:'x', at:25.2, a:0, b:16.1, side:-1 } ];

  /* Where the room-jump buttons drop you.
     look: 0 faces the rear of the house, PI the street,
     -PI/2 east, +PI/2 west. */
  const N = 0, S = Math.PI, E = -Math.PI / 2, W = Math.PI / 2;
  const spawns = [
    { id:'front',   name:'Front Walk',    x:16.2, z:80,   look:N },
    { id:'foyer',   name:'Foyer',         x:16.2, z:55.5, look:N },
    { id:'family',  name:'Family Room',   x:19.4, z:14.5, look:N },
    { id:'kitchen', name:'Kitchen',       x:11.0, z:17.5, look:N },
    { id:'dining',  name:'Dining',        x:6.5,  z:9.5,  look:E },
    { id:'flex',    name:'Flex Room',     x:6.5,  z:31.0, look:E },
    { id:'primary', name:'Primary Suite', x:32.0, z:12.0, look:N },
    { id:'pbath',   name:'Primary Bath',  x:34.5, z:23.2, look:N },
    { id:'wic',     name:'Walk-In Closet',x:25.0, z:25.2, look:E },
    { id:'bed2',    name:'Bedroom 2',     x:6.7,  z:46.0, look:N },
    { id:'bed3',    name:'Bedroom 3',     x:6.7,  z:61.5, look:S },
    { id:'bed4',    name:'Bedroom 4',     x:33.0, z:46.5, look:N },
    { id:'laundry', name:'Laundry',       x:26.5, z:33.0, look:W },
    { id:'garage',  name:'Garage',        x:29.0, z:60.0, look:N },
    { id:'patio',   name:'Covered Patio', x:7.0,  z:-4.5, look:S },
  ];

  return {
    T_EXT, T_INT, H_STD, EXT_TOP, HOLE,
    ROOF, RIDGE_Y, roofH, vaultH, VAULT_KINKS,
    walls, rooms, fixtures, accents, spawns,
    bounds: { x0: 0, x1: 40, z0: 0, z1: 70 },
    // Walls are flat-topped unless topB is given, in which case the
    // top ramps from `top` at a to `topB` at b — that is the gable.
    topOf(w, u) {
      if (w.topB === undefined) return w.top;
      const t = (u - w.a) / (w.b - w.a);
      return w.top + (w.topB - w.top) * t;
    },
  };
})();
