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
  let draft:number[]|null=null,speed=1,modal=false,accumulator=0,last=0,visualTime=0,saveElapsed=0,uiElapsed=0;
  const refresh=()=>{snapshot=getSnapshot(world);ui.update(snapshot);map.update(snapshot,draft??[]);ui.build(draft);};
  const persist=()=>{if(!save(world,storage))ui.toast('saveError');};
  const cancel=()=>{draft=null;map.building=false;accumulator=0;refresh();};
  ui.onCommand=cmd=>{const result=applyCommand(world,cmd);if(!result.ok){ui.toast(result.error);return;}ui.toast(cmd.type==='buyVehicle'?'bought':cmd.type==='assignVehicle'?'assigned':cmd.type==='removeRoute'?'removed':'newRoute');persist();refresh();};
  ui.onBuild=()=>{draft=[];map.building=true;accumulator=0;refresh();};ui.onCancel=cancel;
  ui.onConfirm=()=>{if(!draft)return;const result=applyCommand(world,{type:'buildRoute',stops:draft});if(!result.ok){ui.toast(result.error);return;}cancel();persist();ui.toast('newRoute');};
  map.onStop=id=>{if(!draft){ui.onBuild();}if(draft&&!draft.includes(id)){draft.push(id);refresh();}};
  ui.onSpeed=value=>{speed=value;accumulator=0;};ui.onModal=value=>{modal=value;accumulator=0;};
  ui.onReset=()=>{world=createWorld();draft=null;map.building=false;accumulator=0;persist();refresh();};
  ui.onZoom=factor=>map.changeZoom(factor);ui.onRecenter=()=>map.recenter();
  ui.onLayer=layer=>{map.layer=layer as Layer;map.update(snapshot,draft??[]);};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&draft)cancel();});
  document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;if(document.hidden)persist();});
  window.addEventListener('pagehide',persist);
  const frame=(now:number)=>{
    const dt=last?Math.min((now-last)/1000,0.1):0;last=now;
    if(!document.hidden){
      if(speed&&!modal&&draft===null){accumulator+=dt*speed;visualTime+=dt*speed;while(accumulator>=E.realSecondsPerTick){accumulator-=E.realSecondsPerTick;step(world,E.minutesPerTick);}}
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

