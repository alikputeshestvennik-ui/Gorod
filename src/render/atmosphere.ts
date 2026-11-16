import * as THREE from 'three';
import type { TimeOfDay } from '../core/settings';

/** Visual time follows the saved simulation clock; it never changes the simulation. */
export function daylight(minute: number, mode: TimeOfDay): number {
  if (mode === 'day') return 1;
  if (mode === 'night') return 0;
  return THREE.MathUtils.smoothstep(Math.sin(((minute / 60 + 8) % 24 - 6) / 24 * Math.PI * 2), -0.18, 0.3);
}
export class Atmosphere {
  readonly ambient = new THREE.HemisphereLight('#e5f4ff', '#7e9163', 2);
  readonly sun = new THREE.DirectionalLight('#fff0cf', 2.4);
  private sky = new THREE.Color();
  private day = new THREE.Color('#b9d9de');
  private night = new THREE.Color('#152639');
  private fog = new THREE.Fog('#b9d9de', 35, 65);
  constructor(private scene: THREE.Scene, private windows: THREE.MeshBasicMaterial) {
    this.sun.position.set(-8, 17, 9); scene.add(this.ambient, this.sun); scene.background = this.sky; scene.fog = this.fog;
  }
  update(minute: number, mode: TimeOfDay) {
    const value = daylight(minute, mode);
    this.sky.copy(this.night).lerp(this.day, value); this.fog.color.copy(this.sky);
    this.ambient.intensity = 0.7 + value * 1.5; this.sun.intensity = 0.2 + value * 2.2;
    this.sun.color.set(value > 0.65 ? '#fff0cf' : value > 0.1 ? '#ffc09a' : '#9bb8f3');
    this.windows.color.set(value > 0.5 ? '#658b95' : '#ffdb89');
    return value;
  }
}
