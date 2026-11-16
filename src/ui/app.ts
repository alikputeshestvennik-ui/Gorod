import { t, number } from '../core/i18n';
import { E, M } from '../sim/config';
import { reserved, routeCost } from '../sim/commands';
import type { Command, World } from '../sim/types';
export class GameUI {
  onCommand: (cmd: Command) => void = () => {};
  onBuild: () => void = () => {};
  onCancel: () => void = () => {};
  onConfirm: () => void = () => {};
  onSpeed: (speed: number) => void = () => {};
  onReset: () => void = () => {};
  onZoom: (factor: number) => void = () => {};
  onRecenter: () => void = () => {};
  onLayer: (layer: string) => void = () => {};
  onModal: (open: boolean) => void = () => {};
  private modal: HTMLDialogElement;
  private world!: World;
  private tab = 'routes';
  private panelSignature = '';
  private toastTimer = 0;
  readonly mapHost: HTMLElement;
  constructor(host: HTMLElement) {
    host.innerHTML = `<header><a class="brand" href="./"><span class="brand-mark">↗</span><span>${t('title')}</span></a><button id="help" aria-label="${t('help')}">?</button></header>
      <main><div class="heading"><div><small>${t('stage')}</small><h1>${t('city')}<span>↗</span></h1><p>${t('subtitle')}</p></div><span id="date"></span></div>
      <section class="stats">${['budget','population','satisfaction','trust'].map(key=>`<article><small>${t(key)}</small><strong id="${key}"></strong></article>`).join('')}</section>
      <div class="workspace"><section class="map-card"><div id="map"></div><div class="map-tools"><select id="layer" aria-label="${t('demand')}">${['off','demand','load','complaints'].map(key=>`<option value="${key}">${t(key)}</option>`).join('')}</select><button id="debug-toggle" aria-label="${t('debug')}">FPS</button></div><div class="zoom"><button id="zoom-in" aria-label="${t('zoomIn')}">+</button><button id="zoom-out" aria-label="${t('zoomOut')}">−</button><button id="recenter" aria-label="${t('recenter')}">⌖</button></div><output id="debug" hidden></output>
      <div class="map-bottom"><span id="growth"></span><div class="speed">${[0,1,2].map(n=>`<button data-speed="${n}" class="${n===1?'active':''}" aria-label="${n===0?t('pause'):t('speed')+' '+n}">${n===0?'Ⅱ':n+'×'}</button>`).join('')}</div></div>
      <div id="build-bar" hidden><b>${t('buildHint')}</b><span id="selection"></span><div><button id="cancel">${t('cancel')}</button><button id="confirm" class="primary"></button></div></div></section>
      <aside><nav>${['routes','fleet','finance'].map(key=>`<button data-tab="${key}" class="${key==='routes'?'active':''}">${t(key)}</button>`).join('')}</nav><div id="panel"></div><section class="goal"><small>${t('goal')}</small><p id="goal-text"></p></section></aside></div>
      <footer><span>${t('networkOffline')}</span><button id="reset">${t('reset')}</button></footer></main><dialog id="modal"><div id="dialog-body"></div><button id="close">${t('close')}</button></dialog><div id="toast" role="status"></div>`;
    this.mapHost=document.querySelector('#map')!;this.modal=document.querySelector('#modal')!;
    const click=(id:string,fn:()=>void)=>{document.getElementById(id)!.onclick=fn;};
    click('help',()=>this.showDialog(`<h2>${t('help')}</h2><p>${t('helpText')}</p>`));
    click('close',()=>this.modal.close());this.modal.addEventListener('close',()=>this.onModal(false));
    click('reset',()=>{this.showDialog(`<h2>${t('resetTitle')}</h2><p>${t('resetText')}</p><button id="reset-confirm" class="primary">${t('resetConfirm')}</button>`);click('reset-confirm',()=>{this.onReset();this.modal.close();});});
    click('cancel',()=>this.onCancel());click('confirm',()=>this.onConfirm());
    click('zoom-in',()=>this.onZoom(1.2));click('zoom-out',()=>this.onZoom(1/1.2));click('recenter',()=>this.onRecenter());
    click('debug-toggle',()=>{document.getElementById('debug')!.hidden=!document.getElementById('debug')!.hidden;});
    document.querySelector<HTMLSelectElement>('#layer')!.onchange=e=>this.onLayer((e.target as HTMLSelectElement).value);
    document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button=>button.onclick=()=>{this.tab=button.dataset.tab!;this.panelSignature='';this.update(this.world);document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===button));});
    document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(button=>button.onclick=()=>{this.onSpeed(Number(button.dataset.speed));document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',b===button));});
    document.getElementById('panel')!.onclick=e=>{
      const button=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button)return;
      if(button.dataset.action==='build')this.onBuild();
      if(button.dataset.action==='buy')this.onCommand({type:'buyVehicle'});
      if(button.dataset.assign)this.onCommand({type:'assignVehicle',routeId:Number(button.dataset.assign)});
      if(button.dataset.remove)this.onCommand({type:'removeRoute',routeId:Number(button.dataset.remove)});
    };
  }
  private showDialog(html:string){document.getElementById('dialog-body')!.innerHTML=html;this.onModal(true);this.modal.showModal();}
  toast(key:string){const el=document.getElementById('toast')!;el.textContent=t(key);el.classList.add('show');clearTimeout(this.toastTimer);this.toastTimer=window.setTimeout(()=>el.classList.remove('show'),4000);}
  update(w:World){
    this.world=w;
    const text=(id:string,value:string)=>{document.getElementById(id)!.textContent=value;};
    text('budget',number(w.money)+' ₽');text('population',number(w.districts.reduce((s,d)=>s+d.population,0)));
    text('satisfaction',number(w.satisfaction)+'%');text('trust',number(w.trust)+'%');
    text('date',t('month',{count:Math.floor(w.minute/(E.minutesPerDay*E.daysPerMonth))+1})+' · '+t('day',{count:Math.floor(w.minute/E.minutesPerDay)%E.daysPerMonth+1}));
    text('growth',t('growth',{count:number(w.lastGrowth)}));
    text('goal-text',t(w.routes.some(r=>r.vehicles>0&&r.stops.includes(6))?'goalDone':'goalText'));
    const signature=JSON.stringify([this.tab,w.routes,w.fleet,Math.floor(w.income),Math.floor(w.expenses),Math.floor(w.served)]);
    if(signature===this.panelSignature)return;this.panelSignature=signature;
    let html='';
    if(this.tab==='routes')html=`<div class="section-heading"><h2>${t('routes')}</h2><span>${w.routes.length}</span></div><button class="primary wide" data-action="build">＋ ${t('buildRoute')}</button>`+w.routes.map((r,i)=>`<article class="route-card"><h3><i style="background:var(--line-${i%6})"></i>${t('route',{id:r.id})}</h3><p>${r.stops.map(id=>t(w.districts[id].name)).join(' → ')}</p><small>${t('vehicles',{count:r.vehicles})} · ${t('passengers',{count:number(r.served)})}</small><div class="route-actions"><button data-assign="${r.id}">${t('assign')}</button><button data-remove="${r.id}" class="muted">${t('remove')}</button></div></article>`).join('');
    if(this.tab==='fleet')html=`<h2>${t('fleet')}</h2><strong class="big">${w.fleet}</strong><p>${t('vehicles',{count:w.fleet})}</p><p>${t('reserve',{count:reserved(w)})}</p><button class="primary wide" data-action="buy">${t('buy',{cost:number(M.price)})}</button>`;
    if(this.tab==='finance')html=`<h2>${t('finance')}</h2><p>${t('fare',{cost:w.fare})}</p><article class="finance-row">${t('income')}<strong>${number(w.income)} ₽</strong></article><article class="finance-row">${t('expenses')}<strong>${number(w.expenses)} ₽</strong></article><p>${t('passengers',{count:number(w.served)})}</p>`;
    document.getElementById('panel')!.innerHTML=html;
  }
  build(draft:number[]|null){
    document.getElementById('build-bar')!.hidden=draft===null;
    if(draft){document.getElementById('selection')!.textContent=draft.map(id=>t(this.world.districts[id].name)).join(' → ')||t('selected',{count:0});const button=document.querySelector<HTMLButtonElement>('#confirm')!;button.textContent=t('confirm',{cost:number(routeCost(draft.length))});button.disabled=draft.length<2;}
  }
  debug(text:string){document.getElementById('debug')!.textContent=text;}
}

