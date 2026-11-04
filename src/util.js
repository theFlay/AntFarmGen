export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
export const fmt=n=>(Math.round(n*1000)/1000).toString();
export const f1=n=>(Math.round(n*10)/10).toString();
export function shuffle(a,rnd){for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
// true if two convex polygons overlap by more than tol
export function polysOverlap(a,b,tol=1e-3){
  for(const poly of [a,b])for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length];
    const nx=q[1]-p[1],ny=p[0]-q[0],l=Math.hypot(nx,ny)||1;
    let a0=1e18,a1=-1e18,b0=1e18,b1=-1e18;
    for(const v of a){const d=(v[0]*nx+v[1]*ny)/l;a0=Math.min(a0,d);a1=Math.max(a1,d);}
    for(const v of b){const d=(v[0]*nx+v[1]*ny)/l;b0=Math.min(b0,d);b1=Math.max(b1,d);}
    if(Math.min(a1,b1)-Math.max(a0,b0)<=tol)return false;
  }
  return true;
}
export const rectPts=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
