import city from '../../data/balance/city.json';
import { E, D } from './config';
import type { World, Development } from './types';
export const C = city;
export function initialDevelopment(population: number, minute = 0): Development {
  return { phase: 'occupied', since: minute, until: minute, level: 0, badDays: 0,
    capacity: Math.ceil(population * city.initialCapacityRatio), growthRemainder: city.initialGrowthRemainder };
}
export function initialExpansion(minute: number, index = 0) {
  return { index, since: minute, until: minute + city.constructionDays * E.minutesPerDay };
}
/** Construction and redevelopment advance on the saved city clock, including on reload. */
export function develop(w: World): number {
  let arrivals = 0;
  for (const d of w.districts) {
    const lot = w.development[d.id];
    if (lot.phase === 'construction' || lot.phase === 'renovation') {
      if (w.minute < lot.until) continue;
      lot.phase = 'occupied'; lot.since = w.minute; lot.level++;
      lot.capacity = Math.ceil(Math.max(d.population, lot.capacity) * city.capacityExpansion);
      continue;
    }
    if (lot.phase === 'abandoned') {
      if (w.minute >= lot.until) { lot.phase = 'park'; lot.since = w.minute; }
      continue;
    }
    if (lot.phase === 'park') continue;
    lot.badDays = d.accessibility < city.declineAccess ? lot.badDays + 1 : 0;
    // This is one redevelopment plot, never the entire district or all its residents.
    if (lot.badDays >= city.abandonDays && d.type !== 'leisure') {
      lot.phase = 'abandoned'; lot.since = w.minute; lot.until = w.minute + city.parkDays * E.minutesPerDay;
    } else if (lot.level < city.maxTowerLevel && d.accessibility >= city.renewAccess && d.population >= (D.districts[d.id]?.population ?? city.quarterPopulation) * city.renewPopulationRatio ** (lot.level + 1)) {
      lot.phase = 'renovation'; lot.since = w.minute; lot.until = w.minute + city.renovationDays * E.minutesPerDay;
    } else if (d.population >= lot.capacity * city.constructionOccupancyThreshold) {
      lot.phase = 'construction'; lot.since = w.minute; lot.until = w.minute + city.constructionDays * E.minutesPerDay;
    }
  }
  if (w.expansion && w.minute >= w.expansion.until) {
    const plan = city.quarters[w.expansion.index], [x, y] = city.nodes[plan.node], id = w.districts.length;
    w.districts.push({ id, name: plan.name, type: 'residential', x, y, population: city.quarterPopulation, jobs: city.quarterJobs, pull: city.quarterPull, density: city.initialDistrictDensity, landValue: city.initialDistrictDensity, accessibility: 0 });
    w.development.push(initialDevelopment(city.quarterPopulation, w.minute));
    w.demand.push(0); w.queues.forEach(row => row.push(0)); w.queues.push(w.districts.map(() => 0));
    arrivals += city.quarterPopulation; w.expansion = null;
  }
  const built = w.districts.length - D.districts.length;
  const population = w.districts.reduce((s, d) => s + d.population, 0);
  const initial = D.districts.reduce((s, d) => s + d.population, 0);
  if (!w.expansion && built < city.quarters.length && population >= initial * city.nextQuarterGrowth ** built) w.expansion = initialExpansion(w.minute, built);
  return arrivals;
}
