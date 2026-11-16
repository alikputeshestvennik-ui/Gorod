import * as THREE from 'three';
import { D, T } from '../sim/config';
import type { World } from '../sim/types';
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
  private point = new THREE.Vector3();
  private projected = new THREE.Vector3();
  private matrix = new THREE.Matrix4();
  private stops: THREE.Mesh[] = [];
  private labels: HTMLButtonElement[] = [];
  private lines = new THREE.Group();
  private cars: THREE.InstancedMesh;
  private carWindows: THREE.InstancedMesh;
  private carWheels: THREE.InstancedMesh;
  private people: THREE.InstancedMesh;
  private heat: THREE.InstancedMesh;
  private tint=new THREE.Color();
  private scale=new THREE.Vector3();
  private paths: THREE.Vector3[][] = [];
  private lengths: number[] = [];
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
    const flat = (color: string) => new THREE.MeshBasicMaterial({ color });
    for(const d of D.districts) {
      const stop = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,0.06,16),flat('#31896b'));
      stop.position.set(d.x,0.17,d.y); this.stops.push(stop);this.scene.add(stop);
      const label=document.createElement('button'); label.className='stop-label'; label.textContent=t(d.name);label.setAttribute('aria-label',t(d.name));
      label.dataset.stop=String(d.id);label.onclick=e=>{if(e.detail===0)this.onStop(d.id);}; host.append(label); this.labels.push(label);
    }
    this.scene.add(this.lines);
    this.heat=new THREE.InstancedMesh(new THREE.CircleGeometry(0.8,16),new THREE.MeshBasicMaterial({transparent:true,opacity:0.38,depthWrite:false,depthTest:false}),D.districts.length);
    this.heat.renderOrder=4;this.heat.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.heat.visible=false;this.scene.add(this.heat);
    this.cars=new THREE.InstancedMesh(new THREE.BoxGeometry(0.18,0.15,0.34),new THREE.MeshLambertMaterial({color:'#ffffff'}),60);
    this.cars.count=0;this.cars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(this.cars);
    this.carWindows = new THREE.InstancedMesh(new THREE.BoxGeometry(0.185,0.055,0.23).translate(0,0.025,0),flat('#b0d7dd'),60);
    this.carWheels = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2,0.045,0.25).translate(0,-0.075,0),flat('#324248'),60);
    this.scene.add(this.carWindows,this.carWheels);
    this.people = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025,0.035,0.14,5),flat('#b65d45'),48);
    this.people.count=0;this.people.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(this.people);
    for(const mesh of [this.cars,this.carWindows,this.carWheels,this.people,this.heat])mesh.frustumCulled=false;
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
    const signature=JSON.stringify([world.routes.map(r=>[r.id,r.stops,r.vehicles,r.mode]),draft,world.event?.id]);
    if(signature!==this.signature){
      this.signature=signature;
      for(const child of [...this.lines.children]){const line=child as THREE.Line;line.geometry.dispose();(line.material as THREE.Material).dispose();this.lines.remove(line);}
      this.paths=[];this.lengths=[];
      for(const [i,r] of [...world.routes,{id:0,stops:draft,vehicles:0}].entries()){
        const points:THREE.Vector3[]=[];
        for(let j=1;j<r.stops.length;j++){
          const a=world.districts[r.stops[j-1]],b=world.districts[r.stops[j]];
          points.push(new THREE.Vector3(a.x,0.15,a.y),new THREE.Vector3(b.x,0.15,a.y),new THREE.Vector3(b.x,0.15,b.y));
        }
        if(points.length){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:r.id?D.colors[(r.id-1)%D.colors.length]:'#e28e42',depthTest:false}));line.renderOrder=5;this.lines.add(line);}
        if(i<world.routes.length){this.paths.push(points);this.lengths.push(points.reduce((s,p,k)=>k?s+p.distanceTo(points[k-1]):0,0));}
      }
    }
    this.heat.visible=this.layer!=='off';
    for(const d of world.districts){
      const waiting=world.queues[d.id].reduce((s,n)=>s+n,0),generated=world.demand[d.id];
      const event=eventConfig(world);
      const capacity=world.routes.filter(r=>r.stops.includes(d.id)&&!(event?.id==='repair'&&r.stops.includes(event.district))).reduce((s,r)=>s+r.vehicles*T[r.mode].capacity,0);
      const load=waiting/Math.max(1,capacity);
      const complaint=capacity?Math.min(1,load):1;
      const intensity=this.layer==='demand'?Math.min(1,generated/15):this.layer==='load'?Math.min(1,load):this.layer==='complaints'?complaint:0;
      this.tint.setRGB(0.2+intensity*0.65,0.65-intensity*0.3,0.35-intensity*0.12);
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
    this.daylight=this.atmosphere.update(world.minute,this.time);
    const limit=this.quality==='low'?24:this.quality==='medium'?40:60;
    let car=0;const event=eventConfig(world);
    for(let i=0;i<world.routes.length;i++){
      const r=world.routes[i];
      if(event?.id==='repair'&&r.stops.includes(event.district))continue;
      const path=this.paths[i],length=this.lengths[i];if(!path?.length||!length)continue;
      for(let v=0;v<r.vehicles&&car<limit;v++){
        let progress=(time*0.5*(event?.speed??1)+v*length/Math.max(1,r.vehicles))%(length*2);const reverse=progress>length;if(reverse)progress=length*2-progress;
        for(let k=1;k<path.length;k++){
          const segment=path[k].distanceTo(path[k-1]);
          if(progress>segment){progress-=segment;continue;}
          this.point.copy(path[k-1]).lerp(path[k],segment?progress/segment:0);this.point.y=0.23;
          this.matrix.makeRotationY(Math.atan2(path[k].x-path[k-1].x,path[k].z-path[k-1].z)+(reverse?Math.PI:0));this.scale.set(r.mode==='marshrutka'?1:1.3,1,r.mode==='tram'?2:r.mode==='marshrutka'?1:1.6);this.matrix.scale(this.scale);
          this.matrix.setPosition(this.point);this.cars.setMatrixAt(car,this.matrix);this.carWindows.setMatrixAt(car,this.matrix);this.carWheels.setMatrixAt(car,this.matrix);this.tint.set(D.colors[(r.id-1)%D.colors.length]);this.cars.setColorAt(car++,this.tint);break;
        }
      }
    }
    this.carWindows.count=this.carWheels.count=car;this.carWindows.instanceMatrix.needsUpdate=true;this.carWheels.instanceMatrix.needsUpdate=true;
    this.cars.count=car;this.cars.instanceMatrix.needsUpdate=true;if(this.cars.instanceColor)this.cars.instanceColor.needsUpdate=true;
    let people=0;
    if(this.controls.zoom>1.35)for(const d of world.districts){
      if(Math.hypot(d.x-this.controls.center.x,d.y-this.controls.center.z)>6)continue;
      const count=this.quality==='low'?1:this.quality==='medium'?2:4;
      for(let i=0;i<count&&people<48;i++){
        const walk=(time*0.12+i*0.25)%0.8;
        this.matrix.makeTranslation(d.x+0.28,0.2,d.y-0.4+walk);this.people.setMatrixAt(people++,this.matrix);
      }
    }
    this.people.count=people;this.people.instanceMatrix.needsUpdate=true;
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
    this.scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line){geometries.add(object.geometry);const list=Array.isArray(object.material)?object.material:[object.material];for(const material of list)materials.add(material);}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.renderer.dispose();this.labels.forEach(label=>label.remove());
  }
  stats(){return `${this.fps} FPS · ${this.renderer.info.render.calls} calls · ${this.renderer.info.render.triangles} triangles`;}
}
