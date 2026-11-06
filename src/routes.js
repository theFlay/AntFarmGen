import {chamberCenter,interiorEdges,getEdge} from './layout.js';

// Every way between two chambers along the tunnels, shortest first. A route never visits a chamber
// twice. It searches a limited number of steps, so a heavily looped nest cannot freeze the page.
export function findRoutes(G,L,ch,from,to,max=4,budget=20000){
  const links=new Map(ch.list.map(c=>[c.id,[]]));
  for(const e of interiorEdges(L,ch)){
    if(getEdge(L,e)!=='tunnel')continue;
    const door=e.type==='H'?[(G.xs[e.k]+G.xs[e.k+1])/2,G.ys[e.j]]:[G.xs[e.i],(G.ys[e.r]+G.ys[e.r+1])/2];
    links.get(e.a).push({to:e.b,door});links.get(e.b).push({to:e.a,door});
  }
  const mid=id=>chamberCenter(G,ch.list[id]);
  const found=[],seen=new Set([from]),ids=[from],doors=[];
  (function walk(a){
    if(budget--<=0)return;
    if(a===to){found.push({ids:ids.slice(),doors:doors.slice()});return;}
    for(const l of links.get(a)){
      if(seen.has(l.to))continue;
      seen.add(l.to);ids.push(l.to);doors.push(l.door);
      walk(l.to);
      seen.delete(l.to);ids.pop();doors.pop();
    }
  })(from);
  for(const r of found){
    r.pts=[mid(r.ids[0])];
    r.doors.forEach((d,i)=>r.pts.push(d,mid(r.ids[i+1])));
    r.mm=r.pts.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-r.pts[i][0],p[1]-r.pts[i][1]),0);
    r.closed=r.ids.slice(1).filter((id,i)=>!(ch.list[id].active&&ch.list[r.ids[i]].active)).length;
  }
  return found.sort((a,b)=>a.mm-b.mm).slice(0,max);
}
