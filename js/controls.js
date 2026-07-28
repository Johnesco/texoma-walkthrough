/* ------------------------------------------------------------------
   controls.js — first-person walking with wall collision, plus a
   simple orbit rig for the dollhouse and exterior views.
------------------------------------------------------------------ */

const CONTROLS = (function () {

  const EYE = 5.5;        // eye height, feet
  const RADIUS = 0.85;    // how close you can get to a wall
  const WALK = 7.5;       // feet per second
  const RUN = 15.0;

  class Walker {
    constructor(camera, dom, colliders) {
      this.cam = camera; this.dom = dom; this.colliders = colliders;
      this.pos = new THREE.Vector3(16.2, EYE, 80);
      this.yaw = 0; this.pitch = 0;
      this.keys = new Set();
      this.enabled = false;
      this.locked = false;
      this.vel = new THREE.Vector3();

      this._onMove = (e) => {
        if (!this.enabled || !this.locked) return;
        const s = 0.0022;
        this.yaw -= e.movementX * s;
        this.pitch -= e.movementY * s;
        const lim = Math.PI / 2 - 0.05;
        this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
      };
      this._onKey = (e) => {
        const k = e.code;
        if (e.type === 'keydown') this.keys.add(k); else this.keys.delete(k);
        if (this.enabled && this.locked &&
            ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(k)) {
          e.preventDefault();
        }
      };
      this._onLock = () => {
        this.locked = document.pointerLockElement === this.dom;
        if (this.onLockChange) this.onLockChange(this.locked);
      };

      document.addEventListener('mousemove', this._onMove);
      document.addEventListener('keydown', this._onKey);
      document.addEventListener('keyup', this._onKey);
      document.addEventListener('pointerlockchange', this._onLock);
    }

    requestLock() { this.dom.requestPointerLock(); }
    exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

    teleport(x, z, look) {
      this.pos.set(x, EYE, z);
      if (look !== undefined) { this.yaw = look; this.pitch = 0; }
      this.apply();
    }

    /* Axis-aligned rectangles, inflated by the player radius. A move
       is tried on each axis separately so you slide along walls
       instead of sticking to them. */
    blocked(x, z) {
      for (const c of this.colliders) {
        if (x > c.x0 - RADIUS && x < c.x1 + RADIUS &&
            z > c.z0 - RADIUS && z < c.z1 + RADIUS) return true;
      }
      return false;
    }

    update(dt) {
      if (!this.enabled) return;
      let f = 0, s = 0;
      const k = this.keys;
      if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) s -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) s += 1;

      const speed = (k.has('ShiftLeft') || k.has('ShiftRight')) ? RUN : WALK;
      const len = Math.hypot(f, s) || 1;
      const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
      // forward is -z when yaw is 0
      const dx = (-sinY * f + cosY * s) / len * speed * dt;
      const dz = (-cosY * f - sinY * s) / len * speed * dt;

      if (f || s) {
        if (!this.blocked(this.pos.x + dx, this.pos.z)) this.pos.x += dx;
        if (!this.blocked(this.pos.x, this.pos.z + dz)) this.pos.z += dz;
      }
      this.apply();
    }

    apply() {
      this.cam.position.copy(this.pos);
      this.cam.rotation.set(0, 0, 0);
      this.cam.rotateY(this.yaw);
      this.cam.rotateX(this.pitch);
    }

    dispose() {
      document.removeEventListener('mousemove', this._onMove);
      document.removeEventListener('keydown', this._onKey);
      document.removeEventListener('keyup', this._onKey);
      document.removeEventListener('pointerlockchange', this._onLock);
    }
  }

  /* Orbit rig for the overhead and exterior views. */
  class Orbit {
    constructor(camera, dom) {
      this.cam = camera; this.dom = dom;
      this.target = new THREE.Vector3(20, 4, 35);
      this.dist = 95; this.theta = Math.PI; this.phi = 0.95;
      this.enabled = false;
      this.drag = null;

      const down = (e) => {
        if (!this.enabled) return;
        this.drag = { x: e.clientX, y: e.clientY, pan: e.button !== 0 || e.shiftKey };
        dom.setPointerCapture(e.pointerId);
      };
      const move = (e) => {
        if (!this.enabled || !this.drag) return;
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        this.drag.x = e.clientX; this.drag.y = e.clientY;
        if (this.drag.pan) {
          const right = new THREE.Vector3(Math.cos(this.theta), 0, -Math.sin(this.theta));
          const fwd = new THREE.Vector3(Math.sin(this.theta), 0, Math.cos(this.theta));
          const k = this.dist * 0.0016;
          this.target.addScaledVector(right, -dx * k).addScaledVector(fwd, -dy * k);
        } else {
          this.theta -= dx * 0.006;
          this.phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.02, this.phi - dy * 0.006));
        }
        this.apply();
      };
      const up = (e) => { this.drag = null; try { dom.releasePointerCapture(e.pointerId); } catch (_) {} };
      const wheel = (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        this.dist = Math.max(12, Math.min(260, this.dist * (1 + Math.sign(e.deltaY) * 0.12)));
        this.apply();
      };

      dom.addEventListener('pointerdown', down);
      dom.addEventListener('pointermove', move);
      dom.addEventListener('pointerup', up);
      dom.addEventListener('pointercancel', up);
      dom.addEventListener('wheel', wheel, { passive: false });
      dom.addEventListener('contextmenu', (e) => { if (this.enabled) e.preventDefault(); });
    }

    set(target, dist, theta, phi) {
      this.target.copy(target); this.dist = dist;
      this.theta = theta; this.phi = phi; this.apply();
    }

    apply() {
      const r = this.dist, sp = Math.sin(this.phi), cp = Math.cos(this.phi);
      this.cam.position.set(
        this.target.x + r * sp * Math.sin(this.theta),
        this.target.y + r * cp,
        this.target.z + r * sp * Math.cos(this.theta),
      );
      this.cam.lookAt(this.target);
    }
  }

  return { Walker, Orbit, EYE };
})();
