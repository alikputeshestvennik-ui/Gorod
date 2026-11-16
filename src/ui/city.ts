import { t, number } from '../core/i18n';
import { C } from '../sim/development';
import { E } from '../sim/config';
import type { World } from '../sim/types';
export function cityReport(w: World) {
  const mobility = Object.fromEntries(Object.entries(w.mobility).map(([key,value])=>[key,number(value)]));
  return `<h2>${t('cityReport')}</h2><p>${t('growthDaily')}</p><p>${t('growthVisual')}</p>
    ${w.expansion ? `<p class="warning">${t('quarterBuilding',{name:t(C.quarters[w.expansion.index].name),days:Math.ceil((w.expansion.until-w.minute)/E.minutesPerDay)})}</p>` : ''}
    <h3>${t('mobilityTitle')}</h3><p>${t('mobilityCounts',mobility)}</p><p>${t('mobilityHint')}</p>
    ${w.districts.map(d=>{const phase=w.development[d.id].phase;return `<div class="city-district">${t('districtResidents',{name:t(d.name),count:number(d.population)})}<small>${t('phase'+phase[0].toUpperCase()+phase.slice(1))}</small></div>`;}).join('')}`;
}
