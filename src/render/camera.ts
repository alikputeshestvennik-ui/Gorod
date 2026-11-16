import * as THREE from 'three';
import type { District } from '../sim/types';
import { D } from '../sim/config';

/** Ground-plane picking avoids raycasting buildings and keeps taps cheap. */
export class MapCamera {
  readonly camera = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.1, 100);
  readonly center = new THREE.Vector3(5.5, 0, 5.5);
  zoom = 1;
  private target = this.center.clone();
  private zoomTarget = 1;
  private angle = 0;
  private angleTarget = 0;
  private tilt = 0.82;
  private tiltTarget = 0.82;
  private width = 1;
  private height = 1;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private pointer = new THREE.Vector2();
  private point = new THREE.Vector3();
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { x: number; y: number; moved: boolean; multi: boolean; stop: number | null } | null = null;
  districts: Pick<District, 'id' | 'x' | 'y'>[] = D.districts;
  building = false;
  onStop: (id: number) => void = () => {};
  constructor(private canvas: HTMLCanvasElement, private surface: HTMLElement = canvas) { this.bind(); }
  resize(width: number, height: number) { this.width = width; this.height = height; this.update(1); }
  changeZoom(factor: number) { this.zoomTarget = THREE.MathUtils.clamp(this.zoomTarget * factor, 0.7, 3.5); }
  rotate(delta: number) { this.angleTarget += delta; }
  recenter() { this.target.set(5.5, 0, 5.5); this.zoomTarget = 1; this.angleTarget = 0; this.tiltTarget = 0.82; }
  update(dt: number) {
    const blend = 1 - Math.exp(-12 * dt);
    this.center.lerp(this.target, blend); this.zoom += (this.zoomTarget - this.zoom) * blend;
    this.angle += (this.angleTarget - this.angle) * blend; this.tilt += (this.tiltTarget - this.tilt) * blend;
    const half = 6.9 / this.zoom, aspect = this.width / Math.max(1, this.height);
    this.camera.left = -half * Math.max(1, aspect); this.camera.right = -this.camera.left;
    this.camera.top = half * Math.max(1, 1 / aspect); this.camera.bottom = -this.camera.top;
    const radius = 26 * Math.cos(this.tilt);
    this.camera.position.set(this.center.x + Math.sin(this.angle) * radius, 26 * Math.sin(this.tilt), this.center.z + Math.cos(this.angle) * radius);
    this.camera.lookAt(this.center); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
  }
  private pick(x: number, y: number): number | null {
    const hit = this.surface.ownerDocument?.elementFromPoint(x, y);
    const label = hit?.closest<HTMLElement>('[data-stop]');
    if (label && this.surface.contains(label)) return Number(label.dataset.stop);
    if (hit && !this.surface.contains(hit)) return null;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
    if (!this.ray.ray.intersectPlane(this.plane, this.point)) return null;
    let id: number | null = null, best = 0.65 / this.zoom;
    for (const d of this.districts) { const distance = Math.hypot(d.x - this.point.x, d.y - this.point.z); if (distance < best) { id = d.id; best = distance; } }
    return id;
  }
  private pan(dx: number, dy: number) {
    const horizontal = dx * (this.camera.right - this.camera.left) / this.width;
    const vertical = dy * (this.camera.top - this.camera.bottom) / this.height / Math.sin(this.tilt);
    this.target.x -= horizontal * Math.cos(this.angle) + vertical * Math.sin(this.angle);
    this.target.z += horizontal * Math.sin(this.angle) - vertical * Math.cos(this.angle);
    this.target.x = THREE.MathUtils.clamp(this.target.x, -3, 16); this.target.z = THREE.MathUtils.clamp(this.target.z, -3, 16);
  }
  private bind() {
    this.surface.addEventListener('pointerdown', e => {
      this.canvas.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        const stop = (e.target as HTMLElement).closest?.<HTMLElement>('[data-stop]')?.dataset.stop;
        this.drag = { x: e.clientX, y: e.clientY, moved: false, multi: false, stop: stop === undefined ? null : Number(stop) };
      }
      else if (this.drag) this.drag.multi = true;
    });
    this.surface.addEventListener('pointermove', e => {
      const previous = this.pointers.get(e.pointerId); if (!previous || !this.drag) return;
      const dx = e.clientX - previous.x, dy = e.clientY - previous.y;
      if (this.pointers.size === 2) {
        let other: { x: number; y: number } | undefined;
        for (const [id, p] of this.pointers) if (id !== e.pointerId) other = p;
        if (other) {
          const ox = previous.x - other.x, oy = previous.y - other.y, nx = e.clientX - other.x, ny = e.clientY - other.y;
          this.changeZoom(Math.hypot(nx, ny) / Math.max(1, Math.hypot(ox, oy)));
          this.rotate(-Math.atan2(Math.sin(Math.atan2(ny, nx) - Math.atan2(oy, ox)), Math.cos(Math.atan2(ny, nx) - Math.atan2(oy, ox))));
          this.tiltTarget = THREE.MathUtils.clamp(this.tiltTarget + dy * 0.0025, 0.45, 1.35);
          this.pan(dx * 0.3, dy * 0.3);
        }
      } else if (!this.drag.multi) {
        if (!this.drag.moved && Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) > 8) {
          this.drag.moved = true;
          if (this.building) { const id = this.drag.stop ?? this.pick(this.drag.x, this.drag.y); if (id !== null) this.onStop(id); }
        }
        if (this.drag.moved) {
          if (this.building) { const id = this.pick(e.clientX, e.clientY); if (id !== null) this.onStop(id); }
          else this.pan(dx, dy);
        }
      }
      previous.x = e.clientX; previous.y = e.clientY;
    });
    const end = (e: PointerEvent) => {
      if (e.type === 'pointerup' && this.drag && !this.drag.moved && !this.drag.multi) { const id = this.drag.stop ?? this.pick(e.clientX, e.clientY); if (id !== null) this.onStop(id); }
      this.pointers.delete(e.pointerId); if (!this.pointers.size) this.drag = null;
    };
    this.surface.addEventListener('pointerup', end); this.surface.addEventListener('pointercancel', end);
    this.canvas.addEventListener('lostpointercapture', e => { this.pointers.delete(e.pointerId); if (!this.pointers.size) this.drag = null; });
    this.canvas.addEventListener('wheel', e => { e.preventDefault(); this.changeZoom(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
  }
}
