import * as THREE from 'three';
import { D, T } from '../sim/config';
import type { World } from '../sim/types';
import { eventConfig } from '../sim/events';
import { t, number } from '../core/i18n';
export type Layer = 'off' | 'demand' | 'load' | 'complaints';
export class CityMap {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.1, 100);
  private renderer: THREE.WebGLRenderer;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private pointer = new THREE.Vector2();
  private point = new THREE.Vector3();
  private projected = new THREE.Vector3();
  private matrix = new THREE.Matrix4();
  private stops: THREE.Mesh[] = [];
  private labels: HTMLButtonElement[] = [];
  private lines = new THREE.Group();
  private cars: THREE.InstancedMesh;
  private heat: THREE.InstancedMesh;
  private tint=new THREE.Color();
  private scale=new THREE.Vector3();
  private paths: THREE.Vector3[][] = [];
  private lengths: number[] = [];
  private signature = '';
  private zoom = 1;
  private center = new THREE.Vector3(5.5, 0, 5.5);
  private observer: ResizeObserver;
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { x: number; y: number; moved: boolean; multi: boolean; distance: number } | null = null;
  private width = 1;
  private height = 1;
  private frames = 0;
  private fps = 0;
  private lastCounter = performance.now() / 1000;
  onStop: (id: number) => void = () => {};
  building = false;
  layer: Layer = 'off';
  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.setClearColor('#e4ebd9');
    this.renderer.domElement.setAttribute('aria-label', t('mapLabel'));
    host.append(this.renderer.domElement);
    this.camera.position.set(5.5, 30, 5.5); this.camera.up.set(0, 0, -1); this.camera.lookAt(this.center);
    const flat = (color: string) => new THREE.MeshBasicMaterial({ color });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(14,14), flat('#d9e5c9'));
    ground.rotation.x = -Math.PI / 2; ground.position.set(5.5,-0.05,5.5); this.scene.add(ground);
    const river = new THREE.Mesh(new THREE.PlaneGeometry(1.1,14), flat('#accfc9'));
    river.rotation.x = -Math.PI / 2; river.position.set(8.5,0,5.5); this.scene.add(river);
    for (const x of [1,4,7,10]) {
      for (const vertical of [true,false]) {
        const road = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? 0.42 : 13, vertical ? 13 : 0.42), flat('#f8f7ef'));
        road.rotation.x=-Math.PI/2; road.position.set(vertical ? x : 5.5,0.02,vertical ? 5.5 : x); this.scene.add(road);
      }
    }
    const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55,0.08,0.65),flat('#b7c9a5'),100);
    let index=0;
    for(let x=0;x<12;x++) for(let z=0;z<12;z++) {
      if([1,4,7,10].includes(x)||[1,4,7,10].includes(z)||x===8) continue;
      this.matrix.makeTranslation(x,0,z); blocks.setMatrixAt(index++,this.matrix);
    }
    blocks.count=index; this.scene.add(blocks);
    for(const d of D.districts) {
      const stop = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,0.06,16),flat('#31896b'));
      stop.position.set(d.x,0.12,d.y); this.stops.push(stop);this.scene.add(stop);
      const label=document.createElement('button'); label.className='stop-label'; label.textContent=t(d.name);
      label.onclick=()=>this.onStop(d.id); host.append(label); this.labels.push(label);
    }
    this.scene.add(this.lines);
    this.heat=new THREE.InstancedMesh(new THREE.CircleGeometry(0.8,16),new THREE.MeshBasicMaterial({transparent:true,opacity:0.38,depthWrite:false}),D.districts.length);
    this.heat.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.heat.visible=false;this.scene.add(this.heat);
    this.cars=new THREE.InstancedMesh(new THREE.BoxGeometry(0.17,0.12,0.32),flat('#223d36'),60);
    this.cars.count=0;this.cars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(this.cars);
    this.observer=new ResizeObserver(()=>this.resize()); this.observer.observe(host);
    this.bind();this.resize();
  }
  private resize() {
    this.width=this.host.clientWidth;this.height=this.host.clientHeight;
    this.renderer.setSize(this.width,this.height); this.updateCamera();
  }
  private updateCamera() {
    const half=7.3/this.zoom,aspect=this.width/Math.max(1,this.height);
    this.camera.left=-half*Math.max(1,aspect);this.camera.right=half*Math.max(1,aspect);
    this.camera.top=half*Math.max(1,1/aspect);this.camera.bottom=-this.camera.top;
    this.camera.position.set(this.center.x,30,this.center.z);this.camera.lookAt(this.center);this.camera.updateProjectionMatrix();
  }
  changeZoom(factor:number){this.zoom=Math.max(0.7,Math.min(3,this.zoom*factor));this.updateCamera();}
  recenter(){this.center.set(5.5,0,5.5);this.zoom=1;this.updateCamera();}
  private pick(x:number,y:number):number|null {
    const rect=this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);
    this.ray.setFromCamera(this.pointer,this.camera);
    if(!this.ray.ray.intersectPlane(this.plane,this.point)) return null;
    let id:number|null=null,best=0.65/this.zoom;
    for(const d of D.districts){const dist=Math.hypot(d.x-this.point.x,d.y-this.point.z);if(dist<best){id=d.id;best=dist;}}
    return id;
  }
  private bind(){
    const canvas=this.renderer.domElement;
    canvas.addEventListener('pointerdown',e=>{
      canvas.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(this.pointers.size===1){this.drag={x:e.clientX,y:e.clientY,moved:false,multi:false,distance:0};if(this.building){const id=this.pick(e.clientX,e.clientY);if(id!==null)this.onStop(id);}}
      else if(this.drag){this.drag.multi=true;this.drag.distance=this.pinchDistance();}
    });
    canvas.addEventListener('pointermove',e=>{
      if(!this.drag||!this.pointers.has(e.pointerId))return;
      const previous=this.pointers.get(e.pointerId)!;this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(this.pointers.size===2){const dist=this.pinchDistance();this.changeZoom(dist/Math.max(1,this.drag.distance));this.drag.distance=dist;return;}
      if(this.drag.multi)return;
      if(Math.hypot(e.clientX-this.drag.x,e.clientY-this.drag.y)>8)this.drag.moved=true;
      if(!this.drag.moved)return;
      if(this.building){const id=this.pick(e.clientX,e.clientY);if(id!==null)this.onStop(id);return;}
      this.center.x-=(e.clientX-previous.x)*(this.camera.right-this.camera.left)/this.width;
      this.center.z-=(e.clientY-previous.y)*(this.camera.top-this.camera.bottom)/this.height;
      this.center.x=Math.max(-1,Math.min(12,this.center.x));this.center.z=Math.max(-1,Math.min(12,this.center.z));this.updateCamera();
    });
    const end=(e:PointerEvent)=>{if(e.type==='pointerup'&&this.drag&&!this.drag.moved&&!this.drag.multi&&!this.building){const id=this.pick(e.clientX,e.clientY);if(id!==null)this.onStop(id);}this.pointers.delete(e.pointerId);if(!this.pointers.size)this.drag=null;};
    canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.changeZoom(e.deltaY<0?1.1:1/1.1);},{passive:false});
  }
  private pinchDistance(){const p=[...this.pointers.values()];return Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}
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
          points.push(new THREE.Vector3(a.x,0.08,a.y),new THREE.Vector3(b.x,0.08,a.y),new THREE.Vector3(b.x,0.08,b.y));
        }
        if(points.length){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:r.id?D.colors[(r.id-1)%D.colors.length]:'#e28e42'}));this.lines.add(line);}
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
      this.matrix.makeRotationX(-Math.PI/2);this.scale.setScalar(1+intensity*0.45);this.matrix.scale(this.scale);this.matrix.setPosition(d.x,0.055,d.y);
      this.heat.setMatrixAt(d.id,this.matrix);this.heat.setColorAt(d.id,this.tint);
      (this.stops[d.id].material as THREE.MeshBasicMaterial).color.set(draft.includes(d.id)?'#e28e42':'#31896b');
      this.stops[d.id].scale.setScalar(draft.includes(d.id)?1.6:1);
      const count=this.layer==='demand'?number(generated):this.layer==='load'?number(load*100)+'%':number(complaint*100)+'%';
      this.labels[d.id].textContent=this.layer==='off'?t(d.name):t('layerStop',{name:t(d.name),count});
      this.labels[d.id].classList.toggle('selected',draft.includes(d.id));
    }
    this.heat.instanceMatrix.needsUpdate=true;if(this.heat.instanceColor)this.heat.instanceColor.needsUpdate=true;
  }

  draw(time:number,world:World){
    let car=0;const event=eventConfig(world);
    world.routes.forEach((r,i)=>{
      if(event?.id==='repair'&&r.stops.includes(event.district))return;
      const path=this.paths[i],length=this.lengths[i];if(!path?.length||!length)return;
      for(let v=0;v<r.vehicles;v++){
        let progress=(time*0.5*(event?.speed??1)+v*length/Math.max(1,r.vehicles))%(length*2);if(progress>length)progress=length*2-progress;
        for(let k=1;k<path.length;k++){
          const segment=path[k].distanceTo(path[k-1]);
          if(progress>segment){progress-=segment;continue;}
          this.point.copy(path[k-1]).lerp(path[k],segment?progress/segment:0);this.point.y=0.2;
          this.matrix.makeRotationY(Math.atan2(path[k].x-path[k-1].x,path[k].z-path[k-1].z));this.scale.set(r.mode==='marshrutka'?1:1.3,1,r.mode==='tram'?2:r.mode==='marshrutka'?1:1.6);this.matrix.scale(this.scale);
          this.matrix.setPosition(this.point);this.cars.setMatrixAt(car,this.matrix);this.tint.set(D.colors[(r.id-1)%D.colors.length]);this.cars.setColorAt(car++,this.tint);break;
        }
      }
    });
    this.cars.count=car;this.cars.instanceMatrix.needsUpdate=true;if(this.cars.instanceColor)this.cars.instanceColor.needsUpdate=true;
    for(const d of world.districts){this.projected.set(d.x,0.2,d.y).project(this.camera);const label=this.labels[d.id];label.style.left=`${(this.projected.x+1)*this.width/2}px`;label.style.top=`${(-this.projected.y+1)*this.height/2}px`;label.hidden=Math.abs(this.projected.x)>1||Math.abs(this.projected.y)>1;}
    this.renderer.render(this.scene,this.camera);this.frames++;
    const wallTime = performance.now() / 1000;
    if(wallTime-this.lastCounter>=1){this.fps=Math.round(this.frames/(wallTime-this.lastCounter));this.frames=0;this.lastCounter=wallTime;}
  }
  stats(){return `${this.fps} FPS · ${this.renderer.info.render.calls} calls · ${this.renderer.info.render.triangles} triangles`;}
}
