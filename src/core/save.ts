import { E, D } from '../sim/config';
import { createWorld } from '../sim/world';
import type { World } from '../sim/types';
export const SAVE_KEY = 'gorodskoy-marshrut:stage1:v1';
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
export function restore(raw: string): World | null {
  try {
    const w = JSON.parse(raw) as World;
    if (!w || w.version !== 1) return null;
    const base = createWorld();
    for (const [key, val] of Object.entries(base)) if (typeof val === 'number' && !finite(w[key as keyof World])) return null;
    if (!Number.isInteger(w.seed) || w.seed < 0 || w.seed > 0xffffffff || !Number.isInteger(w.minute) || w.minute < 0 || w.minute % E.minutesPerTick || w.remainder < 0 || w.remainder >= E.minutesPerTick || w.fare < E.fareMin || w.fare > E.fareMax || w.satisfaction < 0 || w.satisfaction > 100 || w.trust < 0 || w.trust > 100) return null;
    if (!Number.isInteger(w.fleet) || w.fleet < 0 || w.fleet > E.maxVehicles || !Array.isArray(w.routes) || w.routes.length > E.maxRoutes || !Array.isArray(w.districts) || w.districts.length !== D.districts.length) return null;
    if (w.districts.some((d, i) => !d || d.id !== i || d.name !== D.districts[i].name || d.type !== D.districts[i].type || Object.entries(D.districts[i]).some(([k,v]) => typeof v === 'number' && (!finite(d[k as keyof typeof d]) || Number(d[k as keyof typeof d]) < 0)) || d.x !== D.districts[i].x || d.y !== D.districts[i].y)) return null;
    const ids = new Set<number>();
    for (const r of w.routes) {
      if (!r || !Number.isInteger(r.id) || r.id < 1 || ids.has(r.id) || !Number.isInteger(r.vehicles) || r.vehicles < 0 || !finite(r.served) || r.served < 0 || !Array.isArray(r.stops) || r.stops.length < 2 || new Set(r.stops).size !== r.stops.length || r.stops.some(i => !Number.isInteger(i) || !w.districts[i])) return null;
      ids.add(r.id);
    }
    if (!Number.isInteger(w.nextRoute) || w.nextRoute <= Math.max(0, ...ids) || w.routes.reduce((s,r) => s + r.vehicles, 0) > w.fleet) return null;
    if (!Array.isArray(w.demand) || w.demand.length !== w.districts.length || w.demand.some(n => !finite(n) || n < 0)) return null;
    if (!Array.isArray(w.queues) || w.queues.length !== w.districts.length || w.queues.some(q => !Array.isArray(q) || q.length !== w.districts.length || q.some(n => !finite(n) || n < 0))) return null;
    if (w.served < 0 || w.missed < 0 || w.income < 0 || w.expenses < 0 || w.lastGrowth < 0) return null;
    return w;
  } catch { return null; }
}
export function load(storage: Pick<Storage, 'getItem'>): { world: World; warning?: string } {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return { world: createWorld() };
    const world = restore(raw);
    return world ? { world } : { world: createWorld(), warning: 'saveInvalid' };
  } catch { return { world: createWorld(), warning: 'saveBlocked' }; }
}
export function save(world: World, storage: Pick<Storage, 'setItem'>): boolean {
  try { storage.setItem(SAVE_KEY, JSON.stringify(world)); return true; } catch { return false; }
}
