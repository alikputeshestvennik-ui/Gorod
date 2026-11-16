import { E, M, D } from './config';
import { random } from '../core/rng';
import { demand, distance, modeShares, routeTravel, headway } from './demand';
import { grow } from './growth';
import type { World } from './types';
export { applyCommand } from './commands';
export function createWorld(seed = 412781): World {
  return { version: 1, seed: seed >>> 0, minute: 0, remainder: 0, money: E.initialMoney,
    satisfaction: E.initialSatisfaction, trust: E.initialTrust, districts: structuredClone(D.districts),
    routes: [{ id: 1, stops: [0, 1, 2, 3], vehicles: 1, served: 0 }], fleet: E.initialFleet,
    fare: E.fare, nextRoute: 2, served: 0, missed: 0, income: 0, expenses: 0, lastGrowth: 0,
    demand: D.districts.map(() => 0), queues: D.districts.map(() => D.districts.map(() => 0)) };
}
function network(w: World) {
  const routes = w.routes.filter(r => r.vehicles > 0);
  const table = w.districts.map(a => w.districts.map(b => {
    let index = -1, time = Infinity;
    routes.forEach((r, i) => { const travel = routeTravel(w, r, a.id, b.id); if (travel < time) { time = travel; index = i; } });
    return { index, time, distance: distance(a,b) };
  }));
  return { routes, table, headways: routes.map(r => headway(w,r)) };
}
function tick(w: World, net: ReturnType<typeof network>): void {
  w.minute += E.minutesPerTick;
  const active = net.routes;
  const remaining = active.map((_, i) => M.capacity * E.minutesPerTick / net.headways[i]);
  w.demand.fill(0);
  let served = 0, missed = 0;
  for (const a of w.districts) for (const b of w.districts) {
    if (a.id === b.id) continue;
    const generated = demand(a, b, w.minute) * E.minutesPerTick / 60 * (E.randomDemandMin + random(w) * E.randomDemandRange);
    w.demand[a.id] += generated;
    const { index: best, time, distance: dist } = net.table[a.id][b.id];
    const old = w.queues[a.id][b.id];
    if (best < 0) { w.queues[a.id][b.id] = 0; missed += generated + old; continue; }
    const shares = modeShares(time, w.fare, net.headways[best] / 2, dist, old / M.capacity, w.missed * E.congestionFactor / Math.max(1, w.minute));
    const requests = generated * shares.transit + old * E.queueRetention;
    const boarded = Math.min(requests, remaining[best]);
    remaining[best] -= boarded;
    const waiting = requests - boarded;
    const queue = Math.min(waiting, a.population * E.maxQueuePerPerson);
    w.queues[a.id][b.id] = queue;
    served += boarded; active[best].served += boarded;
    missed += generated * (1 - shares.transit) + old * (1 - E.queueRetention) + waiting - queue;
  }
  const income = served * w.fare;
  const vehicleCount = active.reduce((s, r) => s + r.vehicles, 0);
  const covered = new Set(active.flatMap(r => r.stops)).size;
  const subsidy = covered * E.subsidyPerStopHour * E.minutesPerTick / 60;
  const costs = (vehicleCount * M.activeCostPerHour + (w.fleet - vehicleCount) * M.reserveCostPerHour) * E.minutesPerTick / 60;
  w.served += served; w.missed += missed; w.income += income + subsidy; w.expenses += costs;
  w.money += income + subsidy - costs;
  if (w.minute % 60 === 0) {
    const total = served + missed;
    const target = Math.max(0, Math.min(100, E.satisfactionBase + covered / w.districts.length * E.coverageBonus - (total > 0 ? missed / total : 0) * E.complaintPenalty));
    w.satisfaction += (target - w.satisfaction) * E.satisfactionSmoothing;
    w.trust += (w.satisfaction - w.trust) * E.trustSmoothing;
  }
  if (w.minute % (E.minutesPerDay * E.daysPerMonth) === 0) grow(w);
}
export function step(world: World, dtMinutes: number): void {
  if (!Number.isFinite(dtMinutes) || dtMinutes < 0) throw new Error('Некорректный шаг времени');
  world.remainder += dtMinutes;
  const net = network(world);
  while (world.remainder >= E.minutesPerTick) { world.remainder -= E.minutesPerTick; tick(world, net); }
}
export function getSnapshot(world: World): World { return structuredClone(world); }
