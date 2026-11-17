import { t, number } from '../core/i18n';
import { MAP_LAYERS, type Layer } from '../core/layers';
import type { Settings } from '../core/settings';
import { E } from '../sim/config';
import { constructionCost } from '../sim/commands';
import { cityReport } from './city';
import { demandReport } from './demand';
import { canPlanGoal, goalBoard, goalDetail, goalTitle, updateGoalBoard } from './goals';
import type { Engagement } from '../core/engagement';
import { routesPanel, fleetPanel, financePanel } from './panels';
import type { Command, Mode, World } from '../sim/types';
export class GameUI {
  onCommand: (cmd: Command) => void = () => {};
  onBuild: () => void = () => {};
  onSuggest: (stops: number[]) => void = () => {};
  onEdit: (id:number) => void = () => {};
  onDraft: (action:string,index?:number) => void = () => {};
  onCancel: () => void = () => {};
  onConfirm: () => void = () => {};
  onSpeed: (speed: number) => void = () => {};
  onReset: () => void = () => {};
  onSettings: (settings: Settings) => void = () => {};
  onRotate: (delta: number) => void = () => {};
  private settings: Settings = { version: 1, quality: 'medium', time: 'auto', sound: false };
  onZoom: (factor: number) => void = () => {};
  onRecenter: () => void = () => {};
  onLayer: (layer: Layer, enabled: boolean) => void = () => {};
  onModal: (open: boolean) => void = () => {};
  private modal: HTMLDialogElement;
  private world!: World;
  private tab='';
  private panelSignature='';
  private draftSignature='';
  private toastTimer=0;
  private celebrationTimer=0;
  mode: Mode='marshrutka';
  readonly mapHost: HTMLElement;
  constructor(host: HTMLElement) {
    host.innerHTML=`<div id="map"></div><header><div class="city-name"><b>${t('city')}</b><small id="date"></small></div><div class="header-actions"><button id="settings" aria-label="${t('settings')}">⚙</button><button id="help" aria-label="${t('help')}">?</button></div></header>
      <section class="stats">${['budget','population','satisfaction','trust','ecology'].map(key=>`<article><small>${t(key)}</small><strong id="${key}"></strong></article>`).join('')}</section>
      <div class="map-tools"><div class="layer-buttons" role="group" aria-label="${t('layers')}">${MAP_LAYERS.map(layer=>`<button id="layer-${layer.id}" data-layer="${layer.id}" aria-pressed="false" aria-controls="map" style="--layer-color:${layer.color}">${t(layer.id)}</button>`).join('')}</div><button id="debug-toggle" aria-label="${t('debug')}">FPS</button><div id="layer-legend" hidden>${MAP_LAYERS.map(layer=>`<span data-legend="${layer.id}" style="--layer-color:${layer.color}" hidden>${t(layer.legend,{minutes:E.minutesPerTick})}</span>`).join('')}</div><button id="event-banner"></button><div id="crisis" hidden></div></div>
      <div class="zoom"><div class="rotate-tools"><button id="rotate-left" aria-label="${t('rotateLeft')}">↶</button><button id="rotate-right" aria-label="${t('rotateRight')}">↷</button></div><button id="zoom-in" aria-label="${t('zoomIn')}">+</button><button id="zoom-out" aria-label="${t('zoomOut')}">−</button><button id="recenter" aria-label="${t('recenter')}">⌖</button></div><output id="debug" hidden></output>
      <output id="engagement-debug" hidden></output>
      ${goalBoard()}
      <output id="goal-celebration" role="status" hidden></output>
      <div class="map-bottom"><button id="growth" aria-label="${t('cityReport')}"></button><div class="speed">${[0,1,2,4].map(n=>`<button data-speed="${n}" class="${n===1?'active':''}" aria-label="${n===0?t('pause'):t('speed')+' '+n}">${n===0?'Ⅱ':n+'×'}</button>`).join('')}</div></div>
      <aside hidden><div class="panel-top"><b id="panel-title"></b><button id="panel-close" aria-label="${t('close')}">×</button></div><div id="panel"></div></aside>
      <div id="build-bar" hidden><b id="build-hint"></b><small>${t('draftHint')}</small><div id="selection"></div><div class="draft-tools"><select id="draft-end"><option value="end">${t('appendEnd')}</option><option value="start">${t('appendStart')}</option></select><button id="undo">↶</button><button id="clear-draft">${t('clearDraft')}</button></div><div class="build-actions"><button id="cancel">${t('cancel')}</button><button id="confirm" class="primary"></button></div></div>
      <nav>${['map','routes','fleet','finance'].map(key=>`<button data-tab="${key}" class="${key==='map'?'active':''}">${t(key)}</button>`).join('')}</nav>
      <dialog id="modal"><div id="dialog-body"></div><button id="close">${t('close')}</button></dialog><div id="toast" role="status"></div>`;
    this.mapHost=document.querySelector('#map')!;this.modal=document.querySelector('#modal')!;
    const buildBar=document.getElementById('build-bar')!;
    new ResizeObserver(()=>host.style.setProperty('--build-height',`${buildBar.offsetHeight}px`)).observe(buildBar);
    const board=document.getElementById('goal-board')!;
    new ResizeObserver(()=>host.style.setProperty('--goals-height',`${board.offsetHeight}px`)).observe(board);
    const click=(id:string,fn:()=>void)=>{document.getElementById(id)!.onclick=fn;};
    click('settings',()=>this.showSettings());
    click('growth',()=>this.showDialog(cityReport(this.world)));
    document.getElementById('demand-details')!.setAttribute('aria-label',t('demandTitle'));
    click('demand-details',()=>this.showDialog(goalDetail(this.world,this.world.goals.active[0])+demandReport(this.world)));
    click('demand-suggest',()=>{const goal=this.world.goals.active[0];if(goal.kind==='connect'&&canPlanGoal(this.world))this.onSuggest([goal.from,goal.to]);else this.openPanel('routes');});
    for(const slot of ['medium','long'])click('goal-open-'+slot,()=>{
      const goal=this.world.goals.active.find(g=>g.slot===slot)!;
      this.showDialog(goalDetail(this.world,goal)+`<button id="goal-routes" class="primary">${t('goalManage')}</button>`);
      click('goal-routes',()=>{this.modal.close();this.openPanel('routes');});
    });
    click('rotate-left',()=>this.onRotate(-Math.PI/6));click('rotate-right',()=>this.onRotate(Math.PI/6));
    this.modal.addEventListener('change',e=>{
      const target=e.target as HTMLElement;if(!target.closest('#settings-form'))return;
      this.settings={version:1,quality:document.querySelector<HTMLSelectElement>('#quality')!.value as Settings['quality'],time:document.querySelector<HTMLSelectElement>('#time-of-day')!.value as Settings['time'],sound:document.querySelector<HTMLInputElement>('#sound')!.checked};
      this.onSettings({...this.settings});
    });
    click('help',()=>this.showDialog(`<h2>${t('help')}</h2><p>${t('helpText')}</p><button id="reset">${t('reset')}</button>`));
    this.modal.addEventListener('click',e=>{if((e.target as HTMLElement).id==='reset'){
      this.showDialog(`<h2>${t('resetTitle')}</h2><p>${t('resetText')}</p><button id="reset-confirm" class="primary">${t('resetConfirm')}</button>`);
      click('reset-confirm',()=>{this.onReset();this.modal.close();});
    }});
    click('close',()=>this.modal.close());this.modal.addEventListener('close',()=>this.onModal(false));
    click('panel-close',()=>this.openPanel('map'));
    click('cancel',()=>this.onCancel());click('confirm',()=>this.onConfirm());
    click('undo',()=>this.onDraft('undo'));click('clear-draft',()=>this.onDraft('clear'));
    document.getElementById('undo')!.setAttribute('aria-label',t('undo'));
    document.getElementById('draft-end')!.onchange=e=>this.onDraft((e.target as HTMLSelectElement).value);
    document.getElementById('selection')!.onclick=e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-index]');if(b)this.onDraft('remove',Number(b.dataset.index));};
    click('zoom-in',()=>this.onZoom(1.2));click('zoom-out',()=>this.onZoom(1/1.2));click('recenter',()=>this.onRecenter());
    click('debug-toggle',()=>{const hidden=!document.getElementById('debug')!.hidden;document.getElementById('debug')!.hidden=hidden;document.getElementById('engagement-debug')!.hidden=hidden;});
    click('event-banner',()=>{const id=this.world.event?.id??this.world.nextEvent.id;this.showDialog(`<h2>${t(id)}</h2><p>${t(id+'Text')}</p>`);});
    for(const layer of MAP_LAYERS)click('layer-'+layer.id,()=>{
      const button=document.getElementById('layer-'+layer.id)!;
      const enabled=button.getAttribute('aria-pressed')!=='true';
      button.setAttribute('aria-pressed',String(enabled));this.onLayer(layer.id,enabled);
      document.querySelector<HTMLElement>(`[data-legend="${layer.id}"]`)!.hidden=!enabled;
      document.getElementById('layer-legend')!.hidden=!document.querySelector('.layer-buttons [aria-pressed="true"]');
    });
    document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.onclick=()=>this.openPanel(b.dataset.tab!));
    document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(button=>button.onclick=()=>{this.onSpeed(Number(button.dataset.speed));document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',b===button));});
    const panel=document.getElementById('panel')!;
    panel.onchange=e=>{if((e.target as HTMLElement).id==='route-mode')this.mode=(e.target as HTMLSelectElement).value as Mode;};
    panel.onsubmit=e=>{e.preventDefault();this.onCommand({type:'setFare',fare:Number(document.querySelector<HTMLInputElement>('#fare-input')!.value)});};
    panel.onclick=e=>{
      const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b)return;
      if(b.dataset.action==='build')this.onBuild();
      if(b.dataset.buy)this.onCommand({type:'buyVehicle',mode:b.dataset.buy as Mode});
      if(b.dataset.service)this.onCommand({type:'serviceFleet',mode:b.dataset.service as Mode});
      if(b.dataset.action==='loan')this.onCommand({type:'takeLoan'});
      if(b.dataset.action==='repay')this.onCommand({type:'repayLoan'});
      if(b.dataset.assign)this.onCommand({type:'assignVehicle',routeId:Number(b.dataset.assign)});
      if(b.dataset.release)this.onCommand({type:'releaseVehicle',routeId:Number(b.dataset.release)});
      if(b.dataset.edit||b.dataset.extend)this.onEdit(Number(b.dataset.edit??b.dataset.extend));
      if(b.dataset.remove){const id=Number(b.dataset.remove);this.showDialog(`<h2>${t('removeTitle',{id})}</h2><p>${t('removeText')}</p><button id="remove-confirm" class="primary">${t('removeConfirm')}</button>`);click('remove-confirm',()=>{this.onCommand({type:'removeRoute',routeId:id});this.modal.close();});}
    };
  }
  setSettings(settings: Settings){
    this.settings={...settings};
    const quality=document.querySelector<HTMLSelectElement>('#quality'),time=document.querySelector<HTMLSelectElement>('#time-of-day'),sound=document.querySelector<HTMLInputElement>('#sound');
    if(quality)quality.value=settings.quality;if(time)time.value=settings.time;if(sound)sound.checked=settings.sound;
  }
  private showSettings(){
    this.showDialog(`<h2>${t('settings')}</h2><div id="settings-form"><label>${t('quality')}<select id="quality">${['low','medium','high'].map(key=>`<option value="${key}">${t('quality'+key[0].toUpperCase()+key.slice(1))}</option>`).join('')}</select></label><p>${t('qualityHint')}</p><label>${t('timeOfDay')}<select id="time-of-day">${['auto','day','night'].map(key=>`<option value="${key}">${t('time'+key[0].toUpperCase()+key.slice(1))}</option>`).join('')}</select></label><label class="sound-setting"><input id="sound" type="checkbox">${t('sound')}</label><p>${t('soundHint')}</p><p>${t('cameraHint')}</p></div>`);
    this.setSettings(this.settings);
  }
  openPanel(tab:string){
    document.getElementById('app')!.classList.toggle('panel-open',tab!=='map');
    this.tab=tab==='map'?'':tab;document.querySelector('aside')!.hidden=!this.tab;
    document.getElementById('panel-title')!.textContent=this.tab?t(this.tab):'';
    document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===(this.tab||'map')));
    this.panelSignature='';if(this.world)this.update(this.world);
  }
  private showDialog(html:string){document.getElementById('dialog-body')!.innerHTML=html;this.onModal(true);if(!this.modal.open)this.modal.showModal();}
  toast(key:string,args:Record<string,string|number>={}){const el=document.getElementById('toast')!;el.textContent=t(key,args);el.classList.add('show');clearTimeout(this.toastTimer);this.toastTimer=window.setTimeout(()=>el.classList.remove('show'),4000);}
  update(w:World){
    this.world=w;
    const text=(id:string,value:string)=>{document.getElementById(id)!.textContent=value;};
    text('budget',number(w.money)+' ₽');text('population',number(w.districts.reduce((s,d)=>s+d.population,0)));
    for(const key of ['satisfaction','trust','ecology'] as const)text(key,number(w[key])+'%');
    text('date',t('month',{count:Math.floor(w.minute/(E.minutesPerDay*E.daysPerMonth))+1})+' · '+t('day',{count:Math.floor(w.minute/E.minutesPerDay)%E.daysPerMonth+1}));
    text('growth',t('growth',{count:number(w.lastGrowth)}));
    updateGoalBoard(w);
    text('event-banner',t(w.event?'eventActive':'forecast',{event:t(w.event?.id??w.nextEvent.id),minutes:Math.max(0,(w.event?.until??w.nextEvent.at)-w.minute)}));
    const crisis=document.getElementById('crisis')!;crisis.hidden=!w.gameOver&&w.trust>=E.crisisTrust;crisis.textContent=t(w.gameOver?'gameOver':'crisis');
    if(!this.tab)return;
    const panel=document.getElementById('panel')!;
    if(panel.contains(document.activeElement)&&['INPUT','SELECT'].includes(document.activeElement!.tagName))return;
    const signature=JSON.stringify([this.tab,w.routes,w.fleets,Math.floor(w.money),Math.floor(w.income),Math.floor(w.expenses),Math.floor(w.served),w.fare,w.debt,w.event,w.wear]);
    if(signature===this.panelSignature)return;this.panelSignature=signature;
    panel.innerHTML=this.tab==='routes'?routesPanel(w,this.mode):this.tab==='fleet'?fleetPanel(w):financePanel(w);
  }
  build(draft:number[]|null,routeId?:number){
    document.getElementById('app')!.classList.toggle('editing',draft!==null);
    document.getElementById('build-bar')!.hidden=draft===null;
    if(!draft){this.draftSignature='';return;}
    const signature=JSON.stringify([draft,routeId,this.mode]);if(signature===this.draftSignature)return;this.draftSignature=signature;
    if(draft){
      document.getElementById('build-hint')!.textContent=t(routeId?'editHint':'buildHint');
      document.getElementById('selection')!.innerHTML=draft.map((id,index)=>`<button data-index="${index}" aria-label="${t('draftRemove',{name:t(this.world.districts[id].name)})}">${index+1}. ${t(this.world.districts[id].name)} ×</button>`).join('')||t('selected',{count:0});
      const button=document.querySelector<HTMLButtonElement>('#confirm')!;
      const mode=this.world.routes.find(r=>r.id===routeId)?.mode??this.mode;
      button.textContent=t(routeId?'editConfirm':'confirm',{cost:number(constructionCost(this.world,draft,mode,routeId))});button.disabled=draft.length<2;
      document.getElementById('app')!.style.setProperty('--build-height',`${document.getElementById('build-bar')!.offsetHeight}px`);
    }
  }
  resetDraftEnd(){document.querySelector<HTMLSelectElement>('#draft-end')!.value='end';}
  celebrate(w:World,reward:number){
    const goal=w.goals.lastCompleted;if(!goal)return;
    const el=document.getElementById('goal-celebration')!;
    el.textContent=t('goalCompleted',{title:goalTitle(w,goal),reward:number(reward)});el.hidden=false;
    clearTimeout(this.celebrationTimer);this.celebrationTimer=window.setTimeout(()=>{el.hidden=true;},6000);
  }
  debug(text:string){document.getElementById('debug')!.textContent=text;}
  engagement(metrics: ReturnType<Engagement['snapshot']>){
    document.getElementById('engagement-debug')!.textContent=t('engagementStats',{
      decision:metrics.sinceDecision,reward:metrics.sinceReward,rewards:metrics.rewards,
      goals:metrics.activeGoals,events:metrics.events,rate:metrics.eventsPerHour.toFixed(1),idle:metrics.longestIdle,
    });
  }
}
