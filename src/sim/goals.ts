import balance from '../../data/balance/goals.json' with { type: 'json' };
import { demandFlows } from './insights';
import { eventConfig } from './events';
import type { Goal, GoalSlot, GoalState, World } from './types';

export const GOALS = balance;
export const GOAL_SLOTS: GoalSlot[] = ['quick', 'medium', 'long'];
if (GOAL_SLOTS.some(slot => !Number.isInteger(balance[slot].passengers) || balance[slot].passengers <= 0 || !Number.isInteger(balance[slot].reward) || balance[slot].reward <= 0) || balance.long.coverageStep <= 0 || balance.long.minimumCoverage < 2) throw new Error('Некорректные настройки задач');
export const emptyGoals = (): GoalState => ({ active: [], nextId: 1, completed: 0, links: [], earned: 0, lastCompleted: null });
const pair = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;

function activeRoutes(w: World) {
  const event = eventConfig(w);
  return w.routes.filter(r => r.vehicles > 0 && !(event?.id === 'repair' && r.stops.includes(event.district)));
}
export const coverage = (w: World) => new Set(activeRoutes(w).flatMap(r => r.stops)).size;
export function goalProgress(w: World, goal: Goal) {
  if (goal.kind === 'connect') return { current: activeRoutes(w).some(r => r.stops.includes(goal.from) && r.stops.includes(goal.to)) ? 1 : 0, target: 1 };
  return { current: Math.min(goal.target, goal.kind === 'coverage' ? coverage(w) : Math.max(0, Math.floor(w.served - goal.baseline))), target: goal.target };
}
function generate(w: World, slot: GoalSlot): Goal {
  const id = w.goals.nextId++;
  if (slot === 'quick') {
    // A temporary closure must not create a paid task to rebuild an existing link.
    const flow = demandFlows(w).find(f => f.perHour > 0 && !f.connected && !w.goals.links.includes(pair(f.from, f.to)) &&
      !w.routes.some(r => r.vehicles > 0 && r.stops.includes(f.from) && r.stops.includes(f.to)));
    if (flow) return { id, slot, kind: 'connect', from: flow.from, to: flow.to };
  }
  if (slot === 'long') {
    const servedStops = coverage(w);
    if (servedStops < w.districts.length) return { id, slot, kind: 'coverage', target: Math.min(w.districts.length, Math.max(balance.long.minimumCoverage, servedStops + balance.long.coverageStep)) };
  }
  return { id, slot, kind: 'passengers', baseline: w.served, target: balance[slot].passengers };
}
export function initializeGoals(w: World) {
  w.goals = emptyGoals();
  w.goals.active = GOAL_SLOTS.map(slot => generate(w, slot));
}
/** One completion per slot per update; replacements always require new progress. */
export function updateGoals(w: World) {
  if (w.gameOver) return;
  w.goals.active.forEach((goal, index) => {
    const progress = goalProgress(w, goal);
    if (progress.current < progress.target) return;
    const reward = balance[goal.slot].reward;
    w.money += reward; w.income += reward; w.ledger.subsidy += reward;
    w.goals.completed++; w.goals.earned += reward; w.goals.lastCompleted = goal;
    if (goal.kind === 'connect') w.goals.links.push(pair(goal.from, goal.to));
    w.goals.active[index] = generate(w, goal.slot);
  });
}

/** Validate persisted progress separately from migration: never silently re-award v4 tasks. */
export function validGoals(w: World): boolean {
  const state = w.goals;
  if (!state || !Number.isSafeInteger(state.completed) || state.completed < 0 || !Number.isSafeInteger(state.nextId) || state.nextId !== state.completed + GOAL_SLOTS.length + 1 ||
      !Number.isSafeInteger(state.earned) || state.earned < 0 || state.earned > w.ledger.subsidy || !Array.isArray(state.links) ||
      state.links.length > state.completed || new Set(state.links).size !== state.links.length || state.links.some(key => {
        if (typeof key !== 'string' || !/^\d+:\d+$/.test(key)) return true;
        const [a, b] = key.split(':').map(Number); return a >= b || !w.districts[a] || !w.districts[b];
      }) || !Array.isArray(state.active) || state.active.length !== GOAL_SLOTS.length) return false;
  const valid = (goal: Goal) => {
    if (!goal || !Number.isSafeInteger(goal.id) || goal.id < 1 || goal.id >= state.nextId || !GOAL_SLOTS.includes(goal.slot)) return false;
    if (goal.kind === 'connect') return goal.slot === 'quick' && Number.isInteger(goal.from) && Number.isInteger(goal.to) && goal.from !== goal.to && !!w.districts[goal.from] && !!w.districts[goal.to];
    if (goal.kind === 'coverage') return goal.slot === 'long' && Number.isInteger(goal.target) && goal.target >= 2 && goal.target <= w.districts.length;
    return goal.kind === 'passengers' && goal.target === balance[goal.slot].passengers && Number.isFinite(goal.baseline) && goal.baseline >= 0 && goal.baseline <= w.served;
  };
  if (new Set(state.active.map(g => g?.id)).size !== GOAL_SLOTS.length || state.active.some((goal, i) => !valid(goal) || goal.slot !== GOAL_SLOTS[i] || goal.kind === 'connect' && state.links.includes(pair(goal.from, goal.to)))) return false;
  return state.completed === 0 ? state.lastCompleted === null && state.earned === 0 : valid(state.lastCompleted!) && !state.active.some(g => g.id === state.lastCompleted!.id);
}
