import * as THREE from 'three';

/** Snow belongs to upward-facing surfaces. No extra plane can intersect the river. */
export class SnowCover {
  private amount = { value: 0 };
  private scanElapsed = 1;
  private seen = new WeakSet<THREE.Material>();
  private coat = (object: THREE.Object3D) => {
    if (!(object instanceof THREE.Mesh) || object.userData.noSnow) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshLambertMaterial) || this.seen.has(material)) continue;
      this.seen.add(material);
      material.onBeforeCompile = shader => {
        shader.uniforms.snowAmount = this.amount;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
          varying vec3 vSnowPosition;
          varying float vSnowUp;`);
        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
          vec4 snowPosition = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            snowPosition = instanceMatrix * snowPosition;
          #endif
          vSnowPosition = (modelMatrix * snowPosition).xyz;
          vSnowUp = inverseTransformDirection(transformedNormal, viewMatrix).y;`);
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
          uniform float snowAmount;
          varying vec3 vSnowPosition;
          varying float vSnowUp;`);
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          float drift = sin(vSnowPosition.x * 3.7 + sin(vSnowPosition.z * 2.3))
                      * sin(vSnowPosition.z * 4.1 + vSnowPosition.x * 0.8);
          float grain = 0.5 + 0.5 * sin(vSnowPosition.x * 11.0) * sin(vSnowPosition.z * 13.0);
          float upward = smoothstep(0.35, 0.9, vSnowUp);
          float asphalt = 1.0 - smoothstep(0.30, 0.48, max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)));
          float coverage = smoothstep(drift * 0.25 + 0.04, drift * 0.25 + 0.6, snowAmount);
          coverage *= upward * mix(0.96, 0.34, asphalt);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.87, 0.94, 0.98) * (0.92 + grain * 0.08), coverage);`);
      };
      material.customProgramCacheKey = () => 'surface-snow-v1';
      material.needsUpdate = true;
    }
  };
  update(scene: THREE.Scene, snowing: boolean, dt: number) {
    // Accumulate gently; melt more slowly. Also discovers newly built districts.
    this.amount.value = THREE.MathUtils.damp(this.amount.value, snowing ? 0.85 : 0, snowing ? 0.14 : 0.055, dt);
    this.scanElapsed += dt;
    if (this.scanElapsed >= 0.4) { scene.traverse(this.coat); this.scanElapsed = 0; }
  }
}
