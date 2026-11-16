import { describe, it, expect } from 'vitest';
import { createWorld, getSnapshot, step, applyCommand } from '../src/sim/world';
import { demand, modeShares, routeLength, routeTravel, headway } from '../src/sim/demand';
import { accessibility, growthRate, grow } from '../src/sim/growth';
import { routeCost, reserved } from '../src/sim/commands';
import { E, M } from '../src/sim/config';
import { random } from '../src/core/rng';
import { load, restore, save, SAVE_KEY } from '../src/core/save';
describe('спрос, транспорт и рост',()=>{
  it('нормализует выбор и снижает долю транспорта при дорогом билете',()=>{
    const cheap=modeShares(20,15,4,8),expensive=modeShares(20,65,4,8);
    expect(cheap.transit+cheap.car+cheap.walk+cheap.taxi).toBeCloseTo(1,12);expect(cheap.transit).toBeGreaterThan(expensive.transit);
    const unavailable=modeShares(Infinity,35,10,8);expect(unavailable.transit).toBe(0);
    expect(modeShares(20,35,4,8,2).transit).toBeLessThan(modeShares(20,35,4,8,0).transit);
  });
  it('учитывает расстояние, час и выходные без поездок в свой район',()=>{
    const w=createWorld(),a=w.districts[1],b=w.districts[4];
    expect(demand(a,a,0)).toBe(0);expect(demand(a,b,0)).toBeGreaterThan(demand(a,{...b,x:50},0));
    expect(demand(a,b,0)).toBeGreaterThan(demand(a,b,12*60));
    expect(demand(a,b,0)).toBeGreaterThan(demand(a,b,E.minutesPerDay*5));
  });
  it('считает длину, время поездки и интервал по порядку остановок',()=>{
    const w=createWorld(),r=w.routes[0];expect(routeLength(w,r)).toBe(9);
    expect(routeTravel(w,r,0,3)).toBe(9*M.minutesPerUnit);
    expect(routeTravel(w,r,0,6)).toBe(Infinity);
    expect(headway(w,{...r,vehicles:2})).toBeCloseTo(headway(w,r)/2);
  });
  it('растит население быстрее при доступности и развивает стоимость земли',()=>{
    expect(growthRate(1,80)).toBeGreaterThan(growthRate(0,80));
    const w=createWorld(),before=w.districts.reduce((s,d)=>s+d.population,0);
    expect(accessibility(w,1)).toBeGreaterThan(0);expect(accessibility(w,7)).toBe(0);
    grow(w);expect(w.lastGrowth).toBeGreaterThan(0);expect(w.districts.reduce((s,d)=>s+d.population,0)).toBe(before+w.lastGrowth);
  });
  it('обеспечивает линейную вместимость машин',()=>{
    const a=createWorld(),b=createWorld();b.routes[0].vehicles=2;
    step(a,60);step(b,60);expect(b.served).toBeGreaterThan(a.served);expect(b.served).toBeLessThanOrEqual(a.served*2+0.01);
  });
  it('соблюдает бухгалтерское равенство и изолирует снимки',()=>{
    const w=createWorld();step(w,E.minutesPerDay);
    expect(w.money).toBeCloseTo(E.initialMoney+w.income-w.expenses,6);
    const snap=getSnapshot(w);snap.routes[0].stops.push(11);expect(w.routes[0].stops).not.toContain(11);
  });
  it('дробный шаг эквивалентен целому, генератор повторяется',()=>{
    const a=createWorld(123),b=createWorld(123);step(a,60);for(let i=0;i<120;i++)step(b,0.5);expect(a).toEqual(b);
    const r={seed:7},s={seed:7};expect(random(r)).toBe(random(s));
    expect(()=>step(a,-1)).toThrow();expect(()=>step(a,NaN)).toThrow();
  });
});
describe('команды',()=>{
  it('тратит средства, назначает резерв и не меняет состояние при ошибке',()=>{
    const w=createWorld(),before=w.money;expect(routeCost(3)).toBe(E.routeBaseCost+3*E.stopCost);
    expect(applyCommand(w,{type:'buildRoute',stops:[2,6,7]}).ok).toBe(true);
    expect(w.money).toBe(before-routeCost(3));expect(reserved(w)).toBe(0);
    const copy=getSnapshot(w);expect(applyCommand(w,{type:'buildRoute',stops:[0,4]}).ok).toBe(false);expect(w).toEqual(copy);
    expect(applyCommand(w,{type:'buyVehicle'}).ok).toBe(true);expect(reserved(w)).toBe(1);
    expect(applyCommand(w,{type:'assignVehicle',routeId:2}).ok).toBe(true);
    expect(applyCommand(w,{type:'removeRoute',routeId:2}).ok).toBe(true);expect(reserved(w)).toBe(2);
  });
  it('отклоняет неправильные остановки и покупку без денег',()=>{
    const w=createWorld();for(const stops of [[0],[0,0],[0,99],[0,1.5]])expect(applyCommand(w,{type:'buildRoute',stops}).ok).toBe(false);
    w.money=0;const copy=getSnapshot(w);expect(applyCommand(w,{type:'buyVehicle'}).ok).toBe(false);expect(w).toEqual(copy);
  });
});
describe('сохранения',()=>{
  it('восстанавливает город и продолжает ту же последовательность',()=>{
    const w=createWorld();step(w,60);const restored=restore(JSON.stringify(w))!;expect(restored).toEqual(w);step(w,60);step(restored,60);expect(restored).toEqual(w);
  });
  it('отвергает повреждения и незнакомую версию',()=>{
    expect(restore('{')).toBeNull();expect(restore('null')).toBeNull();
    for(const modify of [(w:any)=>w.version=99,(w:any)=>w.queues[0][0]=-1,(w:any)=>w.routes[0].vehicles=100,(w:any)=>delete w.districts[0].population,(w:any)=>w.routes[0].stops=[0,0],(w:any)=>w.nextRoute=1]){const w=createWorld();modify(w);expect(restore(JSON.stringify(w))).toBeNull();}
  });
  it('обрабатывает запрет хранилища и изолирует старый прототип',()=>{
    expect(SAVE_KEY).toContain('stage2');expect(save(createWorld(),{setItem(){throw Error();}})).toBe(false);
    expect(load({getItem(){throw Error();}}).warning).toBe('saveBlocked');
    expect(load({getItem(){return '{}';}}).warning).toBe('saveInvalid');
  });
});
it('10 игровых лет: повторяемый город, конечные числа, неотрицательное население',async()=>{
  const duration=10*E.monthsPerYear*E.daysPerMonth*E.minutesPerDay;
  const a=createWorld(732),b=createWorld(732);
  applyCommand(a,{type:'buildRoute',stops:[1,6,7]});applyCommand(b,{type:'buildRoute',stops:[1,6,7]});
  for(let year=0;year<10;year++){step(a,duration/10);step(b,duration/10);await new Promise(resolve=>setTimeout(resolve,0));}
  expect(a).toEqual(b);
  const check=(value:unknown):void=>{if(typeof value==='number')expect(Number.isFinite(value)).toBe(true);else if(value&&typeof value==='object')Object.values(value).forEach(check);};
  check(a);expect(a.districts.every(d=>d.population>=0)).toBe(true);expect(a.districts.reduce((s,d)=>s+d.population,0)).toBeGreaterThan(5000);
},300000);
