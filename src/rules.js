import {interiorEdges,getEdge} from './layout.js';
/* ---------------- rules ---------------- */
export function checkRules(G,L,P,geo){
  const msgs=[];const bad=new Set();
  const ch=geo.ch;
  const act=ch.list.filter(c=>c.active);
  if(!act.length)msgs.push(['error','No active chambers.']);
  const edges=interiorEdges(L,ch);
  const deg=new Map(),spc=new Map(),adjT=new Map();
  for(const c of ch.list){deg.set(c.id,0);spc.set(c.id,0);adjT.set(c.id,[]);}
  const isAct=id=>ch.list[id].active;
  let toInactive=0;
  for(const e of edges){
    const s=getEdge(L,e);
    if(s==='tunnel'){
      deg.set(e.a,deg.get(e.a)+1);deg.set(e.b,deg.get(e.b)+1);
      adjT.get(e.a).push(e.b);adjT.get(e.b).push(e.a);
      if(isAct(e.a)!==isAct(e.b)){toInactive++;bad.add(isAct(e.a)?e.a:e.b);}
    }
    if(s==='sponge'){spc.set(e.a,spc.get(e.a)+1);spc.set(e.b,spc.get(e.b)+1);}
  }
  if(toInactive)msgs.push(['error',`${toInactive} tunnel(s) lead into a sealed chamber.`]);
  if(act.length>1){
    const seen=new Set([act[0].id]),st=[act[0].id];
    while(st.length){const a=st.pop();for(const b of adjT.get(a))if(isAct(b)&&!seen.has(b)){seen.add(b);st.push(b);}}
    const lost=act.filter(c=>!seen.has(c.id));
    if(lost.length){msgs.push(['error',`${lost.length} chamber(s) cannot be reached from the rest.`]);lost.forEach(c=>bad.add(c.id));}
    let lo=0,hi=0;
    for(const c of act){const d=deg.get(c.id);if(d<1){lo++;bad.add(c.id);}if(d>3){hi++;bad.add(c.id);}}
    if(lo)msgs.push(['error',`${lo} chamber(s) have no tunnel.`]);
    if(hi)msgs.push(['error',`${hi} chamber(s) have more than 3 tunnels.`]);
  }
  let sp=0;for(const c of ch.list)if(spc.get(c.id)>2){sp++;bad.add(c.id);}
  if(sp)msgs.push(['error',`${sp} chamber(s) have more than 2 sponges.`]);
  const blocked=geo.ports.filter(p=>!p.cut);
  if(blocked.length)msgs.push(['warn',`${blocked.length} port(s) skipped (${[...new Set(blocked.map(p=>p.why))].join(', ')}). Shown as red crosses.`]);
  const live=geo.ports.filter(p=>p.cut&&p.active);
  if(!live.length&&act.length)msgs.push(['error','No port opens into an active chamber, so the nest has no entrance.']);
  const plugs=geo.ports.filter(p=>p.cut).length;
  if(plugs)msgs.push(['info',`${plugs} port(s) are cut. Plug every port you are not using (${live.length} open into active chambers).`]);
  for(const e of geo.errors)msgs.push(['error',e]);
  for(const w of geo.warnings)msgs.push(['warn',w]);
  const ok=!msgs.some(m=>m[0]==='error');
  if(ok)msgs.unshift(['ok','All rules pass. Ready to export.']);
  return {msgs,ok,bad,deg,spc};
}
