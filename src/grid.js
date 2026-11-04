/* ---------------- derived grid ---------------- */
export function derive(P){
  const t=P.t, depth=P.layers*P.t;
  const baseLen=(P.sizeFor==='queens'&&P.queenLen)?P.queenLen:P.workerLen;
  const pitch=Math.max(5,P.pitchFactor*baseLen);
  let tunnelW=P.tunnelW;
  if(tunnelW==null){
    tunnelW=(P.sizeFor!=='workers'&&P.queenWidth)?P.queenWidth+1.5:Math.round(P.workerLen*0.55*2)/2;
  }
  const tunnelH=P.tunnelH!=null?P.tunnelH:Math.max(3,depth-3);
  const innerW=P.W-2*P.B, innerH=P.H-2*P.B;
  // pick the cell count closest to the target pitch that keeps ports clear of wall lines
  const clear=t/2+tunnelW/2+0.5;
  function bestCount(inner,len,target){
    const ports=[];if(P.portPitch>=5)for(let q=P.portOffset;q<=len-P.portOffset+1e-6;q+=P.portPitch)ports.push(q);
    const n0=Math.max(1,Math.round(inner/target));
    let best=n0,bestHits=1e9;
    for(const n of [n0,n0-1,n0+1,n0-2,n0+2]){
      if(n<1)continue;const cw=inner/n;
      if(Math.abs(cw-target)/target>0.35)continue;
      let hits=0;for(const q of ports)for(let i=1;i<n;i++)if(Math.abs(q-(P.B+i*cw))<clear)hits++;
      if(hits<bestHits){bestHits=hits;best=n;}
      if(hits===0)break;
    }
    return {n:best,adjusted:best!==n0};
  }
  const bc=bestCount(innerW,P.W,pitch), br=bestCount(innerH,P.H,pitch);
  const cols=bc.n, rows=br.n, adjusted=bc.adjusted||br.adjusted;
  const cellW=innerW/cols, cellH=innerH/rows;
  const xs=[],ys=[];
  for(let i=0;i<=cols;i++) xs.push(P.B+i*cellW);
  for(let j=0;j<=rows;j++) ys.push(P.B+j*cellH);
  const service=P.orient==='upright'?'back':'front';
  return {t,depth,pitch,tunnelW,tunnelH,innerW,innerH,cols,rows,cellW,cellH,xs,ys,adjusted,service};
}
