import { t } from '../core/i18n';
import { demandFlows, suggestedFlow, type DemandFlow } from '../sim/insights';
import type { World } from '../sim/types';
import feedback from '../../data/balance/feedback.json' with { type: 'json' };

export const flowCount = (flow: DemandFlow) => flow.perHour.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
export const flowNames = (w: World, flow: DemandFlow) => `${t(w.districts[flow.from].name)} → ${t(w.districts[flow.to].name)}`;

export function demandReport(w: World) {
  const flows = demandFlows(w);
  return `<h2>${t('demandTitle')}</h2><p>${t('demandExplanation')}</p>` + flows.slice(0, feedback.topFlowCount).map(flow =>
    `<article class="city-district"><b>${flowNames(w, flow)}</b><p>${t('flowPerHour', { count: flowCount(flow) })} · ${t(flow.connected ? 'flowConnected' : 'flowMissing')}</p></article>`).join('') +
    `<p>${t('demandQueueExplanation')}</p>`;
}

export function demandAdvice(w: World) {
  const flows = demandFlows(w), flow = suggestedFlow(flows);
  return { flow, text: flow ? `${flowNames(w, flow)} · ${t('flowPerHour', { count: flowCount(flow) })}` : t('flowAllConnected') };
}
