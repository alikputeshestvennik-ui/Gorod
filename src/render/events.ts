import * as THREE from 'three';
import type { World } from '../sim/types';
import type { Quality } from '../core/settings';
import { CityGeometry } from './geometry';
export class EventView {
  private snow: THREE.Points;
  private rain: THREE.LineSegments;
  private snowGround: THREE.Mesh;
  private repair: THREE.Group;
  private forecast: THREE.Group;
  private match: THREE.Group;
  private fair: THREE.Group;
  private snowPositions = new Float32Array(360 * 3);
  private rainPositions = new Float32Array(360 * 6);
  constructor(scene: THREE.Scene) {
    const snowGeometry=new THREE.BufferGeometry();snowGeometry.setAttribute('position',new THREE.BufferAttribute(this.snowPositions,3).setUsage(THREE.DynamicDrawUsage));
    this.snow=new THREE.Points(snowGeometry,new THREE.PointsMaterial({color:'#edf8ff',size:.065,transparent:true,opacity:.9,depthWrite:false}));
    const rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.BufferAttribute(this.rainPositions,3).setUsage(THREE.DynamicDrawUsage));
    this.rain=new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:'#a7cddd',transparent:true,opacity:.65}));
    this.snow.frustumCulled=this.rain.frustumCulled=false;
    this.snowGround=new THREE.Mesh(new THREE.PlaneGeometry(28,28),new THREE.MeshBasicMaterial({color:'#e3ede6',transparent:true,opacity:.72,depthWrite:false}));this.snowGround.rotation.x=-Math.PI/2;this.snowGround.position.set(6,.045,6);
    const g=new CityGeometry(),f=new CityGeometry();
    for(let i=0;i<8;i++){
      const x=3.35+(i%4)*.42,z=6.5+Math.floor(i/4);
      g.add('box',i%2?'#dcb750':'#a75c3e',x,.25,z,.3,.3,.07);
      f.add('cone','#d1893e',x,.22,z,.11,.2,.11);
    }
    g.add('box','#b4a28a',4,.13,7,1,.05,.8);
    g.add('box','#dcab39',4.5,.31,7,.32,.27,.5);g.add('box','#536b73',4.5,.5,7,.25,.18,.23);
    g.add('box','#414e50',4.5,.18,7,.38,.12,.52);g.add('box','#d6a23a',4.2,.64,7,.55,.08,.08);
    this.repair=g.finish();this.forecast=f.finish();
    const match=new CityGeometry();
    for(let i=0;i<96;i++){const side=i%2?1:-1;match.add('box',i%3?'#d6a14c':'#cc6150',12+side*(1.04+Math.floor(i/32)*.1),.34+Math.floor(i/32)*.1,7.65+(i%32)*.06,.07,.12,.055);}
    for(let i=0;i<22;i++){match.add('box',i<11?'#c34e44':'#e9dbac',11.4+(i%4)*.4,.19,7.9+Math.floor(i/4)*.27,.07,.15,.055);match.add('round','#dfb58c',11.4+(i%4)*.4,.29,7.9+Math.floor(i/4)*.27,.065,.065,.065);}
    match.add('round','#f5eddf',12,.14,8.6,.07,.07,.07);this.match=match.finish();
    const fair=new CityGeometry();for(let i=0;i<12;i++)fair.add('round',i%2?'#d99a49':'#e3c891',2.5+(i%4)*.3,.8+Math.sin(i)*.15,3.3+Math.floor(i/4)*.18,.12,.17,.12);this.fair=fair.finish();
    scene.add(this.snow,this.rain,this.snowGround,this.repair,this.forecast,this.match,this.fair);
  }
  update(w:World,time:number,quality:Quality,center:THREE.Vector3){
    const id=w.event?.id;
    this.repair.visible=id==='repair';this.forecast.visible=w.nextEvent.id==='repair'&&id!=='repair';
    this.match.visible=id==='match';this.fair.visible=id==='fair';this.snow.visible=this.snowGround.visible=id==='snow';this.rain.visible=id==='rain';
    if(id!=='snow'&&id!=='rain')return;
    const count=quality==='low'?100:quality==='medium'?220:360;
    for(let i=0;i<count;i++){
      const x=center.x+((i*7.37+time*(id==='snow'?.18:.6))%18)-9;
      const z=center.z+((i*3.73)%18)-9,y=6-((time*(id==='snow'?.7:6)+i*.47)%6);
      if(id==='snow'){const k=i*3;this.snowPositions[k]=x;this.snowPositions[k+1]=y;this.snowPositions[k+2]=z;}
      else{const k=i*6;this.rainPositions[k]=x;this.rainPositions[k+1]=y;this.rainPositions[k+2]=z;this.rainPositions[k+3]=x-.06;this.rainPositions[k+4]=y-.4;this.rainPositions[k+5]=z;}
    }
    this.snow.geometry.setDrawRange(0,count);this.rain.geometry.setDrawRange(0,count*2);
    this.snow.geometry.attributes.position.needsUpdate=true;this.rain.geometry.attributes.position.needsUpdate=true;
  }
}
