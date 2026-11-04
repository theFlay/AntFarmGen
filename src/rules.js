import {interiorEdges,getEdge} from './layout.js';
import {spongeLength} from './generate.js';

/* Every chamber must join the whole nest. The starting area is the open part on day one:
   closed doors separate it from the rest, so it must work on its own. */
export function checkRules(G,L,P,geo){
  const msgs=[];const bad=new Set();
  const ch=geo.ch;
  const act=ch.list.filter(c=>c.active);
  if(!act.length)msgs.push(['error','No chambers in the starting area.']);
  const edges=interiorEdges(L,ch);
  const deg=new Map(),spc=new Map(),adjT=new Map();
  for(const c of ch.list){deg.set(c.id,0);spc.set(c.id,0);adjT.set(c.id,[]);}
  const isAct=id=>ch.list[id].active;
  let closed=0,spongesN=0,startSponge=0;
  for(const e of edges){
    const s=getEdge(L,e);
    if(s==='tunnel'){
      deg.set(e.a,deg.get(e.a)+1);deg.set(e.b,deg.get(e.b)+1);
      adjT.get(e.a).push(e.b);adjT.get(e.b).push(e.a);
      if(!isAct(e.a)||!isAct(e.b))closed++;
    }
    if(s==='sponge'){
      spc.set(e.a,spc.get(e.a)+1);spc.set(e.b,spc.get(e.b)+1);spongesN++;
      if(isAct(e.a)||isAct(e.b))startSponge++;
    }
  }
  if(ch.list.length>1){
    const reach=(from,ok)=>{const seen=new Set([from]),st=[from];while(st.length){const a=st.pop();for(const b of adjT.get(a))if(ok(b)&&!seen.has(b)){seen.add(b);st.push(b);}}return seen;};
    const all=reach(ch.list[0].id,()=>true);
    const lost=ch.list.filter(c=>!all.has(c.id));
    if(lost.length){msgs.push(['error',`${lost.length} chamber(s) cannot be reached from the rest.`]);lost.forEach(c=>bad.add(c.id));}
    if(act.length>1){
      const seen=reach(act[0].id,isAct);
      const cut=act.filter(c=>!seen.has(c.id));
      if(cut.length){msgs.push(['error',`${cut.length} starting chamber(s) are cut off from the rest of the starting area.`]);cut.forEach(c=>bad.add(c.id));}
    }
    let lo=0,hi=0;
    for(const c of ch.list){const d=deg.get(c.id);if(d<1){lo++;bad.add(c.id);}if(d>3){hi++;bad.add(c.id);}}
    if(lo)msgs.push(['error',`${lo} chamber(s) have no tunnel.`]);
    if(hi)msgs.push(['error',`${hi} chamber(s) have more than 3 tunnels.`]);
  }
  let sp=0;for(const c of ch.list)if(spc.get(c.id)>2){sp++;bad.add(c.id);}
  if(sp)msgs.push(['error',`${sp} chamber(s) have more than 2 sponges.`]);
  const brood=ch.list.filter(c=>c.merged);
  if(brood.length&&!brood.some(c=>c.active))msgs.push(['error','The starting area has no brood chamber.']);
  const wantS=Math.max(0,Math.round(P.sponges||0));
  if(wantS>0&&spongeLength(P,G)>=8){
    if(act.length&&!startSponge)msgs.push(['error','No sponge touches the starting area, so the ants have no water.']);
    if(spongesN<wantS)msgs.push(['warn',`Only ${spongesN} of ${wantS} sponges are in the layout.`]);
  }else if(wantS>0)msgs.push(['warn','Sponge pockets do not fit in cells this small, so this nest has no water source.']);
  const blocked=geo.ports.filter(p=>!p.cut);
  if(blocked.length)msgs.push(['warn',`${blocked.length} port(s) skipped (${[...new Set(blocked.map(p=>p.why))].join(', ')}). Shown as red crosses.`]);
  const live=geo.ports.filter(p=>p.cut&&p.active);
  if(!live.length&&act.length)msgs.push(['error','No port opens into the starting area, so the nest has no entrance.']);
  const plugs=geo.ports.filter(p=>p.cut).length;
  if(plugs)msgs.push(['info',`${plugs} port(s) are cut. Plug every port you are not using (${live.length} open into the starting area).`]);
  if(closed&&geo.doors.length)msgs.push(['info',`${closed} door(s) start closed.`]);
  if(closed&&!geo.doors.length)msgs.push(['warn',`${closed} tunnel(s) lead out of the starting area but there are no doors to close them.`]);
  const noTabs=geo.pieces.filter(pc=>pc.notches.length&&!pc.top.length).length;
  if(noTabs)msgs.push(['warn',`${noTabs} tunnel strip(s) are too short for tabs. Shorten the tab length or glue them.`]);
  if(geo.minWeb<1)msgs.push(['warn',`Two cuts in a sheet are only ${geo.minWeb.toFixed(2)}mm apart and may crack.`]);
  for(const e of geo.errors)msgs.push(['error',e]);
  for(const w of geo.warnings)msgs.push(['warn',w]);
  const ok=!msgs.some(m=>m[0]==='error');
  if(ok)msgs.unshift(['ok','All rules pass. Ready to export.']);
  return {msgs,ok,bad,deg,spc};
}
