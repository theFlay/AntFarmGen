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

export const meshSolids=solids=>toBed(meshInPlace(solids));
// moves a mesh onto the print bed, as new points: triangles can share point arrays
export function toBed(tris){
  const m=[Infinity,Infinity,Infinity];
  for(const t of tris)for(const v of t)for(let k=0;k<3;k++)if(v[k]<m[k])m[k]=v[k];
  return tris.map(t=>t.map(v=>v.map((x,k)=>x-m[k])));
}
// A solid made of boxes: the union of `add` minus the union of `sub`, each box [x0,y0,z0,x1,y1,z1].
// Every box edge becomes a grid line, so faces meet edge to edge and the mesh is closed.
export function meshBoxes(add,sub){
  const axis=k=>[...new Set([...add,...sub].flatMap(b=>[b[k],b[k+3]]).map(v=>Math.round(v*1e5)/1e5))].sort((a,b)=>a-b);
  const X=axis(0),Y=axis(1),Z=axis(2),nx=X.length-1,ny=Y.length-1,nz=Z.length-1;
  const inBox=(b,x,y,z)=>x>b[0]&&x<b[3]&&y>b[1]&&y<b[4]&&z>b[2]&&z<b[5];
  const solid=new Uint8Array(nx*ny*nz),at=(i,j,k)=>i<0||j<0||k<0||i>=nx||j>=ny||k>=nz?0:solid[(i*ny+j)*nz+k];
  for(let i=0;i<nx;i++){
    const x=(X[i]+X[i+1])/2,A=add.filter(b=>x>b[0]&&x<b[3]),S=sub.filter(b=>x>b[0]&&x<b[3]);
    for(let j=0;j<ny;j++){
      const y=(Y[j]+Y[j+1])/2;
      for(let k=0;k<nz;k++){
        const z=(Z[k]+Z[k+1])/2;
        solid[(i*ny+j)*nz+k]=A.some(b=>inBox(b,x,y,z))&&!S.some(b=>inBox(b,x,y,z))?1:0;
      }
    }
  }
  const tris=[],quad=(a,b,c,d)=>tris.push([a,b,c],[a,c,d]);
  for(let i=0;i<nx;i++)for(let j=0;j<ny;j++)for(let k=0;k<nz;k++){
    if(!at(i,j,k))continue;
    const x0=X[i],x1=X[i+1],y0=Y[j],y1=Y[j+1],z0=Z[k],z1=Z[k+1];
    if(!at(i+1,j,k))quad([x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]);
    if(!at(i-1,j,k))quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]);
    if(!at(i,j+1,k))quad([x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0]);
    if(!at(i,j-1,k))quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]);
    if(!at(i,j,k+1))quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]);
    if(!at(i,j,k-1))quad([x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0]);
  }
  return tris;
}
// moves every point with f, keeping the faces pointing outwards if f mirrors
export function mapMesh(tris,f){
  const [o,a,b,c]=[[0,0,0],[1,0,0],[0,1,0],[0,0,1]].map(f),d=[a,b,c].map(v=>v.map((x,k)=>x-o[k]));
  const det=d[0][0]*(d[1][1]*d[2][2]-d[1][2]*d[2][1])-d[0][1]*(d[1][0]*d[2][2]-d[1][2]*d[2][0])+d[0][2]*(d[1][0]*d[2][1]-d[1][1]*d[2][0]);
  return tris.map(([p,q,r])=>det<0?[f(p),f(r),f(q)]:[f(p),f(q),f(r)]);
}
// a printable item from a finished mesh, for printFile
export const meshItem=(name,qty,tris)=>({name,qty,tris});
export function meshInPlace(solids){
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
  return tris;
}
export function meshBounds(tris){
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const t of tris)for(const v of t)for(let k=0;k<3;k++){if(v[k]<lo[k])lo[k]=v[k];if(v[k]>hi[k])hi[k]=v[k];}
  return tris.length?{w:hi[0]-lo[0],d:hi[1]-lo[1],h:hi[2]-lo[2]}:{w:0,d:0,h:0};
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
  const tris=item.tris?toBed(item.tris):meshSolids(item.solids);
  return {name:`print-${slug(item.name)}${item.qty>1?'-x'+item.qty:''}.stl`,data:stlBinary(tris,item.name),tris:tris.length,print:true};
}
