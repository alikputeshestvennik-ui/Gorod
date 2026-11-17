import { expect, it } from 'vitest';
import * as THREE from 'three';
import { SnowCover } from '../src/render/snow';
import { EventView } from '../src/render/events';
import { createWorld } from '../src/sim/world';
it('снег ложится на поверхности, обходит реку и тает плавно', () => {
  const scene=new THREE.Scene(), snow=new SnowCover();
  const ground=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshLambertMaterial());
  const water=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshLambertMaterial());water.userData.noSnow=true;
  scene.add(ground,water);const waterCompile=water.material.onBeforeCompile;
  snow.update(scene,true,1);
  expect(water.material.onBeforeCompile).toBe(waterCompile);
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <project_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'} as any;
  ground.material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
  const before=shader.uniforms.snowAmount.value;expect(before).toBeGreaterThan(0);expect(before).toBeLessThan(.85);
  snow.update(scene,false,1);expect(shader.uniforms.snowAmount.value).toBeLessThan(before);expect(shader.uniforms.snowAmount.value).toBeGreaterThan(0);
  expect(scene.children).toHaveLength(2);
});
it('снежинки движутся на паузе и масштабируются под качество без дополнительной плоскости', () => {
  const scene=new THREE.Scene(), weather=new EventView(scene), w=createWorld();w.event={id:'snow',until:10000};
  const snow=scene.getObjectByName('snowflakes') as THREE.Points;
  weather.update(w,0,'low',new THREE.Vector3(),1/60);
  const positions=(snow.geometry.attributes.position.array as Float32Array).slice();
  weather.update(w,0,'low',new THREE.Vector3(),1/60);
  expect(snow.geometry.attributes.position.array).not.toEqual(positions);expect(snow.geometry.drawRange.count).toBe(280);
  weather.update(w,0,'high',new THREE.Vector3(),1/60);expect(snow.geometry.drawRange.count).toBe(960);
  expect(scene.children.some(child=>child instanceof THREE.Mesh&&child.geometry instanceof THREE.PlaneGeometry)).toBe(false);
});
