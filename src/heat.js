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
function offsetLine(pts,d){
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
