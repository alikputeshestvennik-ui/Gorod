'use strict';
var g=window.CityGame, failures=0, tests=0;
function assert(ok,message){if(!ok)throw Error(message||'Assertion failed');}
function equal(a,b){assert(a===b,JSON.stringify(a)+' !== '+JSON.stringify(b));}
function test(name,fn){tests++;try{fn();console.log('PASS '+name);}catch(e){failures++;console.log('FAIL '+name+': '+e.message);}}
test('initial budget, fleet and coverage',function(){var s=g.create();equal(s.money,85000);equal(s.vehicles.length,2);equal(g.metrics(s).coverage,4);});
test('hospital route uses reserve and grants reward exactly once',function(){var s=g.create();assert(g.build(s,[2,6]).ok);equal(s.money,89000);equal(s.vehicles[1].route,2);equal(s.mission,1);assert(g.build(s,[3,6]).ok);equal(s.money,67000);equal(s.missionsPaid.length,1);});
test('invalid routes and insufficient funds do not mutate the game',function(){var s=g.create();[[],[1],[1,1],[1,99],[1,1.5],[1,'2']].forEach(function(ids){assert(!g.build(s,ids).ok);equal(s.money,85000);});s.money=100;assert(!g.build(s,[1,2]).ok);equal(s.routes.length,1);});
test('passengers board, pay and reach their destination',function(){var s=g.create();s.queues=s.queues.map(function(){return [];});s.queues[0]=[{dest:1,wait:0}];g.tick(s);equal(s.vehicles[0].passengers.length,1);equal(s.money,85035);for(var i=0;i<5;i++)g.tick(s);assert(s.served>=1);assert(s.vehicles.every(function(v){return v.passengers.length<=12;}));});
test('closing a line returns vehicles and all passengers',function(){var s=g.create();g.tick(s);var before=s.vehicles[0].passengers.length,waiting=s.queues[0].length;assert(g.closeRoute(s,1).ok);equal(s.vehicles[0].route,null);equal(s.queues[0].length,waiting+before);equal(g.metrics(s).coverage,0);});
test('investor requires service to Zarechye and locks its final route',function(){var s=g.create();s.storyPending=true;assert(!g.choice(s,'deal').ok);g.build(s,[6,7]);assert(g.choice(s,'deal').ok);equal(s.choice,'deal');assert(!g.closeRoute(s,2).ok);assert(!g.choice(s,'public').ok);});
test('public choice increases trust without a grant',function(){var s=g.create();s.storyPending=true;assert(g.choice(s,'public').ok);equal(s.trust,73);equal(s.money,85000);});
test('loan cannot duplicate and can be repaid',function(){var s=g.create();g.takeLoan(s);assert(!g.takeLoan(s).ok);equal(s.money,110000);assert(g.repay(s).ok);equal(s.money,85000);assert(!s.loan);});
test('save restoration validates corrupt data',function(){var s=g.create();assert(g.restore(JSON.stringify(s)));['null','{}','{broken','[]'].forEach(function(raw){equal(g.restore(raw),null);});s.vehicles[0].leg=999;equal(g.restore(JSON.stringify(s)),null);});
test('bankruptcy ends the simulation',function(){var s=g.create();s.money=-11000;s.trust=10;g.tick(s);assert(s.ended);var t=s.tick;g.tick(s);equal(s.tick,t);});
test('first chapter can be completed with a solvent network',function(){
  var s=g.create();g.build(s,[0,11,10,9]);g.build(s,[2,3,6,7,8,5,4]);
  var storySeen=false;
  for(var i=0;i<650;i++){
    g.tick(s);
    if(s.storyPending&&!s.choice){storySeen=true;g.choice(s,'public');}
    if(i===80){g.buy(s);g.assign(s,s.vehicles[s.vehicles.length-1].id,3);}
  }
  var summary={money:s.money,population:s.population,served:s.served,mission:s.mission,happiness:Math.round(s.happiness),won:s.won};
  console.log('Campaign result: '+JSON.stringify(summary));
  assert(storySeen,'Investor event did not trigger');assert(s.won,JSON.stringify(summary));assert(s.money>0);equal(s.mission,3);
  assert(s.vehicles.every(function(v){return v.passengers.length<=12;}));assert(g.restore(JSON.stringify(s)));
});
if(failures)throw Error(failures+' / '+tests+' simulation tests failed');
console.log('ALL SIMULATION TESTS PASSED ('+tests+')');
