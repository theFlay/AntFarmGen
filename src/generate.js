import {mulberry32,shuffle} from './util.js';
import {emptyLayout,chambers,adjacency,chamberCenter,interiorEdges,getEdge,setEdge} from './layout.js';
/* ---------------- auto generator ---------------- */
export function generate(G,P){
  const rnd=mulberry32(((P.seed|0)>>>0)||1);
  const pick=a=>a[Math.floor(rnd()*a.length)];
  const L=emptyLayout(G.cols,G.rows);
  const want=Math.max(0,Math.round(P.brood||0));
  if(G.cols>=2&&G.rows>=2){
    for(let n=0,tries=0;n<want&&tries<400;tries++){
      const r=Math.floor(rnd()*(G.rows-1)),c=Math.floor(rnd()*(G.cols-1));
      if(L.merges.some(m=>Math.abs(m.r-r)<2&&Math.abs(m.c-c)<2))continue;
      L.merges.push({r,c});n++;
    }
  }
  const ch=chambers(L), adj=adjacency(L,ch);
  const total=ch.list.length, ac=Math.round(P.activeCount||0);
  const tgt={left:[P.B,P.H/2],right:[P.W-P.B,P.H/2],top:[P.W/2,P.B],bottom:[P.W/2,P.H-P.B],center:[P.W/2,P.H/2]}[P.growFrom]||[P.W/2,P.H/2];
  const portCh=new Set(portCells(G,P).map(p=>ch.id[p.cell[0]][p.cell[1]]));
  function growRegion(){
    if(!(ac>0&&ac<total))return new Set(ch.list.map(c=>c.id));
    let best=null,bd=1e18;
    for(const c of ch.list){
      if(P.growFrom!=='center'&&portCh.size&&!portCh.has(c.id))continue;
      const [x,y]=chamberCenter(G,c);const d=(x-tgt[0])**2+(y-tgt[1])**2;if(d<bd){bd=d;best=c.id;}
    }
    const set=new Set([best]);
    while(set.size<ac){
      const front=[];for(const a of set)for(const b of adj.get(a).keys())if(!set.has(b))front.push(b);
      if(!front.length)break;set.add(pick(front));
    }
    // make sure the active area reaches at least one port: add the shortest path to one
    if(portCh.size&&![...set].some(id=>portCh.has(id))){
      const prev=new Map(),q=[...set];for(const a of q)prev.set(a,null);
      let hit=null;
      while(q.length&&hit===null){const a=q.shift();for(const b of adj.get(a).keys())if(!prev.has(b)){prev.set(b,a);if(portCh.has(b)){hit=b;break;}q.push(b);}}
      for(let x=hit;x!==null&&x!==undefined&&!set.has(x);x=prev.get(x))set.add(x);
    }
    return set;
  }
  // spanning tree with at most 3 tunnels per chamber; regrow the active area if that is impossible
  let activeSet,ids,deg=new Map(),done=false;
  for(let region=0;region<40&&!done;region++){
    activeSet=growRegion();ids=[...activeSet];
    const last=region===39;
    for(let attempt=0;attempt<(last?30:15)&&!done;attempt++){
      const cap=(last&&attempt>=20)?99:3;
      for(let j=0;j<=G.rows;j++)L.H[j].fill('solid');
      for(let r=0;r<G.rows;r++)L.V[r].fill('solid');
      deg=new Map(ids.map(i=>[i,0]));
      const inT=new Set([pick(ids)]);
      while(inT.size<ids.length){
        const cand=[];
        for(const a of inT){if(deg.get(a)>=cap)continue;for(const [b,es] of adj.get(a))if(activeSet.has(b)&&!inT.has(b)&&deg.get(b)<cap)cand.push([a,b,es]);}
        if(!cand.length)break;
        const [a,b,es]=pick(cand);setEdge(L,pick(es),'tunnel');
        deg.set(a,deg.get(a)+1);deg.set(b,deg.get(b)+1);inT.add(b);
      }
      if(inT.size===ids.length)done=true;
    }
  }
  for(let r=0;r<G.rows;r++)L.active[r].fill(true);
  for(const c of ch.list)if(!activeSet.has(c.id))for(const [r,cc] of c.cells)L.active[r][cc]=false;
  // extra loops
  const extra=Math.round(Math.max(0,P.loops||0)*ids.length);
  const pairs=[];for(const a of ids)for(const [b,es] of adj.get(a))if(a<b&&activeSet.has(b))pairs.push([a,b,es]);
  shuffle(pairs,rnd);let added=0;
  for(const [a,b,es] of pairs){
    if(added>=extra)break;
    if(deg.get(a)>=3||deg.get(b)>=3)continue;
    if(es.some(e=>getEdge(L,e)==='tunnel'))continue;
    setEdge(L,pick(es),'tunnel');deg.set(a,deg.get(a)+1);deg.set(b,deg.get(b)+1);added++;
  }
  // sponges
  const nS=Math.max(0,Math.round(P.sponges||0));
  if(nS>0){
    const cand=[];
    for(const e of interiorEdges(L,ch)){
      if(!activeSet.has(e.a)||!activeSet.has(e.b))continue;
      if(getEdge(L,e)!=='solid')continue;
      const len=e.type==='H'?G.cellW:G.cellH;
      if(spongeLength(P,G,len)<8)continue;
      let mx,my;
      if(e.type==='H'){mx=(G.xs[e.k]+G.xs[e.k+1])/2;my=G.ys[e.j];}else{mx=G.xs[e.i];my=(G.ys[e.r]+G.ys[e.r+1])/2;}
      const u=(mx-P.B)/G.innerW,v=(my-P.B)/G.innerH;
      const base={left:1-u,right:u,top:1-v,bottom:v,none:0.5}[P.dampSide]??0.5;
      cand.push({e,score:base+rnd()*(P.dampSide==='none'?1:0.25)});
    }
    cand.sort((x,y)=>y.score-x.score);
    const sc=new Map();let placed=0;
    for(const {e} of cand){
      if(placed>=nS)break;
      if((sc.get(e.a)||0)>=2||(sc.get(e.b)||0)>=2)continue;
      setEdge(L,e,'sponge');sc.set(e.a,(sc.get(e.a)||0)+1);sc.set(e.b,(sc.get(e.b)||0)+1);placed++;
    }
  }
  return L;
}
// port positions and the cell each one lands in (ignores ports that sit on a grid line)
export function portCells(G,P){
  const out=[],clear=G.t/2+G.tunnelW/2+0.5;
  if(P.portPitch<5)return out;
  for(const [side,len] of [['top',P.W],['bottom',P.W],['left',P.H],['right',P.H]]){
    for(let q=P.portOffset;q<=len-P.portOffset+1e-6;q+=P.portPitch){
      if(q-G.tunnelW/2<P.B+1||q+G.tunnelW/2>len-P.B-1)continue;
      const horiz=side==='top'||side==='bottom';
      const lines=horiz?G.xs:G.ys;
      if(lines.slice(1,-1).some(x=>Math.abs(q-x)<clear))continue;
      const cell=horiz?[side==='top'?0:G.rows-1,Math.min(G.cols-1,Math.floor((q-P.B)/G.cellW))]
                      :[Math.min(G.rows-1,Math.floor((q-P.B)/G.cellH)),side==='left'?0:G.cols-1];
      out.push({side,pos:q,cell});
    }
  }
  return out;
}
// pocket length is capped so two pockets meeting at a chamber corner can never touch
export function spongeLength(P,G,edgeLen){return Math.min(P.spongeLen,edgeLen-P.spongeD-4*G.t-1);}
