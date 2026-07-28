/* ------------------------------------------------------------------
   build.js — turns the PLAN data into flat-shaded three.js geometry.

   Everything is built from axis-aligned quads collected into one
   buffer per material, so the whole house is a handful of draw calls.
------------------------------------------------------------------ */

const BUILD = (function () {

  /* Palette sampled from the listing photos: warm cream walls, light
     wide-plank floors, white cabinets, one navy accent wall. */
  const COLORS = {
    wall:    0xe9e3d9, accent:  0x2e4450, ceil:    0xf6f4ef,
    wood:    0xc7ac8b, tile:    0xd9d4cc, concrete:0x9e9c97,
    cab:     0xf7f6f2, counter: 0xedebe4, steel:   0xb9bdc0,
    wood2:   0x6e5847, sofa:    0xe4ded2, bed:     0xdedad0,
    tv:      0x1e2124, tile2:   0xe4e1da, glass:   0xbbd3e0,
    siding:  0xa8ada2, trim:    0xfbfaf7, roof:    0x6b6259,
    gable:   0x8f9a8c,
    gdoor:   0x8d8579, fdoor:   0x39352f, grass:   0x7e9c5f,
    drive:   0xbdbab4, street:  0x55555a, stone:   0xd8d5cb,
  };

  /* --- quad collector: one BufferGeometry per material --------- */
  class Bag {
    constructor() { this.b = new Map(); }
    _get(m) { if (!this.b.has(m)) this.b.set(m, []); return this.b.get(m); }
    // p0..p3 wound counter-clockwise as seen from the visible side
    quad(m, p0, p1, p2, p3) {
      const a = this._get(m);
      a.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
    }
    tri(m, p0, p1, p2) { this._get(m).push(...p0, ...p1, ...p2); }
    box(m, x0, x1, y0, y1, z0, z1) {
      const V = (x, y, z) => [x, y, z];
      this.quad(m, V(x0,y0,z1), V(x1,y0,z1), V(x1,y1,z1), V(x0,y1,z1)); // +z
      this.quad(m, V(x1,y0,z0), V(x0,y0,z0), V(x0,y1,z0), V(x1,y1,z0)); // -z
      this.quad(m, V(x1,y0,z1), V(x1,y0,z0), V(x1,y1,z0), V(x1,y1,z1)); // +x
      this.quad(m, V(x0,y0,z0), V(x0,y0,z1), V(x0,y1,z1), V(x0,y1,z0)); // -x
      this.quad(m, V(x0,y1,z1), V(x1,y1,z1), V(x1,y1,z0), V(x0,y1,z0)); // +y
      this.quad(m, V(x0,y0,z0), V(x1,y0,z0), V(x1,y0,z1), V(x0,y0,z1)); // -y
    }
    meshes(materials) {
      const out = [];
      for (const [name, arr] of this.b) {
        if (!arr.length) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
        g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, materials[name]);
        mesh.name = name;
        out.push(mesh);
      }
      return out;
    }
  }

  function makeMaterials() {
    const M = {};
    for (const k in COLORS) {
      M[k] = new THREE.MeshLambertMaterial({
        color: COLORS[k], flatShading: true, side: THREE.DoubleSide,
      });
    }
    M.glass = new THREE.MeshLambertMaterial({
      color: COLORS.glass, flatShading: true, side: THREE.DoubleSide,
      transparent: true, opacity: 0.28, depthWrite: false,
    });
    return M;
  }

  /* --- one solid slice of wall, with an optionally sloped top ----
     Local coords: u runs along the wall, s is the thickness offset. */
  function wallSlice(bag, w, u0, u1, yb, yt0, yt1, matIn, matOut) {
    if (u1 - u0 < 1e-4) return;
    const h = w.t / 2;
    // world position for (u, y, side)
    const P = w.axis === 'x'
      ? (u, y, s) => [w.at + s * h, y, u]
      : (u, y, s) => [u, y, w.at + s * h];

    const A = P(u0, yb, -1),  B = P(u1, yb, -1);
    const C = P(u1, yt1, -1), D = P(u0, yt0, -1);
    const E = P(u0, yb, +1),  F = P(u1, yb, +1);
    const G = P(u1, yt1, +1), H = P(u0, yt0, +1);

    // The two broad faces. For exterior walls one of them is cladding.
    const negMat = (w.ext && w.out === -1) ? matOut : matIn;
    const posMat = (w.ext && w.out === +1) ? matOut : matIn;
    bag.quad(negMat, A, B, C, D);
    bag.quad(posMat, F, E, H, G);
    // top, and the two cut ends (reveals inside door/window openings)
    bag.quad(matIn, D, C, G, H);
    bag.quad(matIn, E, A, D, H);
    bag.quad(matIn, B, F, G, C);
  }

  /* --- a wall: solid between its holes, header above, sill below -- */
  function buildWall(bag, w) {
    const yBase = w.y0 || 0;
    const top = (u) => PLAN.topOf(w, u);
    const holes = (w.holes || []).slice().sort((a, b) => a[0] - b[0]);
    const matIn = w.accent ? 'accent' : 'wall';
    const matOut = w.outMat || 'siding';

    let cursor = w.a;
    for (const [h0, h1, kind] of holes) {
      const prof = PLAN.HOLE[kind];
      const s = Math.max(h0, w.a), e = Math.min(h1, w.b);
      if (e <= s) continue;
      // full-height pier before the opening
      wallSlice(bag, w, cursor, s, yBase, top(cursor), top(s), matIn, matOut);
      // sill below the opening (windows) and header above it
      if (prof.y0 > yBase) wallSlice(bag, w, s, e, yBase, prof.y0, prof.y0, matIn, matOut);
      const tS = top(s), tE = top(e);
      if (prof.y1 < Math.max(tS, tE)) {
        wallSlice(bag, w, s, e, prof.y1, tS, tE, matIn, matOut);
      }
      addOpeningDressing(bag, w, s, e, prof, kind);
      cursor = e;
    }
    wallSlice(bag, w, cursor, w.b, yBase, top(cursor), top(w.b), matIn, matOut);
  }

  /* Glass + white trim inside window openings, slabs for the two
     big doors that read as objects rather than holes. */
  function addOpeningDressing(bag, w, u0, u1, prof, kind) {
    const P = w.axis === 'x'
      ? (u, y, s) => [w.at + s, y, u]
      : (u, y, s) => [u, y, w.at + s];

    if (kind === 'win' || kind === 'slider') {
      const g = 0.02;
      bag.quad('glass', P(u0, prof.y0, g), P(u1, prof.y0, g),
                        P(u1, prof.y1, g), P(u0, prof.y1, g));
      // trim ring, set just inside the reveal
      const t = 0.16, d = w.t / 2 + 0.01;
      for (const s of [-d, d]) {
        bag.quad('trim', P(u0, prof.y0, s), P(u0 + t, prof.y0, s),
                         P(u0 + t, prof.y1, s), P(u0, prof.y1, s));
        bag.quad('trim', P(u1 - t, prof.y0, s), P(u1, prof.y0, s),
                         P(u1, prof.y1, s), P(u1 - t, prof.y1, s));
        bag.quad('trim', P(u0, prof.y1 - t, s), P(u1, prof.y1 - t, s),
                         P(u1, prof.y1, s), P(u0, prof.y1, s));
        bag.quad('trim', P(u0, prof.y0, s), P(u1, prof.y0, s),
                         P(u1, prof.y0 + t, s), P(u0, prof.y0 + t, s));
      }
    }
    if (kind === 'gdoor') {
      const d = w.t / 2 - 0.06;
      bag.quad('gdoor', P(u0, 0, d), P(u1, 0, d), P(u1, prof.y1, d), P(u0, prof.y1, d));
      bag.quad('gdoor', P(u1, 0, -d), P(u0, 0, -d), P(u0, prof.y1, -d), P(u1, prof.y1, -d));
    }
    if (kind === 'door' && w.t >= PLAN.T_EXT) {   // the front door
      const d = w.t / 2 - 0.06;
      bag.quad('fdoor', P(u0, 0, d), P(u1, 0, d), P(u1, prof.y1, d), P(u0, prof.y1, d));
      bag.quad('fdoor', P(u1, 0, -d), P(u0, 0, -d), P(u0, prof.y1, -d), P(u1, prof.y1, -d));
    }
  }

  /* --- ceilings --------------------------------------------------
     Flat rooms are one quad. A vaulted room follows the slope in x,
     so it is split at every kink in the vault profile that falls
     inside the room — otherwise the panel would cut the corner. */
  function ceilingPanels(bag, r) {
    if (r.ceil !== 'vault') {
      const h = r.ceil;
      bag.quad('ceil', [r.x0, h, r.z0], [r.x1, h, r.z0],
                       [r.x1, h, r.z1], [r.x0, h, r.z1]);
      return;
    }
    const cuts = [r.x0, ...PLAN.VAULT_KINKS.filter(k => k > r.x0 && k < r.x1), r.x1];
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1];
      const ha = PLAN.vaultH(a), hb = PLAN.vaultH(b);
      bag.quad('ceil', [a, ha, r.z0], [b, hb, r.z0],
                       [b, hb, r.z1], [a, ha, r.z1]);
    }
  }

  /* --- roof: 4:12, gabled at the rear and hipped at the front ----
     The two long slopes run the length of the house and meet at the
     ridge. The front end hips in to a point; the rear end runs
     straight out to the gable, which is what gives the great room
     the headroom to vault. */
  function buildRoof(bag) {
    const o = PLAN.ROOF.over, ex = PLAN.ROOF.eave, pitch = PLAN.ROOF.pitch;
    const x0 = -o, x1 = 40 + o, z0 = -o, z1 = 70 + o;
    const half = (x1 - x0) / 2;
    const rx = x0 + half;          // ridge, x = 20
    const rzS = z1 - half;         // where the front hip starts
    const ry = ex + half * pitch;  // ridge height
    const V = (x, y, z) => [x, y, z];

    bag.quad('roof', V(x0,ex,z0), V(x0,ex,z1), V(rx,ry,rzS), V(rx,ry,z0)); // west
    bag.quad('roof', V(x1,ex,z1), V(x1,ex,z0), V(rx,ry,z0), V(rx,ry,rzS)); // east
    bag.tri('roof',  V(x0,ex,z1), V(x1,ex,z1), V(rx,ry,rzS));              // front hip

    // fascia along the eaves and the front, then rake boards up the gable
    bag.box('trim', x0, x1, ex - 0.55, ex, z1 - 0.12, z1);
    bag.box('trim', x0, x0 + 0.12, ex - 0.55, ex, z0, z1);
    bag.box('trim', x1 - 0.12, x1, ex - 0.55, ex, z0, z1);
    const d = 0.55;
    bag.quad('trim', V(x0,ex,z0), V(rx,ry,z0), V(rx,ry-d,z0), V(x0,ex-d,z0));
    bag.quad('trim', V(rx,ry,z0), V(x1,ex,z0), V(x1,ex-d,z0), V(rx,ry-d,z0));
  }

  /* --- site: lawn, drive, walk, street, covered patio ------------ */
  function buildSite(bag) {
    const y = 0.0;
    bag.quad('grass', [-70, -0.05, 130], [110, -0.05, 130], [110, -0.05, -70], [-70, -0.05, -70]);
    // driveway from the garage door out to the street
    bag.quad('drive', [21.2, y, 96], [37.7, y, 96], [37.7, y, 70], [21.2, y, 70]);
    // walk from the porch to the driveway
    bag.quad('drive', [14.2, y, 82], [18.5, y, 82], [18.5, y, 70], [14.2, y, 70]);
    bag.quad('drive', [14.2, y, 86], [37.7, y, 86], [37.7, y, 82], [14.2, y, 82]);
    // sidewalk + street
    bag.quad('drive', [-40, y, 100], [90, y, 100], [90, y, 96], [-40, y, 96]);
    bag.quad('street', [-40, y, 124], [90, y, 124], [90, y, 104], [-40, y, 104]);

    // covered outdoor living: slab, two posts, flat roof
    bag.box('concrete', 1.2, 13.7, -0.05, 0.35, -8.7, 0);
    bag.box('trim', 1.2, 2.0, 0.35, 9.2, -8.7, -7.9);
    bag.box('trim', 12.9, 13.7, 0.35, 9.2, -8.7, -7.9);
    bag.box('roof', 0.9, 14.0, 9.2, 9.7, -9.0, 0);
  }

  /* --- collision: the rectangles you cannot walk through --------
     A span blocks if it is solid anywhere between knee and head
     height, so doorways are open but window sills are not. */
  function collisionRects() {
    const LO = 0.6, HI = 6.2, out = [];
    const add = (w, u0, u1) => {
      if (u1 - u0 < 1e-4) return;
      const h = w.t / 2;
      out.push(w.axis === 'x'
        ? { x0: w.at - h, x1: w.at + h, z0: u0, z1: u1 }
        : { x0: u0, x1: u1, z0: w.at - h, z1: w.at + h });
    };
    for (const w of PLAN.walls) {
      const yBase = w.y0 || 0;
      if (yBase >= HI) continue;                 // soffits are overhead
      const holes = (w.holes || []).slice().sort((a, b) => a[0] - b[0]);
      let cursor = w.a;
      for (const [h0, h1, kind] of holes) {
        const s = Math.max(h0, w.a), e = Math.min(h1, w.b);
        if (e <= s) continue;
        add(w, cursor, s);
        const p = PLAN.HOLE[kind];
        if (p.y0 > LO || p.y1 < HI) add(w, s, e);   // sill or low header
        cursor = e;
      }
      add(w, cursor, w.b);
    }
    // solid fixtures you should bump into
    for (const f of PLAN.fixtures) {
      if (f.y1 < LO || f.mat === 'glass') continue;
      out.push({ x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1 });
    }
    return out;
  }

  /* --- assemble --------------------------------------------------- */
  function buildHouse() {
    const materials = makeMaterials();
    const shell = new Bag(), roofBag = new Bag(), ceilBag = new Bag(),
          furnBag = new Bag(), gableBag = new Bag();

    // mark the accent wall
    for (const a of PLAN.accents) {
      for (const w of PLAN.walls) {
        if (w.axis === a.axis && Math.abs(w.at - a.at) < 0.01 &&
            w.a >= a.a - 0.01 && w.b <= a.b + 0.01) w.accent = true;
      }
    }

    // the gable rides with the roof so the dollhouse view can drop it
    for (const w of PLAN.walls) buildWall(w.gable ? gableBag : shell, w);
    for (const r of PLAN.rooms) {
      const fm = r.floor === 'wood' ? 'wood' : r.floor === 'tile' ? 'tile' : 'concrete';
      shell.quad(fm, [r.x0, 0.02, r.z1], [r.x1, 0.02, r.z1], [r.x1, 0.02, r.z0], [r.x0, 0.02, r.z0]);
      if (r.outdoor) continue;
      ceilingPanels(ceilBag, r);
    }
    for (const f of PLAN.fixtures) furnBag.box(f.mat, f.x0, f.x1, f.y0, f.y1, f.z0, f.z1);
    buildRoof(roofBag);
    buildSite(shell);

    const groups = {
      shell:   new THREE.Group(),
      ceiling: new THREE.Group(),
      roof:    new THREE.Group(),
      gable:   new THREE.Group(),
      furniture: new THREE.Group(),
    };
    shell.meshes(materials).forEach(m => groups.shell.add(m));
    ceilBag.meshes(materials).forEach(m => groups.ceiling.add(m));
    roofBag.meshes(materials).forEach(m => groups.roof.add(m));
    gableBag.meshes(materials).forEach(m => groups.gable.add(m));
    furnBag.meshes(materials).forEach(m => groups.furniture.add(m));

    return { groups, materials, colliders: collisionRects() };
  }

  return { buildHouse, COLORS };
})();
