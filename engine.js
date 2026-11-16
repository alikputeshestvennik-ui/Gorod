/* Deterministic simulation; no browser dependencies. One tick = five game minutes. */
(function (root) {
  'use strict';
  var STOPS = [
    {name:'Вокзал',x:1,y:10,type:'Транспортный узел',weight:1.6},
    {name:'Старый город',x:1,y:7,type:'Жилой район',weight:1.1},
    {name:'Площадь Мира',x:4,y:7,type:'Центр города',weight:1.6},
    {name:'Рынок',x:4,y:4,type:'Торговый квартал',weight:1.4},
    {name:'Завод',x:1,y:1,type:'Рабочие места',weight:1.3},
    {name:'Университет',x:7,y:1,type:'Учебный квартал',weight:1.2},
    {name:'Больница',x:7,y:4,type:'Городская больница',weight:1.4},
    {name:'Заречье',x:10,y:4,type:'Новый жилой район',weight:1.3},
    {name:'Северный',x:10,y:1,type:'Жилой район',weight:1},
    {name:'Парк',x:10,y:7,type:'Отдых и прогулки',weight:.8},
    {name:'Набережная',x:7,y:10,type:'Деловой квартал',weight:1.1},
    {name:'Южный',x:4,y:10,type:'Жилой район',weight:1.1}
  ];
  var COLORS=['#32946d','#df9b56','#6f88b6','#b77da3','#7e9954','#58a6ae'];
  function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
  function random(s){s.seed=(s.seed*1664525+1013904223)>>>0;return s.seed/4294967296;}
  function log(s,message){s.journal.unshift({tick:s.tick,text:message});s.journal=s.journal.slice(0,60);}
  function create(){
    var s={version:1,seed:412781,tick:0,money:85000,population:5000,happiness:68,trust:65,ecology:78,fare:35,
      routes:[{id:1,name:'Вокзальный',stops:[0,1,2,3],color:COLORS[0],served:0}],
      vehicles:[{id:1,route:1,leg:0,progress:0,direction:1,passengers:[],wear:0},{id:2,route:null,leg:0,progress:0,direction:1,passengers:[],wear:0}],
      queues:[],served:0,earned:0,spent:0,history:[],nextRoute:2,nextVehicle:3,mission:0,choice:null,storyPending:false,
      introSeen:false,loan:false,ended:false,won:false,event:null,notifications:[],journal:[],lastGrowth:0,missionsPaid:[]};
    for(var i=0;i<STOPS.length;i++){
      s.queues.push([]);
      for(var j=0;j<5+i%4;j++){var dest=Math.floor(random(s)*STOPS.length);if(dest!==i)s.queues[i].push({dest:dest,wait:0});}
    }
    log(s,'Вы назначены начальником транспорта. Две маршрутки, старый гараж и целый город впереди.');
    return s;
  }
  function coverage(s){var a={};s.routes.forEach(function(r){if(s.vehicles.some(function(v){return v.route===r.id;}))r.stops.forEach(function(id){a[id]=true;});});return Object.keys(a).length;}
  function routeLength(r){var total=0;for(var i=1;i<r.stops.length;i++){var a=STOPS[r.stops[i-1]],b=STOPS[r.stops[i]];total+=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}return total;}
  function notify(s,message){s.notifications.push(message);log(s,message);}
  function income(s,value){s.money+=value;s.earned+=value;}
  function expense(s,value){s.money-=value;s.spent+=value;}
  function cost(ids){return 3000+ids.length*500;}
  function build(s,ids){
    if(s.ended)return {ok:false,error:'Начните новую игру.'};
    if(ids.length<2 || ids.length>12 || ids.some(function(n,i){return typeof n!=='number'||n%1!==0||!STOPS[n]||ids.indexOf(n)!==i;}))return {ok:false,error:'Выберите от 2 до 12 разных остановок.'};
    if(s.routes.length>=6)return {ok:false,error:'В прототипе доступно до 6 маршрутов.'};
    var free=s.vehicles.filter(function(v){return v.route===null;})[0];
    var price=cost(ids)+(free?0:18000);
    if(s.money<price)return {ok:false,error:'Нужно '+price+' ₽. Накопите бюджет или возьмите городской кредит.'};
    var id=s.nextRoute++;var r={id:id,name:STOPS[ids[0]].name+' — '+STOPS[ids[ids.length-1]].name,stops:ids.slice(),color:COLORS[(id-1)%COLORS.length],served:0};
    if(!free){free={id:s.nextVehicle++,route:null,leg:0,progress:0,direction:1,passengers:[],wear:0};s.vehicles.push(free);}
    free.route=id;free.leg=0;free.progress=0;free.direction=1;s.routes.push(r);expense(s,price);
    log(s,'Открыт маршрут №'+id+': '+r.name+'. Затраты '+price+' ₽.');checkMissions(s);
    return {ok:true,price:price,id:id};
  }
  function buy(s){
    if(s.ended)return {ok:false,error:'Игра завершена.'};
    if(s.money<18000)return {ok:false,error:'Маршрутка стоит 18 000 ₽.'};
    if(s.vehicles.length>=20)return {ok:false,error:'В гараже нет места: максимум 20 машин.'};
    expense(s,18000);s.vehicles.push({id:s.nextVehicle++,route:null,leg:0,progress:0,direction:1,passengers:[],wear:0});log(s,'Куплена маршрутка за 18 000 ₽. Назначьте её на линию.');return {ok:true};
  }
  function unload(s,v){
    var r=s.routes.filter(function(r){return r.id===v.route;})[0];
    var stop=r?r.stops[v.leg]:0;
    v.passengers.forEach(function(p){s.queues[stop].push({dest:p.dest,wait:0});});v.passengers=[];
  }
  function assign(s,vid,rid){
    var v=s.vehicles.filter(function(v){return v.id===vid;})[0];
    var r=s.routes.filter(function(r){return r.id===rid;})[0];
    if(!v || (rid!==null&&!r))return {ok:false,error:'Маршрут не найден.'};
    if(v.route===rid)return {ok:true};
    unload(s,v);v.route=rid;v.leg=0;v.progress=0;v.direction=1;return {ok:true};
  }
  function closeRoute(s,id){
    var r=s.routes.filter(function(r){return r.id===id;})[0];
    if(!r)return {ok:false,error:'Маршрут не найден.'};
    if(s.choice==='deal' && r.stops.indexOf(7)>=0 && s.routes.filter(function(x){return x.stops.indexOf(7)>=0;}).length===1)return {ok:false,error:'Договор с Грачом требует сохранять маршрут в Заречье.'};
    s.vehicles.forEach(function(v){if(v.route===id)assign(s,v.id,null);});s.routes=s.routes.filter(function(r){return r.id!==id;});s.trust=Math.max(0,s.trust-3);log(s,'Маршрут №'+id+' закрыт. Транспорт переведён в резерв.');return {ok:true};
  }
  function repair(s,vid){var v=s.vehicles.filter(function(v){return v.id===vid;})[0];if(!v)return {ok:false,error:'Машина не найдена.'};if(s.money<1500)return {ok:false,error:'Ремонт стоит 1 500 ₽.'};expense(s,1500);v.wear=0;return {ok:true};}
  function takeLoan(s){if(s.loan)return {ok:false,error:'Городской кредит уже выдан.'};s.loan=true;income(s,25000);log(s,'Получен городской кредит: 25 000 ₽. Обслуживание: 300 ₽ в час.');return {ok:true};}
  function repay(s){if(!s.loan)return {ok:false,error:'Нет действующего кредита.'};if(s.money<25000)return {ok:false,error:'Для погашения нужно 25 000 ₽.'};expense(s,25000);s.loan=false;log(s,'Городской кредит полностью погашен.');return {ok:true};}
  function choice(s,value){
    if(s.choice || !s.storyPending || ['deal','public'].indexOf(value)<0)return {ok:false,error:'Это решение сейчас недоступно.'};
    if(value==='deal'){
      var r=s.routes.filter(function(r){return r.stops.indexOf(7)>=0;})[0];
      if(!r){return {ok:false,error:'Сначала соедините Заречье с городом: этого требует инвестор.'};}
      income(s,30000);s.trust=clamp(s.trust-6,0,100);s.happiness=clamp(s.happiness-4,0,100);notify(s,'Вы приняли предложение Грача. +30 000 ₽, субсидия 200 ₽/час; маршрут в Заречье защищён договором.');
    }else{s.trust=clamp(s.trust+8,0,100);s.happiness=clamp(s.happiness+5,0,100);notify(s,'Вы отказали Грачу. Доверие мэра +8, довольство +5. Горожане ценят независимость.');}
    s.choice=value;s.storyPending=false;return {ok:true};
  }
  function checkMissions(s){
    if(s.mission===0&&s.routes.some(function(r){return r.stops.indexOf(6)>=0&&s.vehicles.some(function(v){return v.route===r.id;});})){
      s.mission=1;income(s,8000);s.missionsPaid.push(0);notify(s,'Больница подключена! Город выделил 8 000 ₽ на развитие.');
    }
    if(s.mission===1&&s.served>=100){s.mission=2;income(s,10000);s.trust=clamp(s.trust+7,0,100);s.missionsPaid.push(1);notify(s,'100 пассажиров доставлены! Награда 10 000 ₽, доверие +7.');}
    if(s.mission===2&&s.population>=6000&&s.served>=300&&s.choice){s.mission=3;s.won=true;income(s,15000);s.missionsPaid.push(2);notify(s,'Первая глава завершена! Верхнереченск вырос до 6 000 жителей. Награда 15 000 ₽.');}
  }
  function arrive(s,v,r){
    var stop=r.stops[v.leg];var remaining=[];
    v.passengers.forEach(function(p){if(p.dest===stop){s.served++;r.served++;}else remaining.push(p);});v.passengers=remaining;
    var queue=s.queues[stop],next=[];
    queue.forEach(function(p){if(v.passengers.length<12&&r.stops.indexOf(p.dest)>=0){v.passengers.push(p);income(s,s.fare);}else next.push(p);});s.queues[stop]=next;
  }
  function tick(s){
    if(s.ended)return;
    var before=s.money;s.tick++;
    var hour=(8+Math.floor(s.tick/12))%24;var peak=(hour>=7&&hour<=10)||(hour>=17&&hour<=20);
    var demand=(peak?1:.5)*s.population/5000*clamp(1.6-s.fare/60,.2,1.6);
    for(var i=0;i<STOPS.length;i++){
      var queue=s.queues[i];
      s.queues[i]=queue.filter(function(p){p.wait++;return p.wait<60;});
      var rate=demand*STOPS[i].weight*(s.event&&s.event.kind==='fair'&&i===3?2.6:1);
      if(random(s)<rate*.43 && s.queues[i].length<55){var dest=Math.floor(random(s)*STOPS.length);if(dest!==i)s.queues[i].push({dest:dest,wait:0});}
    }
    s.vehicles.forEach(function(v){
      if(v.route===null)return;
      var r=s.routes.filter(function(r){return r.id===v.route;})[0];if(!r){v.route=null;return;}
      if(v.progress===0)arrive(s,v,r);
      if(v.leg===r.stops.length-1)v.direction=-1;if(v.leg===0)v.direction=1;
      var a=STOPS[r.stops[v.leg]],b=STOPS[r.stops[v.leg+v.direction]];
      var len=Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
      var speed=(s.event&&s.event.kind==='snow'?.65:1)*(v.wear>80?.6:1);
      v.progress+=.9*speed/len;
      if(v.progress>=1){v.leg+=v.direction;v.progress=0;}
      v.wear=clamp(v.wear+.018,0,100);
    });
    if(s.tick%12===0){
      var active=s.vehicles.filter(function(v){return v.route!==null;}).length;
      var costs=active*210+(s.vehicles.length-active)*35+(s.loan?300:0);
      expense(s,costs);income(s,coverage(s)*45+(s.choice==='deal'?200:0));
      var waiting=s.queues.reduce(function(t,q){return t+q.length;},0);
      var target=clamp(40+coverage(s)*3.5-(s.fare-30)*.45-waiting*.08,12,96);
      s.happiness=clamp(s.happiness+(target-s.happiness)*.13,0,100);
      s.trust=clamp(s.trust+(s.happiness>=55?.35:-.7)+(s.money<0?-2:0),0,100);
      s.ecology=clamp(82-active*.8+coverage(s)*.4,0,100);
    }
    if(s.tick%24===0){var growth=Math.round(Math.max(-25,(coverage(s)-2)*7+s.happiness*.4-15));s.population=Math.max(2000,s.population+growth);s.lastGrowth=growth;}
    if(s.tick===48){s.event={kind:'snow',until:72};notify(s,'Мокрый снег: скорость транспорта снижена на 35% на два игровых часа.');}
    if(s.event&&s.tick>=s.event.until){s.event=null;notify(s,'Погода и спрос вернулись к обычному режиму.');}
    if(s.tick===110){s.event={kind:'fair',until:146};notify(s,'Ярмарка на рынке! Спрос у остановки «Рынок» вырос на три часа.');}
    if(!s.choice&&!s.storyPending&&s.served>=80){s.storyPending=true;notify(s,'Артём Грач предлагает сделку. Прочитайте письмо в разделе «История».');}
    checkMissions(s);
    s.history.push(s.money-before);if(s.history.length>12)s.history.shift();
    if(s.money< -10000&&s.trust<20){s.ended=true;notify(s,'Бюджет и доверие исчерпаны. Мэр отправил вас в отставку.');}
  }
  function metrics(s){return {coverage:coverage(s),waiting:s.queues.reduce(function(t,q){return t+q.length;},0),onboard:s.vehicles.reduce(function(t,v){return t+v.passengers.length;},0),profit:Math.round(s.history.reduce(function(t,n){return t+n;},0)),active:s.vehicles.filter(function(v){return v.route!==null;}).length};}
  function restore(raw){
    try{
      var s=JSON.parse(raw);
      if(!s||s.version!==1||!Array.isArray(s.routes)||!Array.isArray(s.vehicles)||!Array.isArray(s.queues)||s.queues.length!==12||!Array.isArray(s.history)||!Array.isArray(s.journal)||!Array.isArray(s.notifications)||!Array.isArray(s.missionsPaid))return null;
      var nums=['tick','money','population','happiness','trust','fare','seed','served','nextRoute','nextVehicle','mission','earned','spent'];
      if(nums.some(function(k){return typeof s[k]!=='number'||!isFinite(s[k]);}))return null;
      if(s.tick<0||s.mission<0||s.mission>3||s.fare<15||s.fare>65||s.routes.length>6||s.vehicles.length>20)return null;
      var routeIds={};var valid=true;
      s.routes.forEach(function(r){if(!r||!Array.isArray(r.stops)||r.stops.length<2||r.stops.length>12||typeof r.id!=='number'||routeIds[r.id]||r.stops.some(function(id,i){return !STOPS[id]||id%1!==0||r.stops.indexOf(id)!==i;}))valid=false;routeIds[r.id]=r;});
      s.vehicles.forEach(function(v){var r=routeIds[v.route];if(!v||!Array.isArray(v.passengers)||v.passengers.length>12||typeof v.wear!=='number'||!isFinite(v.wear)||typeof v.progress!=='number'||v.progress<0||v.progress>=1||!isFinite(v.progress)|| (v.route!==null&&(!r||v.leg<0||v.leg>=r.stops.length||v.leg%1!==0))||[1,-1].indexOf(v.direction)<0)valid=false;});
      s.queues.forEach(function(q){if(!Array.isArray(q)||q.length>1000)valid=false;else q.forEach(function(p){if(!p||!STOPS[p.dest]||p.dest%1!==0||typeof p.wait!=='number'||!isFinite(p.wait))valid=false;});});
      s.vehicles.forEach(function(v){v.passengers.forEach(function(p){if(!p||!STOPS[p.dest]||p.dest%1!==0)valid=false;});});
      return valid?s:null;
    }catch(e){return null;}
  }
  root.CityGame={STOPS:STOPS,COLORS:COLORS,create:create,tick:tick,build:build,buy:buy,assign:assign,closeRoute:closeRoute,repair:repair,takeLoan:takeLoan,repay:repay,choice:choice,metrics:metrics,cost:cost,routeLength:routeLength,restore:restore};
})(typeof window!=='undefined'?window:this);
