import {interiorEdges,getEdge} from './layout.js';
import {spongeLength} from './generate.js';
import {heatFrameLayers} from './heat.js';
import {coverStand,JOINER_RISE} from './hardware.js';

/* Every chamber must join the whole nest. The starting area is the open part on day one:
   closed doors separate it from the rest, so it must work on its own. */
export function checkRules(G,L,P,geo){
  const msgs=[];const bad=new Set();
  const ch=geo.ch;
  const nest=ch.list.filter(c=>!c.reservoir);
  const act=nest.filter(c=>c.active);
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
    const nestOnly=id=>!ch.list[id].reservoir;
    const reach=(from,ok)=>{const seen=new Set([from]),st=[from];while(st.length){const a=st.pop();for(const b of adjT.get(a))if(ok(b)&&!seen.has(b)){seen.add(b);st.push(b);}}return seen;};
    const all=reach(nest[0].id,nestOnly);
    const lost=nest.filter(c=>!all.has(c.id));
    if(lost.length){msgs.push(['error',`${lost.length} chamber(s) cannot be reached from the rest.`]);lost.forEach(c=>bad.add(c.id));}
    if(act.length>1){
      const seen=reach(act[0].id,isAct);
      const cut=act.filter(c=>!seen.has(c.id));
      if(cut.length){msgs.push(['error',`${cut.length} starting chamber(s) are cut off from the rest of the starting area.`]);cut.forEach(c=>bad.add(c.id));}
    }
    let lo=0,hi=0;
    for(const c of nest){const d=deg.get(c.id);if(d<1){lo++;bad.add(c.id);}if(d>3){hi++;bad.add(c.id);}}
    if(lo)msgs.push(['error',`${lo} chamber(s) have no tunnel.`]);
    if(hi)msgs.push(['error',`${hi} chamber(s) have more than 3 tunnels.`]);
  }
  let sp=0;for(const c of ch.list)if(spc.get(c.id)>2){sp++;bad.add(c.id);}
  if(sp)msgs.push(['error',`${sp} chamber(s) have more than 2 sponges.`]);
  for(const c of ch.list)if(c.reservoir&&deg.get(c.id)>0){msgs.push(['error','A water chamber must not have tunnels.']);bad.add(c.id);}
  for(const [r,c] of L.reservoirs){
    if(P.orient!=='upright')msgs.push(['error','Water chambers are for upright nests. On a flat nest use a water vial.']);
    else if(r+1>=G.rows||getEdge(L,{type:'H',j:r+1,k:c})!=='sponge')msgs.push(['error','A water chamber needs a sponge in the wall directly below it.']);
  }
  if(L.reservoirs.length)msgs.push(['warn','Water chambers hold water, so every joint must be sealed with acrylic cement and leak tested before ants go in.']);
  if(geo.vials.length)msgs.push(['info',`${geo.vials.length} water vial holder(s). Put a cotton wick in the vial mouth and test it for drips first.`]);
  const lone=ch.list.filter(c=>c.cells.length===1&&c.cells[0][2]);
  if(lone.length){msgs.push(['error',`${lone.length} chamber(s) are a lone triangle, too small to use.`]);lone.forEach(c=>bad.add(c.id));}
  const brood=ch.list.filter(c=>c.brood);
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
  const usedN=geo.ports.filter(p=>p.used).length;
  if(plugs)msgs.push(['info',`${plugs} port(s) are cut, ${usedN} marked in use, so ${plugs-usedN} need plugs (${live.length} open into the starting area).`]);
  if(closed&&geo.doors.length)msgs.push(['info',`${closed} door(s) start closed.`]);
  if(closed&&!geo.doors.length)msgs.push(['warn',`${closed} tunnel(s) lead out of the starting area but there are no doors to close them.`]);
  const noTabs=geo.pieces.filter(pc=>pc.notches.length&&!pc.top.length).length;
  if(noTabs)msgs.push(['warn',`${noTabs} tunnel strip(s) are too short for tabs. Shorten the tab length or glue them.`]);
  if(geo.minWeb<1)msgs.push(['warn',`Two cuts in a sheet are only ${geo.minWeb.toFixed(2)}mm apart and may crack.`]);
  if(geo.edgeHeat){
    const ph=G.depth-heatFrameLayers(P)*G.t;
    if(ph<G.tunnelH)msgs.push(['warn',`Ports are only ${ph}mm tall above the heat layer, lower than the ${G.tunnelH}mm tunnels.`]);
    msgs.push(['info',`Border heat: the groove takes cable up to ${P.heatEdgeW}mm wide and ${heatFrameLayers(P)*G.t}mm deep. Always use a thermostat.`]);
  }
  if(P.joinerQty>0&&!geo.joints.length)msgs.push(['warn','Panel joiners need Slots for joining panels on, and a border of at least 12mm.']);
  if(P.coverType==='whole'&&geo.joints.length&&coverStand(G,P)<JOINER_RISE+1)msgs.push(['warn',`A ${coverStand(G,P)}mm cover gap is too low to clear panel joiners, which stick up about ${JOINER_RISE}mm.`]);
  if(P.activeCount>0&&act.length>P.activeCount)msgs.push(['warn',`The starting area has ${act.length} chambers, more than the ${P.activeCount} set under Auto layout. It must hold a port, a sponge and a brood chamber, and the Starting area tool can also change it.`]);
  const BEDS={speedy300:[737,432,'Speedy 300'],speedy360:[813,508,'Speedy 360']},bed=BEDS[P.bed];
  if(bed){
    const fits=(w,h)=>(w<=bed[0]&&h<=bed[1])||(w<=bed[1]&&h<=bed[0]);
    if(!fits(P.W,P.H))msgs.push(['error',`A ${P.W} x ${P.H}mm panel is too big for the ${bed[2]} bed (${bed[0]} x ${bed[1]}mm).`]);
    if(!fits(P.stockW,P.stockH))msgs.push(['error',`${P.stockW} x ${P.stockH}mm stock is too big for the ${bed[2]} bed (${bed[0]} x ${bed[1]}mm).`]);
  }
  if(geo.heat)msgs.push(['info','Heat channel added. Always run the cable from a thermostat, and keep it well below the point where acrylic softens. Keep part of the nest unheated so the ants can choose.']);
  const shortA=geo.pieces.filter(p=>p.kind==='angle'&&!p.top.length).length;
  if(shortA)msgs.push(['warn',`${shortA} angled strip(s) are too short for tabs and rely on glue alone. A larger jog size fixes this.`]);
  if(P.ceilingFinish==='frosted')msgs.push(['info','A frosted top or front sheet blurs the view into the nest.']);
  const nAngle=geo.pieces.filter(p=>p.kind==='angle').length;
  if(nAngle)msgs.push(['info',`${nAngle} angled strip(s). Their joints leave small wedge gaps: seal them with thickened acrylic cement, then sand, and let it cure fully before ants go in.`]);
  for(const e of geo.errors)msgs.push(['error',e]);
  for(const w of geo.warnings)msgs.push(['warn',w]);
  const ok=!msgs.some(m=>m[0]==='error');
  if(ok)msgs.unshift(['ok','All rules pass. Ready to export.']);
  return {msgs,ok,bad,deg,spc};
}
