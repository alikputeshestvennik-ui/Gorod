import { E } from './config';
import { routeTravel } from './demand';
import type { World } from './types';
export function accessibility(world: World, origin: number): number {
  const total = world.districts.reduce((s, d) => s + d.jobs * d.pull, 0);
  const reachable = world.districts.filter(d => d.id !== origin && world.routes.some(r => r.vehicles > 0 && routeTravel(world, r, origin, d.id) <= E.maxReachMinutes));
  return total ? reachable.reduce((s, d) => s + d.jobs * d.pull, 0) / total : 0;
}
export function growthRate(access: number, satisfaction: number): number {
  return E.growthBase * (1 + access * E.satisfactionGrowthBonus * satisfaction / 100);
}
export function grow(world: World): void {
  let added = 0;
  for (const d of world.districts) {
    d.accessibility = accessibility(world, d.id);
    d.landValue += E.landValueRate * (d.accessibility - d.landValue);
    d.density += E.densityRate * Math.max(0, d.landValue - d.density);
    // Housing expands at the edge of each district: no global population cap.
    const growth = Math.floor(d.population * Math.min(E.housingExpansion, growthRate(d.accessibility, world.satisfaction)));
    d.population += growth; added += growth;
  }
  world.lastGrowth = added;
}
