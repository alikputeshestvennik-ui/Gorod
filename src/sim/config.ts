import economy from '../../data/balance/economy.json';
import transport from '../../data/balance/transport.json';
import districts from '../../data/balance/districts.json';
import events from '../../data/balance/events.json';
import type { Mode } from './types';
function validate(value: unknown, path: string): void {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`Некорректное число в ${path}`);
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) validate(child, `${path}.${key}`);
}
validate(economy, 'economy'); validate(transport, 'transport'); validate(districts, 'districts'); validate(events, 'events');
if (!economy.minutesPerTick || !economy.minutesPerDay || !economy.daysPerMonth || !economy.monthsPerYear || !economy.distanceDecay || districts.districts.length < 2) throw new Error('Некорректные настройки времени или районов');
for (const mode of Object.values(transport)) {
  if (Object.values(mode).some(n => n < 0) || !mode.minutesPerUnit || !mode.capacity || !mode.price || mode.wages + mode.energy + mode.maintenance + mode.depreciation !== mode.activeCostPerHour) throw new Error('Некорректный баланс транспорта');
}
if (Object.values(economy).some(n => n < 0) || economy.fareMin > economy.fareMax || economy.minutesPerDay % economy.minutesPerTick) throw new Error('Некорректный баланс экономики');
if (districts.districts.some((d, i) => d.id !== i || !(d.type in districts.originWeights))) throw new Error('Некорректные районы');
if (new Set(events.map(e=>e.id)).size !== events.length || events.some(e=>!e.duration || e.duration % economy.minutesPerTick || !e.speed || e.demand < 0 || e.district < -1 || e.district >= districts.districts.length)) throw new Error('Некорректные события');
export const E = economy;
export const T = transport;
export const MODES = Object.keys(transport) as Mode[];
export const M = transport.marshrutka;
export const D = districts;
export const EVENTS = events;
