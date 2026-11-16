(function () {
  'use strict';
  const G=window.CityGame, $=id=>document.getElementById(id), KEY='city-route-save-v1';
  let state,storageOK=true;
  try { state=G.restore(localStorage.getItem(KEY)); } catch(e){storageOK=false;}
  state=state||G.create();
  let speed=1,paused=false,building=false,draft=[],selectedStop=null,heat=false,zoom=1,pan={x:0,y:0};
  let width=800,height=580,unit=32,acc=0,last=0,saveElapsed=0,toastTimer,renderClock=0,currentPanel=null,modalReturn=null;
  const canvas=$('city'),ctx=canvas.getContext('2d');
  const fmt=n=>Math.round(n).toLocaleString('ru-RU'), rub=n=>fmt(n)+' ₽';
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function toast(t){$('toast').textContent=t;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4500);}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));storageOK=true;$('save-status').textContent='Прогресс сохранён на устройстве';}catch(e){storageOK=false;$('save-status').textContent='Сохранение недоступно в этом браузере';}}
  function apply(result,message){if(!result.ok){toast(result.error);return false;}if(message)toast(message);save();renderUI();return true;}
  function date(t){const m=480+t*5;return (1+Math.floor(m/1440))+' мая · '+String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}
  function showModal(content,panel){
    currentPanel=panel||null;modalReturn=document.activeElement;
    $('modal-content').innerHTML=content;
    document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.panel===(panel||'map')));
    if(!$('modal').open)$('modal').showModal();
  }
  function modalTop(label,title){return '<div class="dialog-top"><span class="eyebrow">'+label+'</span><button class="dialog-close" data-action="close" aria-label="Закрыть">×</button></div><h2>'+title+'</h2>';}
  function closeModal(){$('modal').close();currentPanel=null;document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.panel==='map'));if(modalReturn&&modalReturn.isConnected)modalReturn.focus();}
  $('modal').addEventListener('close',()=>{currentPanel=null;acc=0;document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.panel==='map'));});
  $('modal').addEventListener('click',e=>{if(e.target===$('modal')){const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
  function help(first){
    showModal(modalTop(first?'ДОБРО ПОЖАЛОВАТЬ · ГЛАВА 01':'ПАМЯТКА НАЧАЛЬНИКА',first?'Город ждёт вас.':'Как устроен маршрут')+
      '<div class="intro-mark">↗</div><p>Верхнереченск. Пять тысяч жителей, две маршрутки и старый гараж. В папке предшественника записка: «Проверь, кто владеет землёй у вокзала».</p>'+
      '<div class="help-step"><b>1</b><span>Нажмите «Создать маршрут» и выберите на карте две или больше остановок. Линия автоматически проходит по улицам.</span></div>'+
      '<div class="help-step"><b>2</b><span>Свяжите <b>больницу</b> с другими районами. Одна машина уже работает, вторая ждёт в резерве. Новый маршрут стоит от 4 000 ₽.</span></div>'+
      '<div class="help-step"><b>3</b><span>Смотрите спрос, добавляйте машины и регулируйте тариф. Пассажиры едут к своей остановке без пересадок. Оплата — при посадке, награды — за доставку.</span></div>'+
      '<p>Перетаскивайте карту, приближайте колёсиком или двумя пальцами. Нажмите остановку для справки. Пауза — кнопка Ⅱ или пробел. В окнах управления время останавливается.</p>'+
      '<div class="dialog-actions"><button class="primary" data-action="start">'+(first?'Принять город':'Вернуться к городу')+' ↗</button></div>');
  }
  function renderUI(){
    const m=G.metrics(state);
    $('money').textContent=rub(state.money);$('money').style.color=state.money<0?'#b45544':'';
    $('population').textContent=fmt(state.population);$('happiness').innerHTML=Math.round(state.happiness)+'<span>%</span>';$('trust').innerHTML=Math.round(state.trust)+'<span>%</span>';
    $('profit').textContent=(m.profit>=0?'+':'')+rub(m.profit)+' за последний час';$('profit').style.color=m.profit<0?'#b68a65':'';
    $('growth').textContent=state.lastGrowth?(state.lastGrowth>0?'+':'')+state.lastGrowth+' жителей / 2 часа':'Рост зависит от транспорта';
    $('mood').textContent=state.happiness>75?'Жители довольны':state.happiness>50?'Есть куда расти':'Жители ждут перемен';
    $('trust-label').textContent=state.trust>75?'Мэр на вашей стороне':state.trust>40?'Кредит доверия':'Риск отставки';
    $('date').textContent=date(state.tick);$('weather').textContent=state.event&&state.event.kind==='snow'?'❄ +1° · Мокрый снег':state.event&&state.event.kind==='fair'?'☀ +18° · Ярмарка':'☀ +18° · Весна';
    $('route-count').textContent=state.routes.length;
    $('routes').innerHTML=state.routes.length?state.routes.map(r=>{
      const n=state.vehicles.filter(v=>v.route===r.id).length;
      return '<button class="route-item" data-route="'+r.id+'" style="--route:'+r.color+'"><span class="route-top"><span class="route-name"><i class="route-badge">'+String(r.id).padStart(2,'0')+'</i>'+escape(r.id===1?'Вокзальный':'Маршрут №'+r.id)+'</span><span class="route-status">'+(n?'На линии':'Нет машин')+'</span></span><span class="route-description">'+escape(G.STOPS[r.stops[0]].name)+' → '+escape(G.STOPS[r.stops[r.stops.length-1]].name)+'</span><span class="route-meta"><span>'+n+' машин · '+r.stops.length+' остановки</span><span>'+fmt(r.served)+' перевезено ↗</span></span></button>';
    }).join(''):'<p class="empty">Пока нет маршрутов. Соедините город первой линией.</p>';
    $('fleet-summary').textContent=state.vehicles.length+' машины · '+(state.vehicles.length-m.active)+' в резерве';
    $('map-mode').textContent=building?'Прокладываем маршрут':paused?'Город на паузе':state.event&&state.event.kind==='snow'?'В городе снег':heat?'Где ждут пассажиры':'Город живёт';
    $('map-subtitle').textContent=heat?m.waiting+' ждут · '+m.onboard+' в пути':m.coverage+' из 12 остановок подключено';
    $('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'Продолжить игру':'Приостановить игру');$('pause').classList.toggle('selected',paused);
    document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('selected',+b.dataset.speed===speed&&!paused));
    const missions=[['Ближе к людям','Жителям нужен транспорт до больницы. Соедините её хотя бы с одной остановкой.','Больница на действующей линии','+8 000 ₽',0],['Город в движении','Доставьте 100 пассажиров к их остановкам. Чем больше районов связано, тем полезнее сеть.',fmt(state.served)+' / 100 пассажиров','+10 000 ₽',state.served/100],['Новые горизонты','Вырастите город до 6 000 жителей, доставьте 300 пассажиров и ответьте на письмо Грача.',fmt(state.population)+' / 6 000 · '+Math.min(300,state.served)+'/300','+15 000 ₽',Math.min((state.population-5000)/1000,state.served/300,state.choice?1:.85)],['Город для будущего','Первая глава пройдена. Развивайте сеть дальше в свободном режиме.','Свободная игра','Глава пройдена',1]];
    const q=missions[state.mission];$('mission-title').textContent=q[0];$('mission-text').textContent=q[1];$('mission-detail').textContent=q[2];$('mission-reward').textContent=q[3];$('mission-progress').style.width=Math.max(0,Math.min(1,q[4]))*100+'%';$('mission-index').textContent=String(Math.min(state.mission+1,3)).padStart(2,'0')+' / 03';
    $('advisor-text').textContent=building?'«Короткие линии ходят чаще. Соединяйте районы с работой, рынком и больницей».':state.storyPending?'«Грач прислал письмо. Загляните в историю, начальник. Решение за вами».':m.waiting>180?'«Очереди растут. Нужны новые маршруты или ещё машины на загруженных линиях».':state.mission===0?'«До больницы люди добираются пешком. Добавим маршрут, начальник?»':'«Хороший транспорт меняет город. Главное — не забывать, для кого мы работаем». '; 
    document.querySelector('.nav-dot').style.display=state.storyPending?'inline-block':'none';
    if(selectedStop!==null&&!building)renderStop();
    if(!storageOK)$('save-status').textContent='Сохранение недоступно в этом браузере';
  }
  function fleet(){
    let html=modalTop('ТРАНСПОРТНОЕ УПРАВЛЕНИЕ','Ваш автопарк')+'<p>Маршрутка · 12 мест · 210 ₽/час на линии. В резерве — 35 ₽/час. Износ выше 80% снижает скорость.</p><div class="dialog-list">';
    state.vehicles.forEach(v=>{
      html+='<div class="dialog-row"><div><b>Маршрутка №'+v.id+'</b><small>'+v.passengers.length+'/12 мест · Износ '+Math.round(v.wear)+'%</small></div><div><select class="route-select" aria-label="Маршрут машины '+v.id+'" data-vehicle="'+v.id+'"><option value=""'+(v.route===null?' selected':'')+'>В резерве</option>'+state.routes.map(r=>'<option value="'+r.id+'"'+(v.route===r.id?' selected':'')+'>Маршрут №'+r.id+'</option>').join('')+'</select>'+(v.wear>=15?'<button class="secondary" style="margin-top:7px" data-repair="'+v.id+'">Ремонт · 1 500 ₽</button>':'')+'</div></div>';
    });
    html+='</div><div class="dialog-actions"><button class="primary" data-action="buy">＋ Купить · 18 000 ₽</button><button class="secondary" data-action="close">На карту</button></div>';showModal(html,'fleet');
  }
  function finance(){
    const m=G.metrics(state);const active=m.active,reserve=state.vehicles.length-active;
    showModal(modalTop('ЭКОНОМИКА ГОРОДА','Финансы')+'<div class="dialog-balance">'+rub(state.money)+'</div><div class="dialog-list"><div class="dialog-row"><span>Билеты, субсидии и награды<small>За всю игру, включая кредиты</small></span><strong>+'+rub(state.earned)+'</strong></div><div class="dialog-row"><span>Строительство, парк и расходы<small>За всю игру</small></span><strong>−'+rub(state.spent)+'</strong></div><div class="dialog-row"><span>Расходы на парк / час<small>'+active+' на линии · '+reserve+' в резерве</small></span><strong>'+rub(active*210+reserve*35)+'</strong></div><div class="dialog-row"><span>Субсидия / час<small>45 ₽ за каждую подключённую остановку</small></span><strong>+'+rub(m.coverage*45+(state.choice==='deal'?200:0))+'</strong></div><div class="dialog-row"><span>Баланс за последний час</span><strong>'+(m.profit>=0?'+':'')+rub(m.profit)+'</strong></div></div><h3>Стоимость проезда</h3><p>Высокий тариф снижает спрос и довольство. Рабочий диапазон: 25–40 ₽.</p><div class="dialog-fare"><button class="secondary" data-fare="-5">−</button><strong>'+state.fare+' ₽</strong><button class="secondary" data-fare="5">＋</button></div><h3>Городской кредит</h3><p>'+(state.loan?'Долг: 25 000 ₽. Обслуживание: 300 ₽ в час. Погасите долг, чтобы остановить списания.':'Можно получить 25 000 ₽. Обслуживание — 300 ₽ в час, до погашения основной суммы.')+'</p><div class="dialog-actions"><button class="secondary" data-action="'+(state.loan?'repay':'loan')+'">'+(state.loan?'Погасить · 25 000 ₽':'Взять 25 000 ₽')+'</button><button class="primary" data-action="close">Вернуться</button></div>','finance');
  }
  function journal(){
    let html=modalTop('ЛЮДИ И РЕШЕНИЯ','История города');
    if(state.storyPending){html+='<h3>Предложение Артёма Грача</h3><p>«Заречье — будущее города. Я дам тридцать тысяч и буду доплачивать за перевозки. Условие простое: маршрут через мои участки остаётся навсегда».</p><p>Степан Ильич хмурится: «В папке Корнеева тоже были эти участки…»</p><button class="choice" data-choice="deal"><b>Принять инвестиции</b><small>+30 000 ₽ и 200 ₽/час. Доверие −6, довольство −4. Нельзя закрыть последнюю линию в Заречье. Сначала проложите туда маршрут.</small></button><button class="choice" data-choice="public"><b>Сохранить независимость</b><small>Доверие +8, довольство +5. Развиваем город на собственные доходы.</small></button>';}
    else if(state.choice)html+='<p>'+(state.choice==='deal'?'Вы приняли инвестиции Грача. Маршрут в Заречье защищён договором. Деньги помогли городу, но у этой помощи есть цена.':'Вы выбрали независимость транспортной системы. Вера Лунина готовит материал о земле у вокзала.')+'</p>';
    else html+='<p>Павел Корнеев, ваш предшественник, исчез. В папке остались две заметки: «Не соглашайся на метро до сороковых» и «Проверь, кто владеет землёй у вокзала».</p><p>Развивайте сеть. После 80 доставленных пассажиров вас найдёт первый инвестор.</p>';
    html+='<h3>Журнал событий</h3>'+state.journal.slice(0,20).map(e=>'<div class="journal-entry"><time>'+date(e.tick)+'</time>'+escape(e.text)+'</div>').join('');showModal(html,'journal');
  }
  function routeDetails(id){
    const r=state.routes.find(r=>r.id===id);if(!r)return;
    const vehicles=state.vehicles.filter(v=>v.route===id),free=state.vehicles.filter(v=>v.route===null);
    showModal(modalTop('МАРШРУТ №'+r.id,escape(r.name))+'<p>'+r.stops.map(i=>escape(G.STOPS[i].name)).join(' → ')+'</p><div class="dialog-list"><div class="dialog-row"><span>Доставлено пассажиров</span><strong>'+r.served+'</strong></div><div class="dialog-row"><span>Машин на линии</span><strong>'+vehicles.length+'</strong></div><div class="dialog-row"><span>Мест в транспорте</span><strong>'+vehicles.length*12+'</strong></div><div class="dialog-row"><span>Время до конца линии<small>При обычной погоде, без износа</small></span><strong>~'+Math.ceil(G.routeLength(r)/.9)*5+' мин</strong></div></div><p>Машины ходят в обе стороны. Пассажиры выбирают линию, на которой есть нужная им остановка.</p><div class="dialog-actions">'+(free.length?'<button class="primary" data-add-vehicle="'+id+'">＋ Машину из резерва</button>':'<button class="primary" data-action="fleet">Купить транспорт</button>')+'<button class="secondary danger" data-close-route="'+id+'">Закрыть маршрут</button></div>');
  }
  function renderStop(){
    if(selectedStop===null)return;
    const stop=G.STOPS[selectedStop],lines=state.routes.filter(r=>r.stops.includes(selectedStop));
    $('stop-card').hidden=false;$('stop-card').innerHTML='<button class="close-stop" data-action="close-stop" aria-label="Закрыть">×</button><span class="eyebrow">ОСТАНОВКА</span><h3>'+escape(stop.name)+'</h3><p>'+stop.type+'<br><b>'+state.queues[selectedStop].length+' пассажиров</b> ждут транспорт</p><div class="stop-lines">'+(lines.length?lines.map(r=>'<span class="stop-chip" style="color:'+r.color+'">№ '+r.id+'</span>').join(''):'<span class="stop-chip">Нет маршрутов</span>')+'</div><button class="secondary" data-action="from-stop">Начать маршрут отсюда ↗</button>';
  }
  function startBuild(from){
    if(state.ended){toast('Игра завершена. Начните заново.');return;}
    if(state.routes.length>=6){toast('Доступно до 6 линий. Добавляйте машины на существующие маршруты.');return;}
    building=true;draft=typeof from==='number'?[from]:[];selectedStop=null;$('stop-card').hidden=true;$('build-bar').hidden=false;canvas.classList.add('building');updateBuild();renderUI();
  }
  function updateBuild(){
    $('build-title').textContent='Маршрут №'+state.nextRoute+' · '+draft.length+' остановки';
    const free=state.vehicles.some(v=>v.route===null),price=G.cost(draft)+(free?0:18000);
    $('build-description').textContent=draft.length<2?'Выберите '+(draft.length?'ещё одну остановку':'остановки на карте')+' · Esc — отмена':draft.map(i=>G.STOPS[i].name).join(' → ');
    $('confirm-route').textContent='Открыть · '+rub(price);$('confirm-route').disabled=draft.length<2;
    $('undo-stop').disabled=!draft.length;
  }
  function endBuild(){building=false;draft=[];$('build-bar').hidden=true;canvas.classList.remove('building');renderUI();}
  $('new-route').onclick=()=>startBuild();$('cancel-route').onclick=endBuild;$('undo-stop').onclick=()=>{draft.pop();updateBuild();};
  $('confirm-route').onclick=()=>{if(apply(G.build(state,draft),'Маршрут открыт. Машина выходит на линию!')){endBuild();drainNotifications();}};
  $('pause').onclick=()=>{paused=!paused;acc=0;renderUI();};
  document.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{speed=+b.dataset.speed;paused=false;renderUI();});
  document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>{const p=b.dataset.panel;if(p==='map'){if($('modal').open)closeModal();return;}if(p==='fleet')fleet();if(p==='finance')finance();if(p==='journal')journal();});
  $('help').onclick=()=>help(false);
  $('settings').onclick=()=>showModal(modalTop('НОВОЕ НАЧАЛО','Начать заново?')+'<p>Текущий город будет заменён новой игрой. Снова две маршрутки, 85 000 ₽ и чистая история.</p><div class="dialog-actions"><button class="primary" data-action="restart">Начать новую игру</button><button class="secondary" data-action="close">Продолжить текущую</button></div>');
  $('layers').onclick=()=>{heat=!heat;$('layers').classList.toggle('active',heat);$('layers').setAttribute('aria-pressed',String(heat));renderUI();};
  $('zoom-in').onclick=()=>{zoom=Math.min(2.2,zoom*1.18);};$('zoom-out').onclick=()=>{zoom=Math.max(.65,zoom/1.18);};$('recenter').onclick=()=>{zoom=1;pan={x:0,y:0};};
  document.addEventListener('keydown',e=>{if($('modal').open||/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();paused=!paused;acc=0;renderUI();}if(e.key==='Escape'){if(building)endBuild();selectedStop=null;$('stop-card').hidden=true;}});
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.route){routeDetails(+b.dataset.route);return;}
    if(b.dataset.choice){if(apply(G.choice(state,b.dataset.choice),'Решение принято. Оно останется в истории города.'))journal();return;}
    if(b.dataset.repair){if(apply(G.repair(state,+b.dataset.repair),'Машина отремонтирована.'))fleet();return;}
    if(b.dataset.fare){state.fare=Math.max(15,Math.min(65,state.fare+(+b.dataset.fare)));save();finance();return;}
    if(b.dataset.addVehicle){const v=state.vehicles.find(v=>v.route===null);if(v){apply(G.assign(state,v.id,+b.dataset.addVehicle),'Машина назначена на линию.');routeDetails(+b.dataset.addVehicle);}return;}
    if(b.dataset.closeRoute){const id=+b.dataset.closeRoute;showModal(modalTop('УПРАВЛЕНИЕ ЛИНИЕЙ','Закрыть маршрут №'+id+'?')+'<p>Машины вернутся в резерв, пассажиры — на ближайшую остановку маршрута. Доверие мэра снизится на 3. Затраты на открытие не возвращаются.</p><div class="dialog-actions"><button class="secondary danger" data-confirm-close="'+id+'">Закрыть линию</button><button class="primary" data-action="close">Оставить</button></div>');return;}
    if(b.dataset.confirmClose){if(apply(G.closeRoute(state,+b.dataset.confirmClose),'Маршрут закрыт, машины в резерве.'))closeModal();return;}
    const a=b.dataset.action;if(!a)return;
    if(a==='close')closeModal();
    if(a==='start'){state.introSeen=true;save();closeModal();}
    if(a==='fleet')fleet();
    if(a==='buy'){if(apply(G.buy(state),'Маршрутка куплена. Выберите для неё линию.'))fleet();}
    if(a==='loan'){if(apply(G.takeLoan(state),'Кредит зачислен в бюджет.'))finance();}
    if(a==='repay'){if(apply(G.repay(state),'Кредит погашен.'))finance();}
    if(a==='close-stop'){selectedStop=null;$('stop-card').hidden=true;}
    if(a==='from-stop')startBuild(selectedStop);
    if(a==='restart'){state=G.create();endBuild();selectedStop=null;$('stop-card').hidden=true;paused=false;acc=0;zoom=1;pan={x:0,y:0};endedShown=false;wonShown=false;Object.keys(visualPositions).forEach(k=>delete visualPositions[k]);state.introSeen=true;save();closeModal();renderUI();toast('Верхнереченск снова ждёт ваших решений.');}
  });
  document.addEventListener('change',e=>{if(e.target.dataset.vehicle){apply(G.assign(state,+e.target.dataset.vehicle,e.target.value===''?null:+e.target.value),'Назначение сохранено.');}});
  function drainNotifications(){if(state.notifications.length){toast(state.notifications.shift());save();}}
  // Isometric map. Every route uses the same orthogonal street graph as its vehicles.
  function project(x,y,z){return {x:width/2+(x-y)*unit+pan.x,y:height*.49+(x+y-11)*unit*.5-(z||0)*unit+pan.y};}
  function polygon(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>{if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.6;ctx.stroke();}}
  function tile(x,y,w,d,color,z){polygon([project(x,y,z),project(x+w,y,z),project(x+w,y+d,z),project(x,y+d,z)],color);}
  function box(x,y,w,d,h,colors,z){
    const b=z||0;
    polygon([project(x,y+d,b),project(x+w,y+d,b),project(x+w,y+d,b+h),project(x,y+d,b+h)],colors[1]);
    polygon([project(x+w,y,b),project(x+w,y+d,b),project(x+w,y+d,b+h),project(x+w,y,b+h)],colors[2]);
    tile(x,y,w,d,colors[0],b+h);
  }
  function lineWorld(points,color,lineWidth,dash){ctx.beginPath();points.forEach((p,i)=>{const q=project(p.x,p.y,p.z||0);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash(dash||[]);ctx.stroke();ctx.setLineDash([]);}
  function pathBetween(a,b){return [{x:a.x,y:a.y},{x:b.x,y:a.y},{x:b.x,y:b.y}];}
  function routePath(ids){let points=[];for(let i=1;i<ids.length;i++)points=points.concat(pathBetween(G.STOPS[ids[i-1]],G.STOPS[ids[i]]));return points;}
  let buildings=[],trees=[];
  function rng(n){let seed=n;return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
  function makeCity(){
    const r=rng(297);const shades=[['#e8e4d0','#c5cbb7','#a7b5a0'],['#ede7d5','#d6cdb8','#b6bca7'],['#dce5d2','#bccdb5','#9fb69e'],['#dedbd0','#c2c2b2','#a3afa0']];
    for(let x=0;x<12;x++)for(let y=0;y<12;y++){
      if([1,4,7,10].includes(x)||[1,4,7,10].includes(y)||x===8)continue;
      if(x>=9&&y>=8){if(r()>.25)trees.push({x:x+.2+r()*.5,y:y+.2+r()*.5,h:.45+r()*.5});continue;}
      if(r()<.18){trees.push({x:x+.4,y:y+.4,h:.4+r()*.6});continue;}
      const h=.45+r()*1.5;buildings.push({x:x-.33+r()*.1,y:y-.32+r()*.1,w:.55+r()*.23,d:.5+r()*.25,h:h,colors:shades[Math.floor(r()*shades.length)],special:x===6&&y===3?'hospital':x===3&&y===3?'market':x===0&&y===9?'station':x===6&&y===0?'university':null});
    }
    for(let i=0;i<20;i++){const x=r()*11.5,y=r()*11.5;if([1,4,7,10].every(n=>Math.abs(x-n)>.6&&Math.abs(y-n)>.6)&&!(x>7.7&&x<9.2))trees.push({x:x,y:y,h:.35+r()*.55});}
    buildings.sort((a,b)=>(a.x+a.y)-(b.x+b.y));
  }
  makeCity();
  function drawTree(t){const p=project(t.x,t.y);ctx.fillStyle='#a1b58c45';ctx.beginPath();ctx.ellipse(p.x+unit*.15,p.y+unit*.08,unit*.25,unit*.12,0,0,Math.PI*2);ctx.fill();box(t.x-.025,t.y-.025,.05,.05,t.h*.55,['#8b9373','#969875','#7f8a66']);const top=project(t.x,t.y,t.h),left=project(t.x-.24,t.y,t.h*.35),right=project(t.x+.24,t.y,t.h*.35),front=project(t.x,t.y+.25,t.h*.35),back=project(t.x,t.y-.24,t.h*.35);polygon([top,left,front],'#95b57b');polygon([top,front,right],'#739b62');polygon([top,right,back],'#86aa70');}
  function drawBuilding(b){
    const h=b.h+(state.population>5500&&b.x<6?.2:0);
    tile(b.x+.15,b.y+.15,b.w+.25,b.d+.22,'#899c7720');
    if(b.special==='market'){
      box(b.x,b.y,b.w,b.d,.3,['#d9c7a9','#c6b99e','#a6ab91']);
      for(let j=0;j<4;j++)tile(b.x+j*b.w/4,b.y,b.w/4,b.d,j%2?'#e4c3a0':'#a8b88b',.4);
      return;
    }
    box(b.x,b.y,b.w,b.d,h,b.colors);
    const floors=Math.floor(h/.35);
    for(let floor=0;floor<floors;floor++){
      const z=.18+floor*.34;
      for(let col=0;col<2;col++){
        const x=b.x+.09+col*b.w*.45;
        polygon([project(x,b.y+b.d+.002,z),project(x+.12,b.y+b.d+.002,z),project(x+.12,b.y+b.d+.002,z+.14),project(x,b.y+b.d+.002,z+.14)],'#9aa99a');
        const y=b.y+.1+col*b.d*.44;
        polygon([project(b.x+b.w+.002,y,z),project(b.x+b.w+.002,y+.1,z),project(b.x+b.w+.002,y+.1,z+.14),project(b.x+b.w+.002,y,z+.14)],'#849a8d');
      }
    }
    if(b.special==='hospital'){
      tile(b.x+b.w*.4,b.y+.08,.14,b.d-.16,'#db9276',h+.01);tile(b.x+.08,b.y+b.d*.4,b.w-.16,.14,'#db9276',h+.012);
    }else if(b.special==='station')box(b.x+.12,b.y+.1,b.w-.24,b.d-.2,.18,['#9aa991','#a1b098','#839e8c'],h);
    else if(b.special==='university')box(b.x+.2,b.y+.15,.2,.2,.2,['#e6dfc9','#b6c0a8','#a2b39b'],h);
    else if(h>1.3)box(b.x+.12,b.y+.12,.17,.17,.12,['#d0d4c2','#b8c2ab','#9dad97'],h);
  }
  function rounded(x,y,w,h,r,color){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.fillStyle=color;ctx.fill();}
  function label(text,x,y,color,fill,size){ctx.font='600 '+(size||9)+'px Manrope, sans-serif';const w=ctx.measureText(text).width+14;rounded(x-w/2,y-10,w,18,5,fill||'#f8faf0ed');ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color||'#6f8164';ctx.fillText(text,x,y-1);}
  function drawStops(){
    G.STOPS.forEach((s,i)=>{
      const p=project(s.x,s.y,.05),q=state.queues[i].length;
      const line=state.routes.find(r=>r.stops.includes(i));const chosen=draft.includes(i),active=chosen||i===selectedStop;
      if(heat){const radius=Math.max(14,q*1.1)*Math.min(1.5,zoom);const grad=ctx.createRadialGradient(p.x,p.y,2,p.x,p.y,radius);grad.addColorStop(0,q>15?'#df9b5688':'#86b97766');grad.addColorStop(1,'#df9b5600');ctx.fillStyle=grad;ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill();}
      if(building&&!chosen){ctx.strokeStyle='#a0b38a80';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,12+Math.sin(renderClock*2+i)*2,0,Math.PI*2);ctx.stroke();}
      ctx.shadowColor='#29463320';ctx.shadowBlur=6;ctx.shadowOffsetY=2;ctx.beginPath();ctx.arc(p.x,p.y,active?7:5,0,Math.PI*2);ctx.fillStyle='#fffef4';ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle=chosen?G.COLORS[(state.nextRoute-1)%6]:line?line.color:'#a7b496';ctx.lineWidth=2.3;ctx.stroke();
      if(chosen){ctx.fillStyle=G.COLORS[(state.nextRoute-1)%6];ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();}
      const small=width<520;const text=(heat?q+' · ':'')+s.name;
      label(text,p.x,p.y-18,active?'#28694d':line?'#60795d':'#8c9b7d',active?'#f9ffed':'#f6f9eeeb',small?8:9);
      if(q>0&&!heat){ctx.fillStyle=q>18?'#d89b6c':'#a4b28b';const dots=Math.min(5,Math.ceil(q/5));for(let j=0;j<dots;j++){ctx.beginPath();ctx.arc(p.x-((dots-1)*4)/2+j*4,p.y+11,1.4,0,Math.PI*2);ctx.fill();}}
    });
  }
  const visualPositions={};
  function vehiclePosition(v){
    const r=state.routes.find(r=>r.id===v.route);if(!r)return null;
    let dir=v.direction;if(v.leg===r.stops.length-1)dir=-1;if(v.leg===0)dir=1;
    const a=G.STOPS[r.stops[dir===1?v.leg:v.leg-1]],b=G.STOPS[r.stops[dir===1?v.leg+1:v.leg]],dx=b.x-a.x,dy=b.y-a.y,total=Math.abs(dx)+Math.abs(dy),distance=(dir===1?v.progress:1-v.progress)*total;
    let x=a.x,y=a.y,angle=0;
    if(distance<Math.abs(dx)){x+=Math.sign(dx)*distance;angle=dx>=0?0:Math.PI;}
    else{x=b.x;y+=Math.sign(dy)*(distance-Math.abs(dx));angle=dy>=0?Math.PI/2:-Math.PI/2;}
    return {x:x,y:y,color:r.color,angle:angle};
  }
  function drawVehicles(dt){
    state.vehicles.forEach(v=>{
      const pos=vehiclePosition(v);if(!pos){delete visualPositions[v.id];return;}
      let visual=visualPositions[v.id];
      if(!visual||visual.route!==v.route){visual={x:pos.x,y:pos.y,route:v.route};visualPositions[v.id]=visual;}
      const follow=1-Math.exp(-dt*10);visual.x+=(pos.x-visual.x)*follow;visual.y+=(pos.y-visual.y)*follow;
      const x=visual.x,y=visual.y,w=pos.angle===0||pos.angle===Math.PI?.36:.18,d=w===.36?.18:.36;
      tile(x-w/2+.09,y-d/2+.09,w,d,'#305b3933',.02);
      box(x-w/2,y-d/2,w,d,.16,['#fff5d6',pos.color,pos.color],.08);
      tile(x-w*.25,y-d*.2,w*.5,d*.4,'#9fbdaf',.245);
      const p=project(x,y,.44);if(zoom>1.4){ctx.fillStyle='#45684d';ctx.font='7px sans-serif';ctx.textAlign='center';ctx.fillText(v.passengers.length+'/12',p.x,p.y);}
    });
  }
  function draw(dt){
    unit=Math.min(width/25,height/16.5)*zoom;
    ctx.clearRect(0,0,width,height);ctx.fillStyle='#e9eee0';ctx.fillRect(0,0,width,height);
    const glow=ctx.createRadialGradient(width*.5,height*.45,10,width*.5,height*.5,width*.7);glow.addColorStop(0,'#f5f6e9');glow.addColorStop(1,'#e5ecda');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    // The city sits on a softly raised island.
    polygon([project(-.65,11.65),project(11.65,11.65),project(11.65,11.65,-.2),project(-.65,11.65,-.2)],'#d2ddc5');
    polygon([project(11.65,-.65),project(11.65,11.65),project(11.65,11.65,-.2),project(11.65,-.65,-.2)],'#c7d5bb');
    tile(-.65,-.65,12.3,12.3,'#dfe8ce');
    // Small plots and courtyards.
    for(let x=0;x<12;x++)for(let y=0;y<12;y++){if(x!==8&&![1,4,7,10].includes(x)&&![1,4,7,10].includes(y))tile(x-.45,y-.45,.9,.9,(x+y)%3===0?'#d5e1c4':'#e3e9d4');}
    tile(8.05,-.65,1,12.3,'#a5c8bd');tile(8.05,-.65,.08,12.3,'#c0d5bb');tile(9,-.65,.08,12.3,'#c0d5bb');
    for(let i=0;i<17;i++){const y=-.3+i*.72+Math.sin(renderClock*.4+i)*.08;lineWorld([{x:8.3,y:y},{x:8.7,y:y}],i%2?'#b4d2c6':'#94beb3',.7);}
    const roads=[1,4,7,10];
    roads.forEach(n=>{tile(n-.18,-.65,.36,12.3,'#c7d0bc');tile(n-.12,-.65,.24,12.3,'#eaf0de');tile(-.65,n-.18,12.3,.36,'#c7d0bc');tile(-.65,n-.12,12.3,.24,'#eaf0de');});
    roads.forEach(n=>{box(8,n-.24,1.1,.48,.05,['#e7e8d5','#c0cbb4','#aabca6']);lineWorld([{x:8.05,y:n-.23,z:.1},{x:9.05,y:n-.23,z:.1}],'#a9bba1',1);lineWorld([{x:8.05,y:n+.23,z:.1},{x:9.05,y:n+.23,z:.1}],'#a9bba1',1);});
    const riverText=project(8.55,8.8);ctx.save();ctx.translate(riverText.x,riverText.y);ctx.rotate(Math.PI/6);ctx.font='italic 9px Georgia, serif';ctx.textAlign='center';ctx.fillStyle='#729e91';ctx.fillText('р. Тихая',0,0);ctx.restore();
    // Station square and park paths.
    tile(.1,8.8,.5,1.5,'#d2d9c4');tile(9.4,8,1.6,.11,'#d2dabc');tile(10.8,8,0.1,3,'#d2dabc');
    state.routes.forEach(r=>{const points=routePath(r.stops);lineWorld(points,'#ffffffa0',6*zoom);lineWorld(points,r.color,3.1*zoom);});
    if(draft.length>1){lineWorld(routePath(draft),'#ffffffb0',7*zoom);lineWorld(routePath(draft),G.COLORS[(state.nextRoute-1)%6],3.5*zoom,[5,4]);}
    // Sort scenery by depth so farther houses stay behind nearer ones.
    const scenery=buildings.map(b=>({depth:b.x+b.y,building:b})).concat(trees.map(t=>({depth:t.x+t.y,tree:t}))).sort((a,b)=>a.depth-b.depth);
    scenery.forEach(o=>{if(o.building)drawBuilding(o.building);else drawTree(o.tree);});
    drawVehicles(dt);drawStops();
    const hour=(8+Math.floor(state.tick/12))%24;
    if(hour>=20||hour<6){ctx.fillStyle='#203a5524';ctx.fillRect(0,0,width,height);}
    if(state.event&&state.event.kind==='snow'){ctx.fillStyle='#ffffffaf';for(let i=0;i<65;i++){const x=(i*97+renderClock*8)%width,y=(i*53+renderClock*24)%height;ctx.beginPath();ctx.arc(x,y,1.1,0,Math.PI*2);ctx.fill();}}
  }
  function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
  new ResizeObserver(resize).observe(canvas);
  function hitStop(x,y){let best=null,dist=Infinity;G.STOPS.forEach((s,i)=>{const p=project(s.x,s.y,.05);const d=Math.hypot(x-p.x,y-p.y);const labelHit=Math.abs(x-p.x)<42&&Math.abs(y-(p.y-18))<10;if((d<22||labelHit)&&d<dist){best=i;dist=d;}});return best;}
  const pointers=new Map();let gesture=null;
  canvas.addEventListener('pointerdown',e=>{
    canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===1)gesture={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y,moved:false,multi:false};
    if(pointers.size===2){const a=Array.from(pointers.values());gesture.multi=true;gesture.distance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);gesture.zoom=zoom;}
  });
  canvas.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId)||!gesture)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){const a=Array.from(pointers.values());zoom=Math.max(.65,Math.min(2.2,gesture.zoom*Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)/Math.max(1,gesture.distance)));gesture.moved=true;return;}
    if(gesture.multi)return;
    const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
    if(Math.hypot(dx,dy)>5)gesture.moved=true;
    if(gesture.moved){pan.x=Math.max(-width,Math.min(width,gesture.px+dx));pan.y=Math.max(-height,Math.min(height,gesture.py+dy));}
  });
  function pointerEnd(e,cancelled){
    pointers.delete(e.pointerId);if(!gesture)return;
    if(!cancelled&&!gesture.moved&&!gesture.multi){const r=canvas.getBoundingClientRect(),id=hitStop(e.clientX-r.left,e.clientY-r.top);if(id!==null){if(building){if(draft[draft.length-1]===id)draft.pop();else if(draft.includes(id))toast('Эта остановка уже есть в маршруте.');else draft.push(id);updateBuild();}else{selectedStop=id;renderStop();}}else{selectedStop=null;$('stop-card').hidden=true;}}
    if(!pointers.size)gesture=null;
  }
  canvas.addEventListener('pointerup',e=>pointerEnd(e,false));canvas.addEventListener('pointercancel',e=>pointerEnd(e,true));
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.65,Math.min(2.2,zoom*(e.deltaY<0?1.1:.9)));},{passive:false});
  document.addEventListener('visibilitychange',()=>{last=0;acc=0;if(document.hidden)save();});window.addEventListener('pagehide',save);
  let endedShown=false,wonShown=state.won;
  function frame(time){
    const dt=last?Math.min((time-last)/1000,.12):0;last=time;renderClock+=dt;
    if(!paused&&!building&&!$('modal').open&&!document.hidden&&!state.ended){
      acc+=dt*speed;let changed=false;
      while(acc>=.9){G.tick(state);acc-=.9;changed=true;}
      if(changed){renderUI();drainNotifications();}
    }
    saveElapsed+=dt;if(saveElapsed>=10){save();saveElapsed=0;}
    if(state.ended&&!endedShown&&!$('modal').open){endedShown=true;showModal(modalTop('КОНЕЦ СМЕНЫ','Город ждёт перемен')+'<p>Бюджет и доверие исчерпаны. Вы доставили '+fmt(state.served)+' пассажиров. Следующая попытка может изменить судьбу города.</p><div class="dialog-actions"><button class="primary" data-action="restart">Начать заново</button><button class="secondary" data-action="close">Посмотреть город</button></div>');}
    if(state.won&&!wonShown&&!$('modal').open){wonShown=true;showModal(modalTop('ПЕРВАЯ ГЛАВА ПРОЙДЕНА','Город в надёжных руках')+'<div class="intro-mark">↗</div><p>Больница связана с городом, доставлено '+fmt(state.served)+' пассажиров, население выросло до '+fmt(state.population)+'.</p><p>'+(state.choice==='deal'?'Вы выбрали инвестиции. Город растёт при поддержке Грача, а обязательства останутся частью вашей истории.':'Вы сохранили независимость. Горожане знают, что их транспорт принадлежит городу.')+'</p><p>Это финал первой главы прототипа. Можно продолжить развивать сеть в свободном режиме.</p><div class="dialog-actions"><button class="primary" data-action="close">Продолжить играть</button></div>');}
    draw(dt);requestAnimationFrame(frame);
  }
  renderUI();resize();requestAnimationFrame(frame);
  if(!state.introSeen)help(true);
  if(!window.CITY_ROUTE_PORTABLE&&'serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
