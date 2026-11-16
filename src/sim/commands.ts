import { E, M } from './config';
import type { Command, Result, World } from './types';
export const routeCost = (count: number) => E.routeBaseCost + count * E.stopCost;
export const reserved = (w: World) => w.fleet - w.routes.reduce((s, r) => s + r.vehicles, 0);
export function applyCommand(world: World, cmd: Command): Result {
  if (cmd.type === 'buildRoute') {
    const ids = cmd.stops;
    if (!Array.isArray(ids) || ids.length < 2 || ids.length > world.districts.length || new Set(ids).size !== ids.length || ids.some(id => !Number.isInteger(id) || !world.districts[id])) return { ok: false, error: 'invalidStops' };
    if (world.routes.length >= E.maxRoutes) return { ok: false, error: 'routeLimit' };
    if (reserved(world) < 1) return { ok: false, error: 'noReserve' };
    const cost = routeCost(ids.length);
    if (world.money < cost) return { ok: false, error: 'noMoney' };
    world.money -= cost; world.expenses += cost;
    world.routes.push({ id: world.nextRoute++, stops: [...ids], vehicles: 1, served: 0 });
  } else if (cmd.type === 'buyVehicle') {
    if (world.fleet >= E.maxVehicles) return { ok: false, error: 'fleetLimit' };
    if (world.money < M.price) return { ok: false, error: 'noMoney' };
    world.fleet++; world.money -= M.price; world.expenses += M.price;
  } else if (cmd.type === 'assignVehicle') {
    const route = world.routes.find(r => r.id === cmd.routeId);
    if (!route) return { ok: false, error: 'invalidRoute' };
    if (reserved(world) < 1) return { ok: false, error: 'noReserve' };
    route.vehicles++;
  } else if (cmd.type === 'removeRoute') {
    if (!world.routes.some(r => r.id === cmd.routeId)) return { ok: false, error: 'invalidRoute' };
    world.routes = world.routes.filter(r => r.id !== cmd.routeId);
  } else return { ok: false, error: 'invalidCommand' };
  return { ok: true };
}
