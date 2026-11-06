// 3D print output: flat shapes extruded into solids, written as binary STL.
// A part is printed from the same outline and holes as its cut file, without the kerf offset.
import earcut from 'earcut';
import {rectPts} from './util.js';

export const circlePts=(cx,cy,d,segs)=>{
  const n=segs||Math.max(12,Math.min(64,Math.ceil(Math.PI*d/0.8))),r=d/2,out=[];
  for(let i=0;i<n;i++){const a=2*Math.PI*i/n;out.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
  return out;
};
const area=r=>r.reduce((a,p,i)=>{const q=r[(i+1)%r.length];return a+p[0]*q[1]-q[0]*p[1];},0)/2;
// drops repeated and in-line points, so the top, bottom and sides share every vertex
function clean(r){
  let pts=r.filter((p,i)=>{const q=r[(i+1)%r.length];return Math.hypot(p[0]-q[0],p[1]-q[1])>1e-7;});
  for(let again=true;again&&pts.length>3;){
    again=false;
    for(let i=0;i<pts.length;i++){
      const a=pts[(i+pts.length-1)%pts.length],b=pts[i],c=pts[(i+1)%pts.length];
      if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<1e-9){pts.splice(i,1);again=true;break;}
    }
  }
  return pts;
}
export function inside([x,y],poly){
  let c=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const [xi,yi]=poly[i],[xj,yj]=poly[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;
  }
  return c;
}
const centre=r=>{const n=r.length;return [r.reduce((a,p)=>a+p[0],0)/n,r.reduce((a,p)=>a+p[1],0)/n];};

// a pen with the same calls as the SVG pen, that keeps the shapes instead of drawing them
const shift=(pts,tx,ty)=>pts.map(([x,y])=>[x+tx,y+ty]);
export function recorder(){
  return {k2:0,
    outline:(pts,tx=0,ty=0)=>({o:shift(pts,tx,ty)}),
    cutout:(pts,tx=0,ty=0)=>({h:shift(pts,tx,ty)}),
    rect:s=>({h:s.poly||rectPts(s.x0,s.y0,s.x1,s.y1)}),
    hole:(x,y,dia)=>({h:circlePts(x,y,dia)}),
    txt:()=>null,
  };
}
// each hole goes to the smallest outline around it; holes outside every outline are dropped
export function shapesToSolids(shapes,z0,z1){
  const outs=shapes.filter(s=>s&&s.o).map(s=>({outer:s.o,holes:[],z0,z1,a:Math.abs(area(s.o))}));
  for(const s of shapes){
    if(!s||!s.h)continue;
    const c=centre(s.h),home=outs.filter(o=>inside(c,o.outer)).sort((a,b)=>a.a-b.a)[0];
    if(home)home.holes.push(s.h);
  }
  return outs.map(({outer,holes,z0,z1})=>({outer,holes,z0,z1}));
}
// a part object ({poly,holes,circles}) as one slab
export const partSolid=(p,z0,z1)=>({outer:p.poly,holes:[...(p.holes||[]),...(p.circles||[]).map(([x,y,d])=>circlePts(x,y,d))],z0,z1});
export const ringSolid=(outer,inner,z0,z1)=>({outer,holes:[inner],z0,z1});

export function meshSolids(solids){
  const tris=[];
  for(const s of solids){
    let outer=clean(s.outer.map(([x,y])=>[x,-y]));       // seen from above, as in the cut file
    if(outer.length<3)continue;
    if(area(outer)<0)outer.reverse();
    const holes=s.holes.map(h=>{const r=clean(h.map(([x,y])=>[x,-y]));if(area(r)>0)r.reverse();return r;}).filter(r=>r.length>=3);
    // triangulate turned to an odd angle: earcut bridges holes along a level line, and on square
    // layouts that line can run along an edge, which leaves a crack in the solid
    const rings=[outer,...holes],pts=rings.flat(),ca=Math.cos(0.4137),sa=Math.sin(0.4137);
    const flat=pts.flatMap(([x,y])=>[x*ca-y*sa,x*sa+y*ca]),holeIdx=[];
    let n=outer.length;
    for(const h of holes){holeIdx.push(n);n+=h.length;}
    const idx=earcut(flat,holeIdx,2);
    // earcut keeps one winding throughout, slivers included, so turn them all together
    let sum=0;
    for(let i=0;i<idx.length;i+=3){const a=pts[idx[i]],b=pts[idx[i+1]],c=pts[idx[i+2]];sum+=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
    for(let i=0;i<idx.length;i+=3){
      let a=pts[idx[i]],b=pts[idx[i+1]],c=pts[idx[i+2]];
      if(sum<0)[b,c]=[c,b];
      tris.push([[...a,s.z1],[...b,s.z1],[...c,s.z1]],[[...a,s.z0],[...c,s.z0],[...b,s.z0]]);
    }
    for(const r of rings)for(let i=0;i<r.length;i++){
      const a=r[i],b=r[(i+1)%r.length];
      tris.push([[...a,s.z0],[...b,s.z0],[...b,s.z1]],[[...a,s.z0],[...b,s.z1],[...a,s.z1]]);
    }
  }
  // move it onto the print bed
  if(tris.length){
    const m=[0,1,2].map(k=>Math.min(...tris.flatMap(t=>t.map(v=>v[k]))));
    for(const t of tris)for(const v of t)for(let k=0;k<3;k++)v[k]-=m[k];
  }
  return tris;
}
export function solidBounds(solids){
  const X=[],Y=[],Z=[];
  for(const s of solids){for(const [x,y] of s.outer){X.push(x);Y.push(y);}Z.push(s.z0,s.z1);}
  if(!X.length)return {w:0,d:0,h:0};
  return {w:Math.max(...X)-Math.min(...X),d:Math.max(...Y)-Math.min(...Y),h:Math.max(...Z)-Math.min(...Z)};
}
export function stlBinary(tris,title='part'){
  const buf=new ArrayBuffer(84+50*tris.length),dv=new DataView(buf);
  const head=('AntFarmGen '+title).slice(0,79);
  for(let i=0;i<head.length;i++)dv.setUint8(i,head.charCodeAt(i)&0x7f);
  dv.setUint32(80,tris.length,true);
  let o=84;
  for(const [a,b,c] of tris){
    const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    let nx=u[1]*v[2]-u[2]*v[1],ny=u[2]*v[0]-u[0]*v[2],nz=u[0]*v[1]-u[1]*v[0];
    const l=Math.hypot(nx,ny,nz)||1;
    for(const f of [nx/l,ny/l,nz/l,...a,...b,...c]){dv.setFloat32(o,f,true);o+=4;}
    dv.setUint16(o,0,true);o+=2;
  }
  return new Uint8Array(buf);
}
// fits flat on the bed, either way round
export const fitsPrinter=(b,P)=>((b.w<=P.printW&&b.d<=P.printD)||(b.w<=P.printD&&b.d<=P.printW))&&b.h<=P.printH;
export const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
// one STL per part type, with the number to print in its name
export function printFile(item){
  const tris=meshSolids(item.solids);
  return {name:`print-${slug(item.name)}${item.qty>1?'-x'+item.qty:''}.stl`,data:stlBinary(tris,item.name),tris:tris.length,print:true};
}
