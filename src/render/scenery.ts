import * as THREE from 'three';
import { D } from '../sim/config';
import type { Quality } from '../core/settings';

const palette: Record<string, string> = { residential: '#d7b99a', business: '#9fb9bc', commercial: '#e7c594', industrial: '#a4a5a0', leisure: '#9cbd86' };
export class Scenery {
  readonly windows = new THREE.MeshBasicMaterial({ color: '#658b95' });
  private chunks: { detail: THREE.Group; simple: THREE.Group; bounds: THREE.Sphere }[] = [];
  private frustum = new THREE.Frustum();
  private view = new THREE.Matrix4();
  private matrix = new THREE.Matrix4();
  private tint = new THREE.Color();
  private box = new THREE.BoxGeometry(1, 1, 1);
  private cone = new THREE.ConeGeometry(0.35, 0.8, 5);
  constructor(scene: THREE.Scene) {
    const ground = new THREE.Mesh(new THREE.BoxGeometry(36, 0.16, 36), new THREE.MeshLambertMaterial({ color: '#a5bc8b' }));
    ground.position.set(5.5, -0.15, 5.5); scene.add(ground);
    const island = new THREE.Mesh(new THREE.BoxGeometry(13.8, 0.15, 13.8), new THREE.MeshLambertMaterial({ color: '#ccd3b2' }));
    island.position.set(5.5, -0.04, 5.5); scene.add(island);
    const water = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.04, 36), new THREE.MeshLambertMaterial({ color: '#72b8c2' }));
    water.position.set(8.5, 0.025, 5.5); scene.add(water);
    const roads = new THREE.InstancedMesh(this.box, new THREE.MeshLambertMaterial({ color: '#6c7775' }), 8);
    const sidewalks = new THREE.InstancedMesh(this.box, new THREE.MeshLambertMaterial({ color: '#e4ddc6' }), 8);
    const marks = new THREE.InstancedMesh(this.box, new THREE.MeshBasicMaterial({ color: '#dedac4' }), 96);
    let road = 0, dash = 0;
    for (const x of [1, 4, 7, 10]) for (const vertical of [true, false]) {
      this.put(sidewalks, road, vertical ? x : 5.5, 0.06, vertical ? 5.5 : x, vertical ? 0.68 : 13.3, 0.08, vertical ? 13.3 : 0.68);
      this.put(roads, road++, vertical ? x : 5.5, 0.106, vertical ? 5.5 : x, vertical ? 0.43 : 13.3, 0.02, vertical ? 13.3 : 0.43);
      for (let z = 0; z < 12; z++) this.put(marks, dash++, vertical ? x : z, 0.12, vertical ? z : x, vertical ? 0.018 : 0.14, 0.004, vertical ? 0.14 : 0.018);
    }
    scene.add(sidewalks, roads, marks);
    const buildingMaterial = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
    const roofMaterial = new THREE.MeshLambertMaterial({ color: '#857e70', flatShading: true });
    const leafMaterial = new THREE.MeshLambertMaterial({ color: '#659368', flatShading: true });
    const trunkMaterial = new THREE.MeshLambertMaterial({ color: '#8d7456' });
    const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#344e43', transparent: true, opacity: 0.13, depthWrite: false });
    for (let cx = 0; cx < 2; cx++) for (let cz = 0; cz < 2; cz++) {
      const detail = new THREE.Group(), simple = new THREE.Group();
      const buildings = new THREE.InstancedMesh(this.box, buildingMaterial, 36);
      const roofs = new THREE.InstancedMesh(this.box, roofMaterial, 36);
      const windows = new THREE.InstancedMesh(this.box, this.windows, 360);
      const trees = new THREE.InstancedMesh(this.cone, leafMaterial, 108);
      const trunks = new THREE.InstancedMesh(this.box, trunkMaterial, 108);
      const shadows = new THREE.InstancedMesh(this.box, shadowMaterial, 144);
      const distant = new THREE.InstancedMesh(this.box, buildingMaterial, 36);
      let b = 0, w = 0, tree = 0, shadow = 0;
      for (let x = cx * 6; x < cx * 6 + 6; x++) for (let z = cz * 6; z < cz * 6 + 6; z++) {
        if ([1, 4, 7, 10].includes(x) || [1, 4, 7, 10].includes(z) || x === 8 || x === 9) continue;
        let nearest = D.districts[0], distance = Infinity;
        for (const district of D.districts) { const d = Math.hypot(x - district.x, z - district.y); if (d < distance) { distance = d; nearest = district; } }
        const park = nearest.type === 'leisure';
        const variety = (x * 17 + z * 31) % 7;
        if (!park) {
          const height = nearest.type === 'business' ? 1.05 + variety * 0.17 : nearest.type === 'industrial' ? 0.45 : 0.38 + variety * 0.12;
          const width = nearest.type === 'industrial' ? 0.81 : 0.56 + variety * 0.02;
          this.tint.set(palette[nearest.type]); this.tint.multiplyScalar(0.91 + variety * 0.025);
          this.put(buildings, b, x, height / 2 + 0.06, z, width, height, 0.65); buildings.setColorAt(b, this.tint);
          this.put(distant, b, x, height / 2 + 0.06, z, width, height, 0.65); distant.setColorAt(b, this.tint);
          this.put(roofs, b++, x, height + 0.09, z, width + 0.06, 0.08, 0.72);
          this.put(shadows, shadow++, x + 0.16, 0.049, z - 0.07, width + 0.28, 0.007, 0.87);
          for (let level = 0.23; level < height; level += 0.26) for (const side of [-1, 1]) {
            this.put(windows, w++, x, level + 0.06, z + side * 0.328, width * 0.65, 0.1, 0.012);
          }
        }
        const count = park ? 3 : 1;
        for (let i = 0; i < count; i++) {
          const tx = x + (park ? (i - 1) * 0.28 : 0.42), tz = z + (i % 2 ? 0.22 : -0.34);
          this.put(trunks, tree, tx, 0.2, tz, 0.06, 0.3, 0.06);
          this.put(trees, tree++, tx, 0.58, tz, 0.75, 0.9 + variety * 0.06, 0.75);
        }
      }
      buildings.count = roofs.count = distant.count = b; windows.count = w; trees.count = trunks.count = tree; shadows.count = shadow;
      detail.add(buildings, roofs, windows, trees, trunks, shadows); simple.add(distant);
      scene.add(detail, simple); this.chunks.push({ detail, simple, bounds: new THREE.Sphere(new THREE.Vector3(cx * 6 + 2.5, 0.8, cz * 6 + 2.5), 5) });
    }
    // Riverfront avenue trees, shared by both banks without blocking stop intersections.
    const avenue = new THREE.InstancedMesh(this.cone, leafMaterial, 24);
    for (let i = 0; i < 24; i++) this.put(avenue, i, i < 12 ? 7.85 : 9.15, 0.4, i % 12, 0.55, 0.8, 0.55);
    scene.add(avenue);
  }
  private put(mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    this.matrix.makeScale(sx, sy, sz); this.matrix.setPosition(x, y, z); mesh.setMatrixAt(index, this.matrix);
  }
  update(camera: THREE.Camera, zoom: number, quality: Quality) {
    this.view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this.view);
    for (const chunk of this.chunks) {
      const visible = this.frustum.intersectsSphere(chunk.bounds), detail = zoom >= (quality === 'low' ? 0.9 : 0.75);
      chunk.detail.visible = visible && detail; chunk.simple.visible = visible && !detail;
    }
  }
}
