import { demand, routeTravel } from './demand';
import { eventConfig } from './events';
import type { World } from './types';

export interface DemandFlow { from: number; to: number; perHour: number; connected: boolean; }

/** Expected trips by all modes, not a fabricated queue of transit passengers. */
export function demandFlows(w: World): DemandFlow[] {
  const event = eventConfig(w);
  const routes = w.routes.filter(r => r.vehicles > 0 && !(event?.id === 'repair' && r.stops.includes(event.district)));
  const flows: DemandFlow[] = [];
  for (const a of w.districts) for (const b of w.districts) {
    if (a.id === b.id) continue;
    const perHour = demand(a, b, w.minute) * (event && (event.district < 0 || b.id === event.district) ? event.demand : 1);
    flows.push({ from: a.id, to: b.id, perHour, connected: routes.some(r => Number.isFinite(routeTravel(w, r, a.id, b.id))) });
  }
  return flows.sort((a, b) => b.perHour - a.perHour || a.from - b.from || a.to - b.to);
}

export function suggestedFlow(flows: DemandFlow[]) {
  return flows.find(flow => !flow.connected && flow.perHour > 0);
}
