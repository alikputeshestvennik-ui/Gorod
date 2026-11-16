import * as THREE from 'three';
import { D, T } from '../sim/config';
import type { World } from '../sim/types';
import { Actors } from './actors';
import { DevelopmentView } from './development';
import { EventView } from './events';
import { roadPath } from '../sim/roads';
import { eventConfig } from '../sim/events';
import { t, number } from '../core/i18n';
import { MapCamera } from './camera';
import { Scenery } from './scenery';
import { Atmosphere } from './atmosphere';
import type { Settings, Quality } from '../core/settings';
export type Layer = 'off' | 'demand' | 'load' | 'complaints';
export class CityMap {
  private scene = new THREE.Scene();
  private controls: MapCamera;
  private scenery: Scenery;
  private atmosphere: Atmosphere;
  private quality: Quality = 'medium';
  private time: Settings['time'] = 'auto';
  private slowSeconds = 0;
  private daylight = 1;
  onQuality: (quality: Quality) => void = () => {};
  private renderer: THREE.WebGLRenderer;
  private projected = new THREE.Vector3();
  private matrix = new THREE.Matrix4();
  private stops: THREE.Mesh[] = [];
  private labels: HTMLButtonElement[] = [];
  private lines = new THREE.Group();
  private actors: Actors;
  private development: DevelopmentView;
  private events: EventView;
  private heat: THREE.InstancedMesh;
  private tint=new THREE.Color();
  private scale=new THREE.Vector3();
  private signature = '';
  private observer: ResizeObserver;
  private width = 1;
  private height = 1;
  private frames = 0;
  private fps = 0;
  private lastCounter = performance.now() / 1000;
  onStop: (id: number) => void = () => {};
  set building(value: boolean) { this.controls.building = value; }
  layer: Layer = 'off';
  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.domElement.setAttribute('aria-label', t('mapLabel'));
    host.append(this.renderer.domElement);
    this.controls = new MapCamera(this.renderer.domElement,host); this.controls.onStop = id => this.onStop(id);
    this.scenery = new Scenery(this.scene); this.atmosphere = new Atmosphere(this.scene, this.scenery.windows);
    this.actors = new Actors(this.scene);this.development = new DevelopmentView(this.scene);this.events = new EventView(this.scene);
    this.scene.add(this.lines);
    this.heat=new THREE.InstancedMesh(new THREE.CircleGeometry(1.55,24),new THREE.MeshBasicMaterial({transparent:true,opacity:0.45,depthWrite:false,depthTest:false}),20);
    this.heat.renderOrder=4;this.heat.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.heat.visible=false;this.scene.add(this.heat);
    this.heat.frustumCulled=false;
    this.observer=new ResizeObserver(()=>this.resize()); this.observer.observe(host);
    this.resize();
  }
  private resize() {
    this.width=this.host.clientWidth;this.height=this.host.clientHeight;
    this.renderer.setSize(this.width,this.height); this.controls.resize(this.width,this.height);
  }
  configure(settings: Settings) {
    this.quality=settings.quality;this.time=settings.time;this.slowSeconds=0;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1,settings.quality==='low'?1:settings.quality==='medium'?1.5:2));this.resize();
  }
  changeZoom(factor:number){this.controls.changeZoom(factor);}
  rotate(delta:number){this.controls.rotate(delta);}
  recenter(){this.controls.recenter();}
  get light(){return this.daylight;}
  update(world:World,draft:number[]) {
    this.controls.districts=world.districts;this.development.update(world);this.host.dataset.layer=this.layer;
    while(this.stops.length>world.districts.length){const stop=this.stops.pop()!;stop.geometry.dispose();(stop.material as THREE.Material).dispose();stop.removeFromParent();this.labels.pop()!.remove();}
    for(let id=this.stops.length;id<world.districts.length;id++){
      const d=world.districts[id];
      const stop=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.06,16),new THREE.MeshBasicMaterial({color:'#31896b'}));stop.position.set(d.x,.17,d.y);this.stops.push(stop);this.scene.add(stop);
      const label=document.createElement('button');label.className='stop-label';label.setAttribute('aria-label',t(d.name));label.dataset.stop=String(d.id);label.onclick=e=>{if(e.detail===0)this.onStop(d.id);};this.host.append(label);this.labels.push(label);
    }
    this.heat.count=world.districts.length;
    const signature=JSON.stringify([world.routes.map(r=>[r.id,r.stops,r.vehicles,r.mode]),draft,world.event?.id]);
    if(signature!==this.signature){
      this.signature=signature;
      for(const child of [...this.lines.children]){const line=child as THREE.Line;line.geometry.dispose();(line.material as THREE.Material).dispose();this.lines.remove(line);}
      for(const r of [...world.routes,{id:0,stops:draft,vehicles:0}]){
        const points:THREE.Vector3[]=[];
        for(let j=1;j<r.stops.length;j++){
          const a=world.districts[r.stops[j-1]],b=world.districts[r.stops[j]];
          points.push(...roadPath(a,b).map(p=>new THREE.Vector3(p[0],.15,p[1])));
        }
        if(points.length){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:r.id?D.colors[(r.id-1)%D.colors.length]:'#e28e42',depthTest:false}));line.renderOrder=5;this.lines.add(line);}
      }
    }
    this.heat.visible=this.layer!=='off';
    for(const d of world.districts){
      const waiting=world.queues[d.id].reduce((s,n)=>s+n,0),generated=world.demand[d.id];
      const event=eventConfig(world);
      const capacity=world.routes.filter(r=>r.stops.includes(d.id)&&!(event?.id==='repair'&&r.stops.includes(event.district))).reduce((s,r)=>s+r.vehicles*T[r.mode].capacity,0);
      const load=waiting/Math.max(1,capacity);
      const complaint=generated>0?(capacity?Math.min(1,load):1):0;
      const intensity=this.layer==='demand'?Math.min(1,generated/15):this.layer==='load'?Math.min(1,load):this.layer==='complaints'?complaint:0;
      this.tint.set(this.layer==='demand'?'#5bff83':this.layer==='load'?'#40dcff':'#ff784d').multiplyScalar(.12+intensity*.88);
      this.matrix.makeRotationX(-Math.PI/2);this.scale.setScalar(1+intensity*0.45);this.matrix.scale(this.scale);this.matrix.setPosition(d.x,0.13,d.y);
      this.heat.setMatrixAt(d.id,this.matrix);this.heat.setColorAt(d.id,this.tint);
      (this.stops[d.id].material as THREE.MeshBasicMaterial).color.set(draft.includes(d.id)?'#e28e42':'#31896b');
      this.stops[d.id].scale.setScalar(draft.includes(d.id)?1.6:1);
      const count=this.layer==='demand'?number(generated):this.layer==='load'?number(load*100)+'%':number(complaint*100)+'%';
      this.labels[d.id].textContent=this.layer==='off'?t(d.name):t('layerStop',{name:t(d.name),count});
      this.labels[d.id].title=this.labels[d.id].textContent??'';
      this.labels[d.id].classList.toggle('selected',draft.includes(d.id));
    }
    this.heat.instanceMatrix.needsUpdate=true;if(this.heat.instanceColor)this.heat.instanceColor.needsUpdate=true;
  }

  draw(time:number,world:World,dt=1/60){
    this.controls.update(dt);this.scenery.update(this.controls.camera,this.controls.zoom,this.quality);
    this.daylight=this.atmosphere.update(world.minute,this.time,world.event?.id);
    this.events.update(world,time,this.quality,this.controls.center);this.host.dataset.event=world.event?.id??'';
    this.actors.draw(world,time,this.controls.zoom,this.quality,this.controls.center);
    this.host.dataset.people=String(this.actors.visiblePeople);this.host.dataset.vehicles=String(this.actors.visibleVehicles);this.host.dataset.taxis=String(this.actors.visibleTaxis);
    for(const d of world.districts){
      this.projected.set(d.x,0.2,d.y).project(this.controls.camera);const label=this.labels[d.id];
      label.style.maxWidth=`${Math.max(44,Math.min(140,3*this.width/(this.controls.camera.right-this.controls.camera.left)-4))}px`;
      label.style.left=`${(this.projected.x+1)*this.width/2}px`;label.style.top=`${(-this.projected.y+1)*this.height/2}px`;
      label.hidden=Math.abs(this.projected.x)>1||Math.abs(this.projected.y)>1;
    }
    this.renderer.render(this.scene,this.controls.camera);this.frames++;
    const wallTime = performance.now() / 1000;
    if(wallTime-this.lastCounter>=1){this.fps=Math.round(this.frames/(wallTime-this.lastCounter));this.frames=0;this.lastCounter=wallTime;
      if(this.fps>0&&this.fps<25)this.slowSeconds++;else this.slowSeconds=0;
      if(this.slowSeconds>=8&&this.quality!=='low'){
        const quality=this.quality==='high'?'medium':'low';this.configure({version:1,quality,time:this.time,sound:false});this.onQuality(quality);
      }
    }
  }
  dispose(){
    this.observer.disconnect();
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
    this.scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line||object instanceof THREE.Points){geometries.add(object.geometry);const list=Array.isArray(object.material)?object.material:[object.material];for(const material of list)materials.add(material);}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.renderer.dispose();this.labels.forEach(label=>label.remove());
  }
  stats(){return `${this.fps} FPS · ${this.renderer.info.render.calls} calls · ${this.renderer.info.render.triangles} triangles`;}
}
