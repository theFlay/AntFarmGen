import {fmt} from './util.js';
/* ---------------- polygon offset (orthogonal polygons) ---------------- */
export function cleanPoly(pts){
  let p=[];
  for(const q of pts){const l=p[p.length-1];if(!l||Math.abs(l[0]-q[0])>1e-9||Math.abs(l[1]-q[1])>1e-9)p.push(q);}
  if(p.length>1){const a=p[0],b=p[p.length-1];if(Math.abs(a[0]-b[0])<1e-9&&Math.abs(a[1]-b[1])<1e-9)p.pop();}
  let changed=true;
  while(changed&&p.length>3){
    changed=false;
    for(let i=0;i<p.length;i++){
      const a=p[(i-1+p.length)%p.length],b=p[i],c=p[(i+1)%p.length];
      const cr=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
      if(Math.abs(cr)<1e-9){p.splice(i,1);changed=true;break;}
    }
  }
  return p;
}
export function offsetPoly(pts,d){
  const p=cleanPoly(pts);if(!d)return p;
  let area=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];area+=a[0]*b[1]-b[0]*a[1];}
  const sgn=area>0?1:-1;
  const nrm=[];
  for(let i=0;i<p.length;i++){
    const a=p[i],b=p[(i+1)%p.length];let dx=b[0]-a[0],dy=b[1]-a[1];const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;
    nrm.push([sgn*dy,-sgn*dx]);
  }
  // miter join, exact for any corner angle
  return p.map((q,i)=>{
    const n0=nrm[(i-1+p.length)%p.length],n1=nrm[i],k=d/(1+n0[0]*n1[0]+n0[1]*n1[1]);
    return [q[0]+k*(n0[0]+n1[0]),q[1]+k*(n0[1]+n1[1])];
  });
}
export const polyD=pts=>'M'+pts.map(q=>fmt(q[0])+' '+fmt(q[1])).join(' L')+' Z';
