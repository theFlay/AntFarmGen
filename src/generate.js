import {mulberry32,shuffle} from './util.js';
import {emptyLayout,chambers,adjacency,chamberCenter,interiorEdges,getEdge,setEdge} from './layout.js';

/* Every chamber is built and joined up. The active setting only picks which doors start open,
   so the cut files do not depend on it. The starting area always holds a port, a sponge and
   a brood chamber when those exist. */
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
  const ids=ch.list.map(c=>c.id);
  // spanning tree with at most 3 tunnels per chamber, relaxed only if that proves impossible
  let deg=new Map(),done=false;
  for(let attempt=0;attempt<60&&!done;attempt++){
    const cap=attempt>=50?99:3;
    for(let j=0;j<=G.rows;j++)L.H[j].fill('solid');
    for(let r=0;r<G.rows;r++)L.V[r].fill('solid');
    deg=new Map(ids.map(i=>[i,0]));
    const inT=new Set([pick(ids)]);
    while(inT.size<ids.length){
      const cand=[];
      for(const a of inT){if(deg.get(a)>=cap)continue;for(const [b,es] of adj.get(a))if(!inT.has(b)&&deg.get(b)<cap)cand.push([a,b,es]);}
      if(!cand.length)break;
      const [a,b,es]=pick(cand);setEdge(L,pick(es),'tunnel');
      deg.set(a,deg.get(a)+1);deg.set(b,deg.get(b)+1);inT.add(b);
    }
    if(inT.size===ids.length)done=true;
  }
  // extra loops
  const extra=Math.round(Math.max(0,P.loops||0)*ids.length);
  const pairs=[];for(const a of ids)for(const [b,es] of adj.get(a))if(a<b)pairs.push([a,b,es]);
  shuffle(pairs,rnd);let added=0;
  for(const [a,b,es] of pairs){
    if(added>=extra)break;
    if(deg.get(a)>=3||deg.get(b)>=3)continue;
    if(es.some(e=>getEdge(L,e)==='tunnel'))continue;
    setEdge(L,pick(es),'tunnel');deg.set(a,deg.get(a)+1);deg.set(b,deg.get(b)+1);added++;
  }
  // starting area, grown along tunnels
  const start=startArea(G,P,L,ch,rnd,pick);
  for(let r=0;r<G.rows;r++)L.active[r].fill(true);
  for(const c of ch.list)if(!start.has(c.id))for(const [r,cc] of c.cells)L.active[r][cc]=false;
  placeSponges(G,P,L,ch,start,rnd);
  return L;
}

function tunnelGraph(L,ch){
  const g=new Map(ch.list.map(c=>[c.id,new Set()]));
  for(const e of interiorEdges(L,ch))if(getEdge(L,e)==='tunnel'){g.get(e.a).add(e.b);g.get(e.b).add(e.a);}
  return g;
}
// shortest path along tunnels from the set to any target; returns the ids to add
function pathTo(g,set,targets){
  const prev=new Map(),q=[...set];for(const a of q)prev.set(a,null);
  while(q.length){
    const a=q.shift();
    if(targets.has(a)){const out=[];for(let x=a;x!==null&&!set.has(x);x=prev.get(x))out.push(x);return out;}
    for(const b of g.get(a))if(!prev.has(b)){prev.set(b,a);q.push(b);}
  }
  return null;
}
function startArea(G,P,L,ch,rnd,pick){
  const total=ch.list.length,ac=Math.round(P.activeCount||0);
  if(!(ac>0&&ac<total))return new Set(ch.list.map(c=>c.id));
  const g=tunnelGraph(L,ch);
  const tgt={left:[P.B,P.H/2],right:[P.W-P.B,P.H/2],top:[P.W/2,P.B],bottom:[P.W/2,P.H-P.B],center:[P.W/2,P.H/2]}[P.growFrom]||[P.W/2,P.H/2];
  const dist=c=>{const [x,y]=chamberCenter(G,c);return (x-tgt[0])**2+(y-tgt[1])**2;};
  const portCh=new Set(portCells(G,P).map(p=>ch.id[p.cell[0]][p.cell[1]]));
  const pool=P.growFrom!=='center'&&portCh.size?ch.list.filter(c=>portCh.has(c.id)):ch.list;
  const seed=pool.slice().sort((a,b)=>dist(a)-dist(b))[0];
  const set=new Set([seed.id]);
  const addPath=t=>{const p=pathTo(g,set,t);if(p)for(const x of p)set.add(x);};
  if(portCh.size&&!portCh.has(seed.id))addPath(portCh);
  const brood=ch.list.filter(c=>c.merged).sort((a,b)=>dist(a)-dist(b));
  brood.forEach((b,i)=>{
    if(set.has(b.id))return;
    const p=pathTo(g,set,new Set([b.id]));
    if(p&&(i===0||set.size+p.length<=ac))for(const x of p)set.add(x);
  });
  while(set.size<ac){
    const front=[];for(const a of set)for(const b of g.get(a))if(!set.has(b))front.push(b);
    if(!front.length)break;set.add(pick(front));
  }
  return set;
}
function placeSponges(G,P,L,ch,start,rnd){
  const nS=Math.max(0,Math.round(P.sponges||0));
  if(nS<=0||spongeLength(P,G)<8)return;
  const cand=[];
  for(const e of interiorEdges(L,ch)){
    if(getEdge(L,e)!=='solid')continue;
    let mx,my;
    if(e.type==='H'){mx=(G.xs[e.k]+G.xs[e.k+1])/2;my=G.ys[e.j];}else{mx=G.xs[e.i];my=(G.ys[e.r]+G.ys[e.r+1])/2;}
    const u=(mx-P.B)/G.innerW,v=(my-P.B)/G.innerH;
    const base={left:1-u,right:u,top:1-v,bottom:v,none:0.5}[P.dampSide]??0.5;
    const inStart=(start.has(e.a)?1:0)+(start.has(e.b)?1:0);
    cand.push({e,inStart,score:base+rnd()*(P.dampSide==='none'?1:0.25)});
  }
  cand.sort((x,y)=>y.score-x.score);
  const sc=new Map();let placed=0;
  const put=e=>{setEdge(L,e,'sponge');sc.set(e.a,(sc.get(e.a)||0)+1);sc.set(e.b,(sc.get(e.b)||0)+1);placed++;};
  // the starting area always gets water first, ideally on a wall with both sides open
  const first=cand.find(c=>c.inStart===2)||cand.find(c=>c.inStart===1);
  if(first)put(first.e);
  for(const {e} of cand){
    if(placed>=nS)break;
    if(getEdge(L,e)!=='solid')continue;
    if((sc.get(e.a)||0)>=2||(sc.get(e.b)||0)>=2)continue;
    put(e);
  }
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
// Pocket length is capped so two pockets meeting at a chamber corner can never touch.
// It uses the shorter cell side so every sponge part is the same size and interchangeable.
export function spongeLength(P,G){return Math.min(P.spongeLen,Math.min(G.cellW,G.cellH)-P.spongeD-4*G.t-1);}
