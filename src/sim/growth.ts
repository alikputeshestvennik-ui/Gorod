import { develop } from './development';
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
export function grow(world: World, daily = false): void {
  const period = daily ? E.daysPerMonth : 1;
  if (!daily || world.minute % (E.minutesPerDay * E.daysPerMonth) === 0) world.lastGrowth = 0;
  let added = 0;
  for (const d of world.districts) {
    const lot = world.development[d.id];
    d.accessibility = accessibility(world, d.id);
    d.landValue += E.landValueRate / period * (d.accessibility - d.landValue);
    d.density += E.densityRate / period * Math.max(0, d.landValue - d.density);
    lot.capacity += d.population * E.housingExpansion / period;
    const expected = d.population * Math.min(E.housingExpansion, growthRate(d.accessibility, world.satisfaction)) / period + lot.growthRemainder;
    const growth = Math.max(0, Math.min(lot.capacity - d.population, Math.floor(expected)));
    lot.growthRemainder = expected - Math.floor(expected);
    d.population += growth; added += growth;
  }
  added += develop(world);
  world.lastGrowth += added;
}
