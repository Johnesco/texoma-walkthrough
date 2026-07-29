/* ------------------------------------------------------------------
   textures.js — procedural surfaces, drawn to canvases at load.

   Nothing is loaded from disk or the network: a page opened straight
   off the filesystem cannot fetch image files (CORS treats every local
   file as its own origin), and shipping the listing photos would mean
   redistributing someone else's photography. So the patterns are
   generated, and only the *proportions* come from the photos:

     plank tone spread   0.88 - 1.06   (sampled 134 vs 176 luminance)
     plank seam          0.55          (sampled 74 vs 155)
     drywall mottle      0.96 - 1.00   (sampled 179 vs 193)
     tile grout          0.72          (sampled 97 vs 139)

   Every map is a light/dark modulation around white, so it multiplies
   the existing palette rather than replacing it. Switching textures
   off returns exactly the untextured look.
------------------------------------------------------------------ */

const TEXTURES = (function () {

  /* Feet of world space per full repeat of each map. Because UVs are
     projected from world position, this is a real-world size: planks
     are the same width in every room. */
  const UV_FEET = {
    wood: 8, tile: 4, concrete: 12, wall: 6, ceil: 6, accent: 6,
    siding: 4, gable: 4, roof: 6, counter: 4, cab: 4, tile2: 4,
  };

  /* Deterministic PRNG — the floor must look the same on every load. */
  function rnd(seed) {
    let s = seed >>> 0;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  }

  function surface(px) {
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, px, px);
    return { c, g };
  }

  const grey = (v) => {
    const n = Math.max(0, Math.min(255, Math.round(255 * v)));
    return `rgb(${n},${n},${n})`;
  };

  /* Wide-plank flooring: 12 courses across 8 ft, joints staggered. */
  function wood(px) {
    const { c, g } = surface(px), rows = 12, h = px / rows, R = rnd(7);
    for (let r = 0; r < rows; r++) {
      const y = r * h;
      let x = -Math.floor(R() * px * 0.5);
      while (x < px) {
        const w = px * (0.38 + R() * 0.26);
        g.fillStyle = grey(0.90 + R() * 0.15);
        g.fillRect(x, y, w, h);
        g.fillStyle = 'rgba(0,0,0,0.42)';       // end joint
        g.fillRect(x, y, 1.5, h);
        x += w;
      }
      for (let i = 0; i < 30; i++) {            // lengthwise grain
        const gy = y + R() * h, x0 = R() * px, len = px * (0.1 + R() * 0.5);
        g.strokeStyle = R() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)';
        g.lineWidth = 0.6 + R();
        g.beginPath(); g.moveTo(x0, gy); g.lineTo(x0 + len, gy); g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.45)';         // course seam
      g.fillRect(0, y + h - 1.5, px, 1.5);
    }
    return c;
  }

  /* 12" floor tile with grout joints and a little mottling. */
  function tile(px) {
    const { c, g } = surface(px), n = 4, s = px / n, R = rnd(19);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = grey(0.93 + R() * 0.07);
      g.fillRect(i * s, j * s, s, s);
      for (let k = 0; k < 40; k++) {            // speckle
        g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.05)';
        g.fillRect(i * s + R() * s, j * s + R() * s, 2 + R() * 9, 2 + R() * 9);
      }
    }
    g.fillStyle = grey(0.72);                   // grout
    for (let i = 0; i <= n; i++) {
      g.fillRect(i * s - 1.5, 0, 3, px);
      g.fillRect(0, i * s - 1.5, px, 3);
    }
    return c;
  }

  /* Flat paint: a barely-there mottle so big walls are not dead flat. */
  function paint(px, lo, seed) {
    const { c, g } = surface(px), R = rnd(seed);
    const img = g.getImageData(0, 0, px, px), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = 255 * (lo + (1 - lo) * R());
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    g.putImageData(img, 0, 0);
    // soften the per-pixel noise into something closer to orange peel
    g.globalAlpha = 0.55;
    g.drawImage(c, -1, 0); g.drawImage(c, 1, 0); g.drawImage(c, 0, 1);
    g.globalAlpha = 1;
    return c;
  }

  /* Troweled concrete: broad blotches rather than fine grain. */
  function concrete(px) {
    const { c, g } = surface(px), R = rnd(31);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.045)' : 'rgba(255,255,255,0.05)';
      const r = 6 + R() * 46;
      g.beginPath(); g.arc(R() * px, R() * px, r, 0, Math.PI * 2); g.fill();
    }
    return c;
  }

  /* Horizontal lap siding — a shadow line at the butt of each course. */
  function siding(px) {
    const { c, g } = surface(px), rows = 6, h = px / rows, R = rnd(53);
    for (let r = 0; r < rows; r++) {
      const y = r * h;
      g.fillStyle = grey(0.95 + R() * 0.05);
      g.fillRect(0, y, px, h);
      g.fillStyle = 'rgba(0,0,0,0.30)';
      g.fillRect(0, y + h - 2.5, px, 2.5);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, y + h, px, 1);
    }
    return c;
  }

  /* Board and batten for the gable: vertical boards with raised battens. */
  function batten(px) {
    const { c, g } = surface(px), cols = 8, w = px / cols, R = rnd(67);
    for (let i = 0; i < cols; i++) {
      g.fillStyle = grey(0.94 + R() * 0.06);
      g.fillRect(i * w, 0, w, px);
      g.fillStyle = 'rgba(0,0,0,0.26)';
      g.fillRect(i * w - 2, 0, 4, px);
      g.fillStyle = 'rgba(255,255,255,0.30)';
      g.fillRect(i * w + 2, 0, 2, px);
    }
    return c;
  }

  /* Shingle courses with tab joints. */
  function shingle(px) {
    const { c, g } = surface(px), rows = 8, h = px / rows, R = rnd(83);
    for (let r = 0; r < rows; r++) {
      const y = r * h;
      let x = -R() * px * 0.25;
      while (x < px) {
        const w = px * 0.16;
        g.fillStyle = grey(0.86 + R() * 0.16);
        g.fillRect(x, y, w - 1.5, h - 1.5);
        x += w;
      }
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, y + h - 2, px, 2);
    }
    return c;
  }

  /* Quartz: white with a fine dark/light speckle. */
  function quartz(px) {
    const { c, g } = surface(px), R = rnd(97);
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = R() < 0.55 ? 'rgba(0,0,0,0.05)' : 'rgba(190,190,190,0.10)';
      g.fillRect(R() * px, R() * px, 1 + R() * 2.2, 1 + R() * 2.2);
    }
    return c;
  }

  /* Shaker-ish cabinet face: a soft inset panel. */
  function cabinet(px) {
    const { c, g } = surface(px), R = rnd(101), m = px * 0.14;
    g.fillStyle = 'rgba(0,0,0,0.05)';
    g.fillRect(m, m, px - 2 * m, px - 2 * m);
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 3;
    g.strokeRect(m, m, px - 2 * m, px - 2 * m);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5;
    g.strokeRect(m + 3, m + 3, px - 2 * m - 6, px - 2 * m - 6);
    for (let i = 0; i < 600; i++) {
      g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)';
      g.fillRect(R() * px, R() * px, 2, 2);
    }
    return c;
  }

  /* Build the whole set. Returns {} where there is no canvas to draw
     on, which keeps the module importable outside a browser. */
  function build(maxAnisotropy) {
    if (typeof document === 'undefined') return {};
    const src = {
      wood: wood(1024),
      tile: tile(512),
      tile2: tile(512),
      concrete: concrete(512),
      wall: paint(256, 0.96, 3),
      ceil: paint(256, 0.975, 11),
      accent: paint(256, 0.94, 13),
      siding: siding(512),
      gable: batten(512),
      roof: shingle(512),
      counter: quartz(512),
      cab: cabinet(512),
    };
    const out = {};
    for (const k in src) {
      const t = new THREE.CanvasTexture(src[k]);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = maxAnisotropy || 1;
      if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
      out[k] = t;
    }
    return out;
  }

  return { build, UV_FEET };
})();
