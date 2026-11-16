import { E, EVENTS } from './config';
import { random } from '../core/rng';
import type { World } from './types';
export const eventConfig = (w: World) => w.event ? EVENTS.find(e=>e.id===w.event!.id) : undefined;
export function updateEvents(w: World): void {
  if(w.event && w.minute>=w.event.until){
    const event=eventConfig(w)!;
    const bonus=event.id==='inspection'?(w.satisfaction>=E.crisisTrust?event.trust:-event.trust):event.trust;
    w.trust=Math.max(0,Math.min(100,w.trust+bonus));w.event=null;
  }
  if(!w.event && w.minute>=w.nextEvent.at){
    const event=EVENTS.find(e=>e.id===w.nextEvent.id)!;
    w.event={id:event.id,until:w.minute+event.duration};
    const pop=w.districts.reduce((s,d)=>s+d.population,0);
    const choices=EVENTS.filter(e=>e.minPopulation<=pop&&e.maxTrust>=w.trust);
    const next=choices[Math.floor(random(w)*choices.length)];
    w.nextEvent={id:next.id,at:w.event.until+E.eventGapMinutes};
  }
}
