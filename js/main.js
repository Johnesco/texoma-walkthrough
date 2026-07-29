/* ------------------------------------------------------------------
   main.js — scene, lighting, view modes, minimap and UI wiring.
------------------------------------------------------------------ */

(function () {
  const canvas = document.getElementById('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0xbcd4e6);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xbcd4e6, 160, 420);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 900);

  /* --- lighting: plain and even, so flat shading reads clearly --- */
  scene.add(new THREE.HemisphereLight(0xdceaf6, 0xb4aea2, 1.0));
  // Sun from the south-west so the street elevation is lit, with a
  // cool fill from the opposite side to keep back rooms readable.
  const sun = new THREE.DirectionalLight(0xfff4e2, 1.15);
  sun.position.set(-55, 62, 60);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdfe8f2, 0.5);
  fill.position.set(45, 28, -55);
  scene.add(fill);
  // Ceilings face straight down, so without a light from below they
  // read as black. This stands in for bounce off the floor.
  const bounce = new THREE.DirectionalLight(0xfff3e6, 0.55);
  bounce.position.set(6, -30, 18);
  scene.add(bounce);
  scene.add(new THREE.AmbientLight(0xffffff, 0.26));

  /* --- the house ------------------------------------------------- */
  const house = BUILD.buildHouse();
  BUILD.attachTextures(house, renderer.capabilities.getMaxAnisotropy());
  let textured = true;
  BUILD.setTextures(house, textured);
  const root = new THREE.Group();
  root.add(house.groups.shell, house.groups.ceiling, house.groups.roof,
           house.groups.gable, house.groups.furniture);
  scene.add(root);

  /* --- controls -------------------------------------------------- */
  const walker = new CONTROLS.Walker(camera, canvas, house.colliders);
  const orbit = new CONTROLS.Orbit(camera, canvas);

  /* --- UI elements ----------------------------------------------- */
  const el = (id) => document.getElementById(id);
  const overlay = el('overlay'), roomLabel = el('roomLabel'),
        crosshair = el('crosshair'), hint = el('hint');
  const mapCanvas = el('map'), mapCtx = mapCanvas.getContext('2d');

  let mode = 'walk';

  function setMode(next) {
    mode = next;
    const walk = next === 'walk';
    walker.enabled = walk;
    orbit.enabled = !walk;
    house.groups.ceiling.visible = next !== 'dollhouse';
    house.groups.roof.visible = next !== 'dollhouse';
    house.groups.gable.visible = next !== 'dollhouse';
    crosshair.style.display = walk && walker.locked ? 'block' : 'none';
    overlay.style.display = walk && !walker.locked ? 'flex' : 'none';
    hint.style.display = walk ? 'block' : 'none';
    document.querySelectorAll('[data-mode]').forEach(b =>
      b.classList.toggle('on', b.dataset.mode === next));

    if (walk) { camera.fov = 70; walker.apply(); }
    else {
      camera.fov = 45;
      walker.exitLock();
      // theta 0 puts the camera on the street side, so the front
      // elevation faces you and the plan reads the same way up as the
      // minimap (rear of the house at the top).
      if (next === 'dollhouse') orbit.set(new THREE.Vector3(20, 0, 33), 108, 0, 0.26);
      else orbit.set(new THREE.Vector3(20, 5, 36), 104, 0, 1.40);
    }
    camera.updateProjectionMatrix();
  }

  walker.onLockChange = (locked) => {
    if (mode !== 'walk') return;
    overlay.style.display = locked ? 'none' : 'flex';
    crosshair.style.display = locked ? 'block' : 'none';
  };

  overlay.addEventListener('click', () => walker.requestLock());
  document.querySelectorAll('[data-mode]').forEach(b =>
    b.addEventListener('click', () => setMode(b.dataset.mode)));

  el('toggleFurniture').addEventListener('click', (e) => {
    house.groups.furniture.visible = !house.groups.furniture.visible;
    e.currentTarget.classList.toggle('on', house.groups.furniture.visible);
  });

  function setTextured(on) {
    textured = on;
    BUILD.setTextures(house, on);
    el('toggleTextures').classList.toggle('on', on);
  }
  el('toggleTextures').addEventListener('click', () => setTextured(!textured));

  /* Room jump buttons */
  const jumpWrap = el('jumps');
  PLAN.spawns.forEach(s => {
    const b = document.createElement('button');
    b.textContent = s.name;
    b.addEventListener('click', () => {
      if (mode !== 'walk') setMode('walk');
      walker.teleport(s.x, s.z, s.look);
      walker.requestLock();
    });
    jumpWrap.appendChild(b);
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') el('mapWrap').classList.toggle('hidden');
    if (e.code === 'KeyT') setTextured(!textured);
    if (e.code === 'Digit1') setMode('walk');
    if (e.code === 'Digit2') setMode('dollhouse');
    if (e.code === 'Digit3') setMode('exterior');
  });

  /* --- which room am I standing in? ------------------------------ */
  function roomAt(x, z) {
    for (const r of PLAN.rooms) {
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r;
    }
    return null;
  }

  /* --- minimap: drawn from the same wall data as the 3D --------- */
  const MAP = { x0: -2, x1: 42, z0: -11, z1: 73 };
  function drawMap() {
    const w = mapCanvas.width, h = mapCanvas.height;
    const sx = w / (MAP.x1 - MAP.x0), sz = h / (MAP.z1 - MAP.z0);
    const s = Math.min(sx, sz);
    const ox = (w - (MAP.x1 - MAP.x0) * s) / 2 - MAP.x0 * s;
    const oz = (h - (MAP.z1 - MAP.z0) * s) / 2 - MAP.z0 * s;
    const X = (x) => ox + x * s, Z = (z) => oz + z * s;

    mapCtx.clearRect(0, 0, w, h);

    // room fills
    mapCtx.fillStyle = 'rgba(255,255,255,0.5)';
    for (const r of PLAN.rooms) {
      if (r.outdoor) continue;
      mapCtx.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * s, (r.z1 - r.z0) * s);
    }
    mapCtx.fillStyle = 'rgba(255,255,255,0.22)';
    for (const r of PLAN.rooms) {
      if (!r.outdoor) continue;
      mapCtx.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * s, (r.z1 - r.z0) * s);
    }

    // walls, with gaps where the doors are
    mapCtx.strokeStyle = '#2b2f36';
    mapCtx.lineCap = 'butt';
    for (const w2 of PLAN.walls) {
      if (w2.y0) continue;                       // skip overhead soffits
      mapCtx.lineWidth = Math.max(1, (w2.ext ? 2.4 : 1.5));
      const seg = [];
      const holes = (w2.holes || []).slice().sort((a, b) => a[0] - b[0]);
      let cur = w2.a;
      for (const [h0, h1] of holes) {
        const a = Math.max(h0, w2.a), b = Math.min(h1, w2.b);
        if (b <= a) continue;
        seg.push([cur, a]); cur = b;
      }
      seg.push([cur, w2.b]);
      mapCtx.beginPath();
      for (const [a, b] of seg) {
        if (b - a < 1e-3) continue;
        if (w2.axis === 'x') { mapCtx.moveTo(X(w2.at), Z(a)); mapCtx.lineTo(X(w2.at), Z(b)); }
        else { mapCtx.moveTo(X(a), Z(w2.at)); mapCtx.lineTo(X(b), Z(w2.at)); }
      }
      mapCtx.stroke();
    }

    // you, and which way you are facing
    const px = X(walker.pos.x), pz = Z(walker.pos.z);
    const dirX = -Math.sin(walker.yaw), dirZ = -Math.cos(walker.yaw);
    mapCtx.strokeStyle = '#d9483b';
    mapCtx.lineWidth = 2;
    mapCtx.beginPath();
    mapCtx.moveTo(px, pz);
    mapCtx.lineTo(px + dirX * 13, pz + dirZ * 13);
    mapCtx.stroke();
    mapCtx.fillStyle = '#d9483b';
    mapCtx.beginPath();
    mapCtx.arc(px, pz, 3.6, 0, Math.PI * 2);
    mapCtx.fill();
  }

  /* --- resize ----------------------------------------------------- */
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }
  addEventListener('resize', resize);

  /* --- loop -------------------------------------------------------- */
  let last = performance.now(), mapTick = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    resize();
    walker.update(dt);

    if (mode === 'walk') {
      const r = roomAt(walker.pos.x, walker.pos.z);
      roomLabel.textContent = r ? r.name : 'Outside';
    } else {
      roomLabel.textContent = mode === 'dollhouse' ? 'Dollhouse View' : 'Exterior';
    }
    if ((mapTick += dt) > 0.05) { mapTick = 0; drawMap(); }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // handy for poking at the model from the console
  window.TEXOMA = { scene, camera, renderer, house, walker, orbit, PLAN };

  setMode('walk');
  walker.teleport(16.2, 80, 0);
  resize();
  requestAnimationFrame(frame);
})();
