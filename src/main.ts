import { createWorld, getSnapshot, applyCommand, step } from './sim/world';
import { load, save } from './core/save';
import { E } from './sim/config';
import { t } from './core/i18n';
import { CityMap, type Layer } from './render/map';
import { GameUI } from './ui/app';
import './ui/style.css';
function start(){
  const storage={getItem:(key:string)=>window.localStorage.getItem(key),setItem:(key:string,value:string)=>window.localStorage.setItem(key,value)};
  const loaded=load(storage);let world=loaded.world,snapshot=getSnapshot(world);
  const ui=new GameUI(document.getElementById('app')!);
  const map=new CityMap(ui.mapHost);
  let editing:number|undefined,prepend=false;
  let draft:number[]|null=null,speed=1,modal=false,accumulator=0,last=0,visualTime=0,saveElapsed=0,uiElapsed=0;
  const refresh=()=>{snapshot=getSnapshot(world);ui.update(snapshot);map.update(snapshot,draft??[]);ui.build(draft,editing);};
  const persist=()=>{if(!save(world,storage))ui.toast('saveError');};
  const cancel=()=>{draft=null;editing=undefined;map.building=false;accumulator=0;refresh();};
  ui.onCommand=cmd=>{
    const result=applyCommand(world,cmd);if(!result.ok){ui.toast(result.error);return;}
    const messages={buyVehicle:'bought',assignVehicle:'assigned',releaseVehicle:'released',removeRoute:'removed',setFare:'fareChanged',serviceFleet:'serviced',takeLoan:'loanChanged',repayLoan:'loanChanged',editRoute:'edited',buildRoute:'newRoute'};
    ui.toast(messages[cmd.type]);persist();refresh();
  };
  const begin=(id?:number)=>{
    if(world.gameOver){ui.toast('gameOver');return;}
    editing=id;prepend=false;ui.resetDraftEnd();draft=id?[...world.routes.find(r=>r.id===id)!.stops]:[];
    map.building=true;accumulator=0;ui.openPanel('map');refresh();
  };
  ui.onBuild=()=>begin();ui.onEdit=id=>begin(id);ui.onCancel=()=>{cancel();ui.openPanel('routes');};
  ui.onConfirm=()=>{
    if(!draft)return;
    const result=applyCommand(world,editing?{type:'editRoute',routeId:editing,stops:draft}:{type:'buildRoute',stops:draft,mode:ui.mode});
    if(!result.ok){ui.toast(result.error);return;}
    const message=editing?'edited':'newRoute';cancel();persist();ui.openPanel('routes');ui.toast(message);
  };
  ui.onDraft=(action,index)=>{
    if(!draft)return;
    if(action==='start'||action==='end')prepend=action==='start';
    if(action==='clear')draft=[];
    if(action==='undo')prepend?draft.shift():draft.pop();
    if(action==='remove'&&index!==undefined)draft.splice(index,1);
    refresh();
  };
  map.onStop=id=>{if(!draft)begin();if(draft&&!draft.includes(id)){prepend?draft.unshift(id):draft.push(id);refresh();}};
  ui.onSpeed=value=>{speed=value;accumulator=0;};ui.onModal=value=>{modal=value;accumulator=0;};
  ui.onReset=()=>{world=createWorld();editing=undefined;draft=null;map.building=false;accumulator=0;persist();refresh();};
  ui.onZoom=factor=>map.changeZoom(factor);ui.onRecenter=()=>map.recenter();
  ui.onLayer=layer=>{map.layer=layer as Layer;map.update(snapshot,draft??[]);};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&draft)cancel();});
  document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;if(document.hidden)persist();});
  window.addEventListener('pagehide',persist);
  const frame=(now:number)=>{
    const dt=last?Math.min((now-last)/1000,0.1):0;last=now;
    if(!document.hidden){
      if(speed&&!modal&&draft===null&&!world.gameOver){accumulator+=dt*speed;visualTime+=dt*speed;while(accumulator>=E.realSecondsPerTick){accumulator-=E.realSecondsPerTick;step(world,E.minutesPerTick);}}
      uiElapsed+=dt;saveElapsed+=dt;
      if(uiElapsed>=0.4){uiElapsed=0;refresh();ui.debug(map.stats());}
      if(saveElapsed>=10){saveElapsed=0;persist();}
      map.draw(visualTime,snapshot);
    }
    requestAnimationFrame(frame);
  };
  refresh();if(loaded.warning)ui.toast(loaded.warning);requestAnimationFrame(frame);
}
try{start();}catch(error){const app=document.getElementById('app')!;app.textContent=t('errorTitle')+': '+t('renderError');console.error(error);}

