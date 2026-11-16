export interface District {
  id: number; name: string; type: string; x: number; y: number;
  population: number; jobs: number; pull: number; density: number;
  landValue: number; accessibility: number;
}
export interface Route { id: number; stops: number[]; vehicles: number; served: number; }
export interface World {
  version: 1; seed: number; minute: number; remainder: number; money: number;
  satisfaction: number; trust: number; districts: District[]; routes: Route[];
  fleet: number; fare: number; nextRoute: number; served: number; missed: number;
  income: number; expenses: number; lastGrowth: number; queues: number[][]; demand: number[];
}
export type Command = { type: 'buildRoute'; stops: number[] } |
  { type: 'buyVehicle' } | { type: 'assignVehicle'; routeId: number } |
  { type: 'removeRoute'; routeId: number };
export type Result = { ok: true } | { ok: false; error: string };
