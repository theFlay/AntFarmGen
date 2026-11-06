import {fmt,rectPts} from './util.js';
import {polyD,offsetPoly} from './offset.js';
import {stripOutline} from './strip.js';
import {drawTopdown} from './draw.js';
import {doorType} from './doors.js';
import {heatFrameLayers} from './heat.js';
import {svgToDxf} from './dxf.js';
import {escapeHtml} from './sanitize.js';
import {hardwareParts,pegPart,keyPart,PEG_FIT,JOIN_LEG} from './hardware.js';
import {boltDia,printed} from './params.js';
import {recorder,shapesToSolids,partSolid,printFile} from './stl.js';

/* ---------------- export ---------------- */
export function svgDoc(w,h,body,title){
  // 1mm of padding keeps kerf-offset outlines inside the viewBox
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(w+2)}mm" height="${fmt(h+2)}mm" viewBox="-1 -1 ${fmt(w+2)} ${fmt(h+2)}">\n<title>${title}</title>\n${body}\n</svg>\n`;
}
// finds a spot for an engraved ID that stays clear of every tunnel notch
export function labelX(w,notches,tunnelW,id){
  const hw=id.length*0.9+1;
  for(let d=0;d<=w/2;d+=1)for(const x of [w/2-d,w/2+d]){
    if(x<hw||x>w-hw)continue;
    if(notches.every(n=>Math.abs(n-x)>=tunnelW/2+hw))return x;
  }
  return null;
}
// drawing helpers that apply the kerf offset
export function pen(P){
  const k2=P.kerf/2, cut=`fill="none" stroke="${P.cutColor}" stroke-width="0.01"`;
  const cutPoly=(pts,d,tx=0,ty=0)=>`<path d="${polyD(offsetPoly(pts,d).map(q=>[q[0]+tx,q[1]+ty]))}" ${cut}/>`;
  return {
    k2,cutPoly,
    outline:(pts,tx=0,ty=0)=>cutPoly(pts,k2,tx,ty),
    cutout:(pts,tx=0,ty=0)=>cutPoly(pts,-k2,tx,ty),
    rect:s=>cutPoly(s.poly||rectPts(s.x0,s.y0,s.x1,s.y1),-k2),
    hole:(x,y,dia)=>`<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(Math.max(0.05,dia/2-k2))}" ${cut}/>`,
    txt:(x,y,s,size,rot)=>`<text x="${fmt(x)}" y="${fmt(y)}" font-size="${fmt(size)}" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" fill="${P.engraveColor}" stroke="none"${rot?` transform="rotate(${rot} ${fmt(x)} ${fmt(y)})"`:''}>${escapeHtml(s)}</text>`,
  };
}
// a slot for a peg or cover leg, lying along the border
export function borderSlot(o,len,t,fit){
  const hl=len/2+fit,ht=t/2+fit;
  return o.along==='x'?{x0:o.x-hl,x1:o.x+hl,y0:o.y-ht,y1:o.y+ht}:{x0:o.x-ht,x1:o.x+ht,y0:o.y-hl,y1:o.y+hl};
}
function fastenerCuts(G,P,geo,d){
  if(P.fastener==='bolt')return geo.fasteners.map(o=>d.hole(o.x,o.y,boltDia(P)));
  if(P.fastener==='peg')return geo.fasteners.map(o=>d.rect(borderSlot(o,P.pegW,G.t,PEG_FIT)));
  return [];
}
function socketCuts(G,geo,d,tab){
  return geo.sockets.map(o=>d.rect(borderSlot(o,tab,G.t,PEG_FIT))).concat(geo.joints.map(o=>d.rect(borderSlot(o,JOIN_LEG,G.t,PEG_FIT))));
}

// the shapes of each flat piece, drawn with any pen: the SVG pen for cutting, the recorder for printing
function sheetBody(G,P,geo,pn,side,slots,vents,label){
  const W=P.W,H=P.H,b=[],sockTab=geo.socketL-4;
  const fillOn=s=>P.fillSide==='both'||P.fillSide===s||(P.fillSide==='service'&&G.service===s);
  b.push(pn.outline(rectPts(0,0,W,H)));
  for(const s of slots)b.push(pn.rect(s));
  if(G.service===side)for(const s of [...geo.doorSlots,...geo.sensorBoxes,...geo.vialSlots])b.push(pn.rect(s));
  b.push(...fastenerCuts(G,P,geo,pn));
  b.push(...socketCuts(G,geo,pn,sockTab));
  if(vents)for(const v of geo.vents)b.push(pn.hole(v.x,v.y,P.ventD));
  if(fillOn(side))for(const f of geo.fills)b.push(pn.hole(f.x,f.y,P.fillD));
  if(P.engraveIds)b.push(pn.txt(W/2,Math.min(3,P.B*0.2),label,Math.min(3,P.B*0.2)));
  return b;
}
function frameBody(G,P,geo,pn,pieces){
  const b=[];
  for(const f of pieces){b.push(pn.outline(f.poly));if(f.hole)b.push(pn.cutout(f.hole));}
  b.push(...fastenerCuts(G,P,geo,pn),...socketCuts(G,geo,pn,geo.socketL-4));
  return b;
}
const coverBody=(G,P,geo,pn)=>[pn.outline(rectPts(0,0,P.W,P.H)),...geo.sockets.map(o=>pn.rect(borderSlot(o,geo.socketL-4,G.t,PEG_FIT)))];
const heatTies=(G,P,geo,pn)=>[...fastenerCuts(G,P,geo,pn),...geo.joints.map(o=>pn.rect(borderSlot(o,JOIN_LEG,G.t,PEG_FIT)))];
const sheetLabels=P=>P.orient==='flat'?['TOP SHEET (top face up, north edge)','FLOOR SHEET (inside face up, north edge)']:['FRONT (outside face up, top edge)','BACK (inside face up, top edge)'];
// wall strips, ready to place on a cut sheet or a print plate
function stripItems(G,P,geo){
  return geo.pieces.map(pc=>({w:pc.e-pc.s,h:G.depth+2*P.S,frost:pc.kind==='wall'||pc.kind==='angle',draw(pn,x,y){
    const ty=y+P.S,o=[pn.outline(stripOutline(pc,G,P),x,ty)];
    for(const [a0,a1] of pc.windows)o.push(pn.cutout(rectPts(a0,2,a1,G.depth-2),x,ty));
    if(P.engraveIds&&(pc.kind==='wall'||pc.kind==='angle')&&this.w>=14){
      const lx=labelX(this.w,pc.notches.map(n=>n-pc.s),G.tunnelW,pc.id);
      if(lx!==null)o.push(pn.txt(x+lx,ty+G.depth/2,pc.id,Math.min(2.6,G.depth/4)));
    }
    return o;
  }}));
}
// shelf-packs items onto sheets or print plates
function shelf(items,W,H,gap){
  const margin=5,sheets=[];let cur=null,x=0,y=0,rowH=0;
  const next=()=>{cur=[];sheets.push(cur);x=margin;y=margin;rowH=0;};
  next();
  for(const it of items.slice().sort((a,b)=>b.w-a.w)){
    if(x+it.w>W-margin){x=margin;y+=rowH+gap;rowH=0;}
    if(y+it.h>H-margin&&cur.length)next();
    cur.push({it,x,y});x+=it.w+gap;rowH=Math.max(rowH,it.h);
  }
  return sheets.filter(s=>s.length);
}
const HW_KEY={door:'door',saddle:'saddle',peg:'peg',key:'key','panel joiner':'joiner',plug:'plug','plug pin':'plug','vial ring':'vial','vial post':'vial','cover leg':'coverLeg','sensor plug':'sensor',foot:'foot'};
export const hwPrinted=(P,name)=>!!HW_KEY[name]&&printed(P,HW_KEY[name]);
// printed versions of the small parts; stacks become one solid
function hwPrint(part,G,P){
  const t=G.t;
  if(part.name==='plug pin'||part.name==='vial post')return null;
  if(part.name==='plug'){
    const h=G.depth-heatFrameLayers(P)*t;
    return {name:'port plug',qty:part.qty/(P.layers-heatFrameLayers(P)),solids:[partSolid({poly:part.poly},0,h)]};
  }
  if(part.name==='vial ring'){
    const h=P.vialRings*t,posts=part.holes.map(s=>{const X=s.map(p=>p[0]),Y=s.map(p=>p[1]),cx=(Math.min(...X)+Math.max(...X))/2,cy=(Math.min(...Y)+Math.max(...Y))/2;
      return partSolid({poly:rectPts(cx-2,cy-t/2,cx+2,cy+t/2)},h,h+P.S+1);});
    return {name:'vial holder',qty:part.qty/P.vialRings,solids:[partSolid({poly:part.poly,circles:part.circles},0,h),...posts]};
  }
  return {name:part.name,qty:part.qty,solids:[partSolid(part,0,t)]};
}
// everything set to 3D print, as solids
export function printPlan(G,L,P,geo){
  const rec=recorder(),items=[],t=G.t,hf=heatFrameLayers(P),[top,floor]=sheetLabels(P);
  const flat=P.orient==='flat';
  if(printed(P,'front'))items.push({name:flat?'top sheet':'front sheet',qty:1,solids:shapesToSolids(sheetBody(G,P,geo,rec,'front',geo.slotsFront,true,top),0,P.S)});
  if(printed(P,'back'))items.push({name:flat?'floor sheet':'back sheet',qty:1,solids:shapesToSolids(sheetBody(G,P,geo,rec,'back',geo.slotsBack,false,floor),0,P.S)});
  if(printed(P,'frame')){
    shapesToSolids(frameBody(G,P,geo,rec,geo.frame),0,(P.layers-hf)*t).forEach((s,i)=>items.push({name:`frame section ${i+1}`,qty:1,solids:[s]}));
    if(geo.edgeHeat)shapesToSolids(frameBody(G,P,geo,rec,geo.edgeHeat.pieces),0,hf*t).forEach((s,i)=>items.push({name:`frame heat section ${i+1}`,qty:1,solids:[s]}));
  }
  if(printed(P,'cover')&&P.coverType==='whole'&&geo.sockets.length)items.push({name:'cover sheet',qty:1,solids:shapesToSolids(coverBody(G,P,geo,rec),0,P.S)});
  if(printed(P,'heat')&&geo.heat){
    const ties=heatTies(G,P,geo,rec);
    shapesToSolids([...geo.heat.pieces.map(p=>rec.outline(p)),...ties],0,P.heatLayers*t).forEach((s,i)=>items.push({name:`heat layer section ${i+1}`,qty:1,solids:[s]}));
    items.push({name:'heat base sheet',qty:1,solids:shapesToSolids([rec.outline(rectPts(0,0,P.W,P.H)),...ties],0,P.S)});
  }
  if(printed(P,'walls')){
    // strips are all different, so they go onto print plates
    shelf(stripItems(G,P,geo),P.printW,P.printD,3).forEach((plate,i,all)=>{
      const shapes=plate.flatMap(({it,x,y})=>it.draw(rec,x,y));
      items.push({name:`wall strips plate ${i+1} of ${all.length}`,qty:1,solids:shapesToSolids(shapes,0,t)});
    });
  }
  for(const part of hardwareParts(G,L,P,geo))if(hwPrinted(P,part.name)){const it=hwPrint(part,G,P);if(it)items.push(it);}
  return items;
}
export function exporters(G,L,P,geo){
  const d=pen(P);
  const W=P.W,H=P.H;
  const files=[];
  const [top,floor]=sheetLabels(P);
  if(!printed(P,'front'))files.push({name:'front-sheet.svg',data:svgDoc(W,H,sheetBody(G,P,geo,d,'front',geo.slotsFront,true,top).join('\n'),top)});
  if(!printed(P,'back'))files.push({name:'back-sheet.svg',data:svgDoc(W,H,sheetBody(G,P,geo,d,'back',geo.slotsBack,false,floor).join('\n'),floor)});
  if(!printed(P,'frame')){
    const nFrame=P.layers-heatFrameLayers(P);
    files.push({name:`frame-layer-cut-x${nFrame}.svg`,data:svgDoc(W,H,frameBody(G,P,geo,d,geo.frame).join('\n'),`Frame layer, cut ${nFrame} times`)});
    if(geo.edgeHeat){
      const n=heatFrameLayers(P);
      files.push({name:`frame-heat-layer-cut-x${n}.svg`,data:svgDoc(W,H,frameBody(G,P,geo,d,geo.edgeHeat.pieces).join('\n'),`Bottom frame layer with heat groove, cut ${n} times. No port cuts: ports sit above it`)});
    }
  }
  if(P.coverType==='whole'&&geo.sockets.length&&!printed(P,'cover'))
    files.push({name:'cover-sheet.svg',data:svgDoc(W,H,coverBody(G,P,geo,d).join('\n'),'Cover sheet (red acrylic)')});
  // heat layers sit under the floor sheet, so they only need the fasteners and joiner slots
  if(geo.heat&&!printed(P,'heat')){
    const ties=heatTies(G,P,geo,d);
    const body=[...geo.heat.pieces.map(p=>d.outline(p)),...ties];
    files.push({name:`heat-layer-cut-x${P.heatLayers}.svg`,data:svgDoc(W,H,body.join('\n'),`Heat channel layer, cut ${P.heatLayers} times from the wall sheet`)});
    files.push({name:'heat-base-sheet.svg',data:svgDoc(W,H,[d.outline(rectPts(0,0,W,H)),...ties].join('\n'),'Heat channel base sheet')});
  }
  // frosting is its own engrave file, so it never mixes with the cuts
  const frostPath=pts=>`<path d="${polyD(pts)}" fill="${P.engraveColor}" stroke="none"/>`;
  const frostAreas=mode=>mode==='frosted'?[rectPts(P.B,P.B,W-P.B,H-P.B)]
    :mode==='chosen'?L.frost.map(([r,c])=>rectPts(G.xs[c],G.ys[r],G.xs[c+1],G.ys[r+1])):[];
  const floorF=printed(P,'back')?[]:frostAreas(P.floorFinish),ceiling=printed(P,'front')?[]:frostAreas(P.ceilingFinish);
  if(floorF.length)files.push({name:'floor-frost-layer.svg',data:svgDoc(W,H,floorF.map(frostPath).join('\n'),'Frost the inside of the floor or back sheet, in the same position, before cutting')});
  // the top sheet is frosted on its inside face, so this file is mirrored for the sheet turned over
  if(ceiling.length)files.push({name:'ceiling-frost-layer.svg',data:svgDoc(W,H,ceiling.map(p=>frostPath(p.map(([x,y])=>[W-x,y]))).join('\n'),'Frost the inside of the top or front sheet: turn the sheet over, in the same position, before cutting')});
  // everything cut from the wall sheet, shelf-packed onto stock sheets
  const items=printed(P,'walls')?[]:stripItems(G,P,geo);
  const kit=hardwareParts(G,L,P,geo);
  for(const part of kit)if(!hwPrinted(P,part.name))for(let n=0;n<part.qty;n++)items.push({w:part.w,h:part.h,draw(pn,x,y){
    const o=[pn.outline(part.poly,x,y)];
    for(const h of part.holes)o.push(pn.cutout(h,x,y));
    for(const [cx,cy,dia] of part.circles||[])o.push(pn.hole(x+cx,y+cy,dia));
    return o;
  }});
  const sheets=items.length?shelf(items,P.stockW,P.stockH,2+P.kerf):[];
  sheets.forEach((sh,i)=>{
    const b=[];
    for(const {it,x,y} of sh)b.push(...it.draw(d,x,y));
    files.push({name:`parts-sheet-${i+1}.svg`,data:svgDoc(P.stockW,P.stockH,b.join('\n'),`Wall sheet parts, sheet ${i+1} of ${sheets.length}`)});
    if(P.wallFinish==='one'||P.wallFinish==='both'){
      const faces=sh.filter(s=>s.it.frost).map(({it,x,y})=>rectPts(x,y+P.S,x+it.w,y+P.S+G.depth));
      if(!faces.length)return;
      files.push({name:`parts-frost-${i+1}.svg`,data:svgDoc(P.stockW,P.stockH,faces.map(frostPath).join('\n'),`Frost wall strips on sheet ${i+1}, before cutting, in the same position`)});
      if(P.wallFinish==='both')files.push({name:`parts-frost-${i+1}-side-b.svg`,data:svgDoc(P.stockW,P.stockH,faces.map(p=>frostPath(p.map(([x,y])=>[P.stockW-x,y]))).join('\n'),`Second side: turn the sheet over left to right, back into the same corner, then frost. Stock must be exactly ${P.stockW}mm wide`)});
    }
  });
  const asm=drawTopdown(G,L,P,geo,null,{labels:true,mm:true});
  files.push({name:'assembly-map.svg',data:`<?xml version="1.0" encoding="UTF-8"?>\n`+asm});
  if(P.exportDxf)for(const f of files.slice()){
    if(/frost|assembly/.test(f.name)||!f.name.endsWith('.svg'))continue;
    files.push({name:f.name.replace('.svg','.dxf'),data:svgToDxf(f.data)});
  }
  const prints=printPlan(G,L,P,geo);
  for(const it of prints)files.push(printFile(it));
  return {files,stripSheets:sheets.length,kit,prints};
}

// One small sheet that checks kerf, tab fit, door fit, peg fit and vent sizes before a full cut.
export function testPiece(G,P){
  const d=pen(P),t=G.t,b=[];
  const W=170,H=185;
  const lab=(x,y,s)=>d.txt(x,y,s,2.4);
  // kerf comb: a 50mm block cut into 5. Measure the stack squeezed together.
  b.push(lab(32,4,'KERF: 5 x 10mm, measure stack'));
  const line=`fill="none" stroke="${P.cutColor}" stroke-width="0.01"`;
  b.push(`<path d="${polyD(rectPts(7,7,57,17))}" ${line}/>`);
  for(let i=1;i<5;i++)b.push(`<path d="M${7+i*10} 7 L${7+i*10} 17" ${line}/>`);
  // tab fit plate
  b.push(lab(120,4,'TAB FIT: slot clearance'));
  b.push(d.outline(rectPts(70,7,165,27)));
  [-0.1,-0.05,0,0.05,0.1].forEach((c,i)=>{
    const cx=80+i*18;
    b.push(d.rect({x0:cx-P.tabL/2-c/2,x1:cx+P.tabL/2+c/2,y0:14-t/2-c/2,y1:14+t/2+c/2}));
    b.push(lab(cx,22,fmt(c)));
  });
  // door fit plate: one door body tried in slots with different gaps on every side
  b.push(lab(52,32,'DOOR FIT: per side'));
  b.push(d.outline(rectPts(5,35,100,55)));
  const fits=[0.05,0.1,0.15,0.2,0.25];
  fits.forEach((f,i)=>{
    const cx=15+i*18;
    const body=G.tunnelW-2*P.doorFit;
    b.push(d.rect({x0:cx-body/2-f,x1:cx+body/2+f,y0:42-t/2-f,y1:42+t/2+f}));
    b.push(lab(cx,50,fmt(f)));
  });
  // sample wall strip with one tunnel and tabs, plus its door and saddle
  const len=50,pc={s:0,e:len,top:[9,len-9],bot:[9,len-9],notches:[len/2]};
  b.push(lab(135,32,'WALL, DOOR, SADDLE'));
  b.push(d.outline(stripOutline(pc,G,P),110,38+P.S));
  const parts=doorType(P).parts(G,P,1);
  let px=5,py=64;
  for(const part of parts){b.push(d.outline(part.poly,px,py));for(const h of part.holes)b.push(d.cutout(h,px,py));px+=part.w+3;}
  // peg, key and peg slot
  const peg=pegPart(G,P),key=keyPart();
  b.push(d.outline(peg.poly,px,py));for(const h of peg.holes)b.push(d.cutout(h,px,py));px+=peg.w+3;
  b.push(d.outline(key.poly,px,py));
  b.push(d.outline(rectPts(px,py+6,px+24,py+22)));
  b.push(d.rect(borderSlot({x:px+12,y:py+14,along:'x'},P.pegW,t,PEG_FIT)));
  b.push(lab(px+12,py+19,'PEG SLOT'));
  // vent holes and slots
  b.push(lab(52,92,'VENT HOLES AND SLOTS (mm)'));
  b.push(d.outline(rectPts(5,95,165,115)));
  [0.4,0.5,0.6,0.8,1,1.2].forEach((v,i)=>{
    const cx=15+i*12;
    b.push(d.hole(cx,101,v));b.push(lab(cx,110,fmt(v)));
    const sx=95+i*11;
    b.push(d.rect({x0:sx-v/2,x1:sx+v/2,y0:98,y1:106}));b.push(lab(sx,110,fmt(v)));
  });
  // heat groove: does your cable fit, and does a 3mm rim survive handling?
  b.push(lab(35,122,'HEAT GROOVE'));
  const gw=P.heatEdgeW;
  b.push(d.outline(rectPts(5,125,65,125+3+gw+12)));
  b.push(d.rect({x0:10,x1:60,y0:128,y1:128+gw}));
  // vial holder: ring and post, with its blind slot in a sample sheet
  b.push(lab(100,122,'VIAL HOLDER'));
  const vr=rectPts(72,125,72+42,125+P.vialD+8);
  b.push(d.outline(vr));
  b.push(d.hole(93,125+(P.vialD+8)/2,P.vialD));
  for(const x of [72+4,72+38])b.push(d.rect({x0:x-2.1,x1:x+2.1,y0:125+(P.vialD+8)/2-t/2-0.1,y1:125+(P.vialD+8)/2+t/2+0.1}));
  b.push(d.outline(rectPts(118,125,122,125+P.S+3*t+1)));
  // angled joint: a straight strip and a 45 degree strip that butts it, in one sample sheet
  b.push(lab(145,122,'ANGLED JOINT'));
  b.push(d.outline(rectPts(127,125,165,160)));
  const c45=Math.SQRT1_2,tl=8,mx=146,my=131,ax=mx+c45*14,ay=my+t/2+c45*(14+t/2)+c45*0;
  b.push(d.rect({x0:mx-tl/2,x1:mx+tl/2,y0:my-t/2,y1:my+t/2}));
  const hx=tl/2,hy=t/2;
  b.push(d.rect({poly:[[ax-c45*hx+c45*hy,ay-c45*hx-c45*hy],[ax+c45*hx+c45*hy,ay+c45*hx-c45*hy],[ax+c45*hx-c45*hy,ay+c45*hx+c45*hy],[ax-c45*hx-c45*hy,ay-c45*hx+c45*hy]]}));
  const strip={s:0,e:28,top:[14],bot:[14],notches:[]};
  b.push(d.outline(stripOutline(strip,G,P),5,160+P.S));
  b.push(d.outline(stripOutline(strip,G,P),40,160+P.S));
  return {name:'test-piece.svg',data:svgDoc(W,H,b.join('\n'),'Fit test piece')};
}
