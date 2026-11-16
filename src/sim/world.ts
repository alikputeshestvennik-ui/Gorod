import { E, T, D } from './config';
import { random } from '../core/rng';
import { demand, distance, modeShares, routeTravel, headway } from './demand';
import { grow } from './growth';
import { account } from './economy';
import { updateEvents, eventConfig } from './events';
import type { World } from './types';
export { applyCommand } from './commands';
export function createWorld(seed = 412781): World {
  return { version: 2, seed: seed >>> 0, minute: 0, remainder: 0, money: E.initialMoney,
    ecology: E.initialEcology, satisfaction: E.initialSatisfaction, trust: E.initialTrust, districts: structuredClone(D.districts),
    routes: [{ id: 1, mode: 'marshrutka', stops: [0, 1, 2, 3], vehicles: 1, served: 0 }], fleet: E.initialFleet,
    fleets: {marshrutka:E.initialFleet,bus:0,trolleybus:0,tram:0},wear:{marshrutka:0,bus:0,trolleybus:0,tram:0},
    ledger:{tickets:0,advertising:0,subsidy:0,rent:0,wages:0,energy:0,maintenance:0,depreciation:0,interest:0,construction:0,purchases:0},
    debt:0,gameOver:false,event:null,nextEvent:{id:'fair',at:E.firstEventMinute},fare: E.fare, nextRoute: 2, served: 0, missed: 0, income: 0, expenses: 0, lastGrowth: 0,
    demand: D.districts.map(() => 0), queues: D.districts.map(() => D.districts.map(() => 0)) };
}
function network(w: World) {
  const event=eventConfig(w);
  const routes = w.routes.filter(r => r.vehicles > 0 && !(event?.id==='repair'&&r.stops.includes(event.district)));
  const speed=event?.speed??1;
  const table = w.districts.map(a => w.districts.map(b => {
    let index = -1, time = Infinity;
    routes.forEach((r, i) => { const travel = routeTravel(w, r, a.id, b.id)/speed; if (travel < time) { time = travel; index = i; } });
    return { index, time, distance: distance(a,b) };
  }));
  return { routes, table, headways: routes.map(r => headway(w,r)/speed) };
}
function tick(w: World, net: ReturnType<typeof network>): void {
  const active = net.routes;
  const event=eventConfig(w);
  const remaining = active.map((r, i) => {
    const worn=w.wear[r.mode];
    const breakdown=worn>=E.breakdownWear&&random(w)<E.breakdownChance*(event?.breakdowns??1);
    return T[r.mode].capacity*E.minutesPerTick/net.headways[i]*(1-worn/100*E.wearSlowdown)*(breakdown?E.breakdownCapacity:1);
  });
  w.demand.fill(0);
  let served = 0, missed = 0;
  for (const a of w.districts) for (const b of w.districts) {
    if (a.id === b.id) continue;
    const generated = demand(a, b, w.minute) * (event && (event.district<0 || b.id===event.district) ? event.demand : 1) * E.minutesPerTick / 60 * (E.randomDemandMin + random(w) * E.randomDemandRange);
    w.demand[a.id] += generated;
    const { index: best, time, distance: dist } = net.table[a.id][b.id];
    const old = w.queues[a.id][b.id];
    if (best < 0) { w.queues[a.id][b.id] = 0; missed += generated + old; continue; }
    const shares = modeShares(time, w.fare, net.headways[best] / 2, dist, old / T[active[best].mode].capacity, w.missed * E.congestionFactor / Math.max(1, w.minute));
    const requests = generated * shares.transit + old * E.queueRetention;
    const boarded = Math.min(requests, remaining[best]);
    remaining[best] -= boarded;
    const waiting = requests - boarded;
    const queue = Math.min(waiting, a.population * E.maxQueuePerPerson);
    w.queues[a.id][b.id] = queue;
    served += boarded; active[best].served += boarded;
    missed += generated * (1 - shares.transit) + old * (1 - E.queueRetention) + waiting - queue;
  }
  const covered = new Set(active.flatMap(r => r.stops)).size;
  w.served += served; w.missed += missed;
  account(w,served,covered);
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
  let key: string | undefined, net: ReturnType<typeof network>;
  while (world.remainder >= E.minutesPerTick && !world.gameOver) {
    world.remainder -= E.minutesPerTick;world.minute += E.minutesPerTick;updateEvents(world);
    const nextKey=world.event?.id??'';
    if(key!==nextKey){net=network(world);key=nextKey;}
    tick(world,net!);
  }
  if(world.gameOver)world.remainder=0;
}
export function getSnapshot(world: World): World { return structuredClone(world); }
