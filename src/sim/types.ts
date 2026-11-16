export type Mode = 'marshrutka' | 'bus' | 'trolleybus' | 'tram';
export interface District {
  id: number; name: string; type: string; x: number; y: number;
  population: number; jobs: number; pull: number; density: number;
  landValue: number; accessibility: number;
}
export interface Route { id: number; mode: Mode; stops: number[]; vehicles: number; served: number; }
export interface Ledger { tickets: number; advertising: number; subsidy: number; rent: number; wages: number; energy: number; maintenance: number; depreciation: number; interest: number; construction: number; purchases: number; }
export interface World {
  version: 2; seed: number; minute: number; remainder: number; money: number;
  satisfaction: number; trust: number; ecology: number; districts: District[]; routes: Route[];
  fleet: number; fleets: Record<Mode, number>; wear: Record<Mode, number>;
  fare: number; nextRoute: number; served: number; missed: number;
  income: number; expenses: number; lastGrowth: number; queues: number[][]; demand: number[];
  ledger: Ledger; debt: number; gameOver: boolean;
  event: { id: string; until: number } | null; nextEvent: { id: string; at: number };
}
export type Command = { type: 'buildRoute'; stops: number[]; mode?: Mode } |
  { type: 'editRoute'; routeId: number; stops: number[] } |
  { type: 'buyVehicle'; mode?: Mode } | { type: 'assignVehicle'; routeId: number } |
  { type: 'releaseVehicle'; routeId: number } | { type: 'setFare'; fare: number } |
  { type: 'serviceFleet'; mode: Mode } | { type: 'takeLoan' } | { type: 'repayLoan' } |
  { type: 'removeRoute'; routeId: number };
export type Result = { ok: true } | { ok: false; error: string };
