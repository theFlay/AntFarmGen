// Heat channel for flat nests: a snaking slot through extra layers under the floor sheet,
// closed by a base sheet. The cable enters and leaves at one fixed height, so panels chain.
export const heatOn=P=>!!P.heatChannel&&P.orient==='flat';
// extra thickness under the floor sheet
export const heatDepth=(G,P)=>heatOn(P)?P.heatLayers*G.t+P.S:0;
export const heatEntry=P=>Math.max(P.B+P.heatW,P.portOffset);

// centre line of the channel, from the left edge to the right edge at the same height
export function heatPath(P){
  const {W,H,B}=P,cw=P.heatW,y0=heatEntry(P);
  const xL=B+cw,xR=W-B-3*cw,xE=W-B-cw;
  const lanes=[];
  for(let y=y0;y<=H-B-cw+1e-9;y+=Math.max(P.heatPitch,cw+6))lanes.push(y);
  if(lanes.length%2===0)lanes.pop(); // an odd count ends on the right, ready to return and exit
  if(lanes.length<=1||xR<=xL)return [[0,y0],[W,y0]];
  const pts=[[0,y0]];
  lanes.forEach((y,i)=>{
    const far=i%2===0?xR:xL,near=i%2===0?xL:xR;
    if(i>0)pts.push([near,y]);
    pts.push([far,y]);
  });
  pts.push([xE,lanes[lanes.length-1]],[xE,y0],[W,y0]);
  return pts;
}
export function offsetLine(pts,d){
  const n=[];
  for(let i=0;i+1<pts.length;i++){
    const a=pts[i],b=pts[i+1],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
    n.push([(b[1]-a[1])/l,-(b[0]-a[0])/l]);
  }
  return pts.map((q,i)=>{
    const p=n[Math.max(0,i-1)],c=n[Math.min(n.length-1,i)];
    if(i===0||i===pts.length-1)return [q[0]+d*(i===0?c:p)[0],q[1]+d*(i===0?c:p)[1]];
    const k=d/(1+p[0]*c[0]+p[1]*c[1]); // miter: works for corners and for straight-through points
    return [q[0]+k*(p[0]+c[0]),q[1]+k*(p[1]+c[1])];
  });
}
// the channel splits a layer in two: the part above it and the part below it
export function heatLayer(P){
  const path=heatPath(P),h=P.heatW/2,{W,H}=P;
  const upper=offsetLine(path,h).concat([[W,0],[0,0]]);
  const lower=offsetLine(path,-h).concat([[W,H],[0,H]]);
  return {path,pieces:[upper,lower]};
}

/* Border heat: a groove in the bottom frame layer, inside the row of pegs. That layer stays whole
   at the ports, so the cable passes under them and the ports sit just above it. */
const EDGES=['top','right','bottom','left'];
const HEAT_RIM=3; // acrylic left inside the groove: any thinner and the long ring snaps
export const heatEdges=P=>EDGES.filter(e=>P['heat'+e[0].toUpperCase()+e.slice(1)]);
export const borderHeatOn=P=>heatEdges(P).length>0;
export const heatFrameLayers=P=>borderHeatOn(P)?Math.min(P.heatEdgeLayers,P.layers-1):0;
export const borderRow=P=>borderHeatOn(P)?Math.min(7.5,P.B/2):P.B/2;
// smallest border that keeps the groove clear of pegs and joiner slots
export const minHeatBorder=P=>7.5+4+1.5+P.heatEdgeW+HEAT_RIM;

function runsOf(on){
  const idx=on.map(e=>EDGES.indexOf(e));
  if(idx.length===4)return [[0,1,2,3]];
  const start=idx.find(i=>!idx.includes((i+3)%4));
  const runs=[];
  for(let n=0,i=start;n<4;n++,i=(i+1)%4){
    if(!idx.includes(i))continue;
    if(runs.length&&idx.includes((i+3)%4))runs[runs.length-1].push(i);else runs.push([i]);
  }
  return runs;
}
const perimT=(P,[x,y])=>{
  const {W,H}=P;
  if(y<=1e-9)return x;
  if(x>=W-1e-9)return W+y;
  if(y>=H-1e-9)return W+H+(W-x);
  return 2*W+H+(H-y);
};
// corners met going clockwise round the panel from a to b
function arc(P,a,b){
  const {W,H}=P,len=2*(W+H),ta=perimT(P,a);
  let tb=perimT(P,b);if(tb<=ta)tb+=len;
  return [[0,[0,0]],[W,[W,0]],[W+H,[W,H]],[2*W+H,[0,H]],[len,[0,0]],[len+W,[W,0]],[len+W+H,[W,H]],[len+2*W+H,[0,H]]]
    .filter(([t])=>t>ta+1e-9&&t<tb-1e-9).map(c=>c[1]);
}
export function borderHeat(P){
  const on=heatEdges(P);
  if(!on.length)return null;
  const {W,H,B}=P,cw=P.heatEdgeW,d=B-cw/2-HEAT_RIM,k=cw+6;
  const corner=[[d,d],[W-d,d],[W-d,H-d],[d,H-d]];
  const startOf=[[0,d],[W-d,0],[W,H-d],[d,H]],endOf=[[W,d],[W-d,H],[0,H-d],[d,0]];
  const paths=runsOf(on).map(run=>{
    if(run.length===4)return [[0,d],corner[1],corner[2],corner[3],[d,d+k],[0,d+k]];
    const pts=[startOf[run[0]]];
    for(let i=1;i<run.length;i++)pts.push(corner[run[i]]);
    pts.push(endOf[run[run.length-1]]);
    return pts;
  }).sort((a,b)=>perimT(P,a[0])-perimT(P,b[0]));
  const h=cw/2,pieces=[];
  // the strip outside each groove
  for(const p of paths){
    const o=offsetLine(p,h);
    pieces.push({poly:o.concat(arc(P,o[0],o[o.length-1]).reverse())});
  }
  // everything inside, with the nest opening as a hole
  const inner=[];
  paths.forEach((p,i)=>{
    const o=offsetLine(p,-h),next=offsetLine(paths[(i+1)%paths.length],-h);
    inner.push(...o,...arc(P,o[o.length-1],next[0]));
  });
  pieces.push({poly:inner,hole:[[B,B],[W-B,B],[W-B,H-B],[B,H-B]]});
  // where each groove leaves through the border, so pegs keep clear
  const sideOf=([x,y])=>y<=1e-9?'top':y>=H-1e-9?'bottom':x<=1e-9?'left':'right';
  const stubs=paths.flatMap(p=>[p[0],p[p.length-1]]).map(q=>{const s=sideOf(q);return {side:s,pos:s==='top'||s==='bottom'?q[0]:q[1]};});
  return {paths,pieces,stubs};
}
