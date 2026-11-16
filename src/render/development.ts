import * as THREE from 'three';
import type { District, World } from '../sim/types';
import { C } from '../sim/development';
import { roadClearance, isLandmark } from './infrastructure';
import { CityGeometry, removeGeometry } from './geometry';
export function plotPosition(d: Pick<District, 'id' | 'x' | 'y'>): [number, number] {
  if (d.id === 4) return [2, 0];
  if (d.id === 5 || d.id === 6 || d.id === 3) return [d.x - 1, d.y + 1];
  return [d.x - 1, d.y - 1];
}
export class DevelopmentView {
  private group = new THREE.Group();
  private signature = '';
  constructor(private scene: THREE.Scene) {}
  update(w: World) {
    const signature = JSON.stringify([w.development.map(l=>[l.phase,l.level,['construction','renovation'].includes(l.phase)?Math.min(4,Math.floor((w.minute-l.since)/Math.max(1,l.until-l.since)*4)):0]),w.expansion&&[w.expansion.index,Math.floor((w.minute-w.expansion.since)/(w.expansion.until-w.expansion.since)*4)]]);
    if (signature === this.signature) return; this.signature = signature;
    removeGeometry(this.group); const g = new CityGeometry();
    const box = (c: string,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>g.add('box',c,x,y,z,sx,sy,sz);
    const park = (x:number,z:number)=>{
      box('#78a77a',x,.06,z,.95,.04,.95);box('#dbcfb0',x,.09,z,.95,.02,.14);
      for (let i=0;i<3;i++){const tx=x+(i-1)*.29;box('#8b7454',tx,.24,z-.25,.055,.32,.055);g.add('round',i%2?'#91b27d':'#538b65',tx,.56,z-.25,.42,.56,.42);}
      box('#ad8054',x,.21,z+.25,.5,.05,.13);
    };
    const site=(x:number,z:number,progress:number,height:number)=>{
      box('#b9a387',x,.08,z,1.2,.07,1.2);
      for(let i=0;i<4;i++){box(i%2?'#dfac40':'#b26d3c',x-.5+i*.33,.2,z+.58,.28,.22,.04);}
      const h=.15+progress*height;box('#9ca49e',x,h/2+.1,z,.73,h,.73);
      for (const side of [-1,1]){box('#d6bb78',x+side*.46,h/2+.2,z,.035,h+.25,1);for(let y=.3;y<h+.4;y+=.3)box('#e7d4a6',x+side*.46,y,z,.04,.035,1);}
      box('#e1b744',x-.7,1.12,z-.4,.075,2.1,.075);box('#e1b744',x-.25,2.12,z-.4,1.25,.065,.065);box('#6b7576',x+.2,1.65,z-.4,.018,.9,.018);
      box('#b47e45',x+.43,.18,z+.35,.27,.18,.16);
    };
    for(const d of w.districts){
      const [x,z]=plotPosition(d),lot=w.development[d.id];
      if(d.id>=12)for(const dx of [-2,1,2])for(const dz of [-2,1,2]){
        const qx=d.x+dx,qz=d.y+dz;if(roadClearance(qx,qz)<.7||isLandmark(qx,qz)||Math.hypot(qx-12,qz-8.6)<1.8||Math.abs(qz-11.45)<.5)continue;
        const h=.35+((dx+dz+4)%3)*.3;box('#dbc7a3',qx,h/2+.07,qz,.62,h,.62);g.add('roof','#9d6c58',qx,h+.2,qz,.74,.28,.74);
        g.add('round','#62996e',qx+.42,.42,qz-.25,.38,.55,.38);
      }

      if(lot.phase==='park'||d.type==='leisure'){park(x,z);continue;}
      const height=.5+lot.level*.52;
      if(lot.phase==='construction'||lot.phase==='renovation'){site(x,z,Math.max(0,Math.min(1,(w.minute-lot.since)/Math.max(1,lot.until-lot.since))),height+.5);continue;}
      const abandoned=lot.phase==='abandoned',tower=lot.level>=1;
      box(abandoned?'#81776a':tower?'#719eae':'#dec3a0',x,height/2+.08,z,.72,height,.72);
      if(!tower&&!abandoned)g.add('roof','#9b6550',x,height+.2,z,.82,.27,.82);
      if(tower){box('#d0d6ca',x,height+.12,z,.6,.15,.6);box('#658291',x+.1,height+.34,z,.025,.35,.025);}
      for(let y=.25;y<height;y+=.24)box(abandoned?'#354143':'#b9d8d8',x,y,z+.365,.54,.1,.025);
      if(abandoned){box('#64513f',x,.3,z+.38,.7,.07,.025);g.add('round','#66865a',x+.35,.16,z+.32,.4,.3,.4);}
    }
    if(w.expansion){const plan=C.quarters[w.expansion.index],[x,z]=C.nodes[plan.node];site(x-1,z-1,(w.minute-w.expansion.since)/(w.expansion.until-w.expansion.since),1.1);}
    this.group=g.finish();this.scene.add(this.group);
  }
}
