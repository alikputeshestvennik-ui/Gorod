import { E, T, MODES } from './config';
import { eventConfig } from './events';
import type { World } from './types';
export function account(w: World, served: number, covered: number): void {
  const hours=E.minutesPerTick/60;
  const ticket=served*w.fare,ads=served*E.advertisingPerPassenger;
  const subsidy=covered*E.subsidyPerStopHour*hours*(w.trust<E.crisisTrust?E.lowTrustSubsidy:1);
  const rent=covered*E.rentPerStopHour*hours;
  const interest=w.debt*E.loanDailyInterest*E.minutesPerTick/E.minutesPerDay;
  w.ledger.tickets+=ticket;w.ledger.advertising+=ads;w.ledger.subsidy+=subsidy;w.ledger.rent+=rent;w.ledger.interest+=interest;
  let costs=interest,emissions=0;
  for(const mode of MODES){
    const config=T[mode],active=w.routes.filter(r=>r.mode===mode).reduce((s,r)=>s+r.vehicles,0);
    const wages=active*config.wages*hours*(eventConfig(w)?.id==='strike'?E.strikeCostMultiplier:1);
    const energy=active*config.energy*hours,maintenance=(active*config.maintenance+(w.fleets[mode]-active)*config.reserveCostPerHour)*hours;
    const depreciation=active*config.depreciation*hours;
    costs+=wages+energy+maintenance+depreciation;emissions+=active*config.emissions;
    w.ledger.wages+=wages;w.ledger.energy+=energy;w.ledger.maintenance+=maintenance;w.ledger.depreciation+=depreciation;
    if(w.fleets[mode]) w.wear[mode]=Math.min(100,w.wear[mode]+config.wearPerHour*hours*active/w.fleets[mode]);
  }
  const income=ticket+ads+subsidy+rent;
  w.income+=income;w.expenses+=costs;w.money+=income-costs;
  if(w.minute%60===0){
    const target=Math.max(0,E.ecologyBase-emissions*E.emissionPenalty);
    w.ecology+=(target-w.ecology)*E.ecologySmoothing;
  }
  if(w.money < -E.gameOverMoney && w.trust < E.gameOverTrust)w.gameOver=true;
}
