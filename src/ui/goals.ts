import { t, number } from '../core/i18n';
import { GOALS, GOAL_SLOTS, goalProgress } from '../sim/goals';
import { demandFlows } from '../sim/insights';
import { reserved } from '../sim/commands';
import { E } from '../sim/config';
import type { Goal, World } from '../sim/types';

export function goalTitle(w: World, goal: Goal) {
  if (goal.kind === 'connect') return t('goalConnect', { from: t(w.districts[goal.from].name), to: t(w.districts[goal.to].name) });
  return t(goal.kind === 'coverage' ? 'goalCoverage' : 'goalPassengers', { count: number(goal.target) });
}
export const canPlanGoal = (w: World) => reserved(w, 'marshrutka') > 0 && w.routes.length < E.maxRoutes;
export function goalDetail(w: World, goal: Goal) {
  const progress = goalProgress(w, goal);
  return `<h2>${goalTitle(w, goal)}</h2><p>${t('goalHint'+goal.kind)}</p><p>${t('goalProgress', { current: number(progress.current), target: number(progress.target) })} · ${t('goalReward', { count: number(GOALS[goal.slot].reward) })}</p>`;
}
export const goalBoard = () => `<section id="goal-board" aria-label="${t('goalsTitle')}">${GOAL_SLOTS.map(slot =>
  `<article data-goal-slot="${slot}"><small>${t('goalSlot'+slot)}</small><button id="${slot === 'quick' ? 'demand-details' : 'goal-open-'+slot}"><b id="${slot === 'quick' ? 'demand-direction' : 'goal-title-'+slot}"></b></button><progress id="goal-progress-${slot}" max="1" value="0"></progress><span id="goal-count-${slot}"></span><strong>${t('goalReward', { count: number(GOALS[slot].reward) })}</strong>${slot === 'quick' ? `<button id="demand-suggest">${t('flowPlan')}</button>` : ''}</article>`).join('')}</section>`;

export function updateGoalBoard(w: World) {
  for (const goal of w.goals.active) {
    const { current, target } = goalProgress(w, goal), slot = goal.slot;
    const title = goalTitle(w, goal);
    const label = document.getElementById(slot === 'quick' ? 'demand-direction' : 'goal-title-'+slot)!;
    label.textContent = title;
    if (goal.kind === 'connect') {
      const flow = demandFlows(w).find(f => f.from === goal.from && f.to === goal.to);
      label.textContent += ' · '+t('flowPerHour', { count: (flow?.perHour ?? 0).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) });
    }
    const progress = document.querySelector<HTMLProgressElement>('#goal-progress-'+slot)!;
    progress.max = target; progress.value = current; progress.setAttribute('aria-label', title);
    document.getElementById('goal-count-'+slot)!.textContent = t('goalProgress', { current: number(current), target: number(target) });
  }
  const quick = w.goals.active[0];
  document.getElementById('demand-suggest')!.textContent = t(quick.kind === 'connect' && canPlanGoal(w) ? 'flowPlan' : 'routes');
}
