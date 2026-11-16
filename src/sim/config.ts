import economy from '../../data/balance/economy.json';
import transport from '../../data/balance/transport.json';
import districts from '../../data/balance/districts.json';
function validate(value: unknown, path: string): void {
  if (typeof value === 'number' && (!Number.isFinite(value) || value < 0)) throw new Error(`Некорректное число в ${path}`);
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) validate(child, `${path}.${key}`);
}
validate(economy, 'economy'); validate(transport, 'transport'); validate(districts, 'districts');
if (!economy.minutesPerTick || !economy.minutesPerDay || !economy.daysPerMonth || !economy.monthsPerYear || !economy.distanceDecay || !transport.marshrutka.minutesPerUnit || !transport.marshrutka.capacity || districts.districts.length < 2) throw new Error('Некорректные настройки времени, транспорта или районов');
if (districts.districts.some((d, i) => d.id !== i || !(d.type in districts.originWeights))) throw new Error('Некорректные районы');
export const E = economy;
export const M = transport.marshrutka;
export const D = districts;
