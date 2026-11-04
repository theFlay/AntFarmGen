import {fmt,rectPts} from './util.js';
import {polyD,offsetPoly} from './offset.js';
import {stripOutline} from './strip.js';
import {drawTopdown} from './draw.js';
import {doorType} from './doors.js';
import {hardwareParts,pegPart,keyPart,PEG_FIT,JOIN_LEG} from './hardware.js';

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
    txt:(x,y,s,size,rot)=>`<text x="${fmt(x)}" y="${fmt(y)}" font-size="${fmt(size)}" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" fill="${P.engraveColor}" stroke="none"${rot?` transform="rotate(${rot} ${fmt(x)} ${fmt(y)})"`:''}>${s}</text>`,
  };
}
// a slot for a peg or cover leg, lying along the border
export function borderSlot(o,len,t,fit){
  const hl=len/2+fit,ht=t/2+fit;
  return o.along==='x'?{x0:o.x-hl,x1:o.x+hl,y0:o.y-ht,y1:o.y+ht}:{x0:o.x-ht,x1:o.x+ht,y0:o.y-hl,y1:o.y+hl};
}
function fastenerCuts(G,P,geo,d){
  if(P.fastener==='bolt')return geo.fasteners.map(o=>d.hole(o.x,o.y,P.boltD));
  if(P.fastener==='peg')return geo.fasteners.map(o=>d.rect(borderSlot(o,P.pegW,G.t,PEG_FIT)));
  return [];
}
function socketCuts(G,geo,d,tab){
  return geo.sockets.map(o=>d.rect(borderSlot(o,tab,G.t,PEG_FIT))).concat(geo.joints.map(o=>d.rect(borderSlot(o,JOIN_LEG,G.t,PEG_FIT))));
}

export function exporters(G,L,P,geo){
  const d=pen(P);
  const W=P.W,H=P.H;
  const files=[];
  const fillOn=side=>P.fillSide==='both'||P.fillSide===side||(P.fillSide==='service'&&G.service===side);
  const sockTab=geo.socketL-4;
  function sheet(side,name,slots,vents,label){
    const b=[];
    b.push(d.outline(rectPts(0,0,W,H)));
    for(const s of slots)b.push(d.rect(s));
    if(G.service===side)for(const s of geo.doorSlots)b.push(d.rect(s));
    b.push(...fastenerCuts(G,P,geo,d));
    b.push(...socketCuts(G,geo,d,sockTab));
    if(vents)for(const v of geo.vents)b.push(d.hole(v.x,v.y,P.ventD));
    if(fillOn(side))for(const f of geo.fills)b.push(d.hole(f.x,f.y,P.fillD));
    if(P.engraveIds)b.push(d.txt(W/2,Math.min(3,P.B*0.2),label,Math.min(3,P.B*0.2)));
    files.push({name,data:svgDoc(W,H,b.join('\n'),label)});
  }
  const flat=P.orient==='flat';
  sheet('front','front-sheet.svg',geo.slotsFront,true,flat?'TOP SHEET (top face up, north edge)':'FRONT (outside face up, top edge)');
  sheet('back','back-sheet.svg',geo.slotsBack,false,flat?'FLOOR SHEET (inside face up, north edge)':'BACK (inside face up, top edge)');
  // frame layer
  {
    const b=[];
    for(const f of geo.frame){b.push(d.outline(f.poly));if(f.hole)b.push(d.cutout(f.hole));}
    b.push(...fastenerCuts(G,P,geo,d));
    b.push(...socketCuts(G,geo,d,sockTab));
    files.push({name:`frame-layer-cut-x${P.layers}.svg`,data:svgDoc(W,H,b.join('\n'),`Frame layer, cut ${P.layers} times`)});
  }
  // cover
  if(P.coverType==='whole'&&geo.sockets.length){
    const b=[d.outline(rectPts(0,0,W,H)),...geo.sockets.map(o=>d.rect(borderSlot(o,sockTab,G.t,PEG_FIT)))];
    files.push({name:'cover-sheet.svg',data:svgDoc(W,H,b.join('\n'),'Cover sheet (red acrylic)')});
  }
  // frosting is its own engrave file, so it never mixes with the cuts
  if(P.floorFinish==='frosted'){
    const body=`<path d="${polyD(rectPts(P.B,P.B,W-P.B,H-P.B))}" fill="${P.engraveColor}" stroke="none"/>`;
    files.push({name:'floor-frost-layer.svg',data:svgDoc(W,H,body,'Frost the inside of the floor or back sheet, before cutting')});
  }
  // everything cut from the wall sheet, shelf-packed onto stock sheets
  const items=geo.pieces.map(pc=>({w:pc.e-pc.s,h:G.depth+2*P.S,draw(x,y){
    const ty=y+P.S,o=[d.outline(stripOutline(pc,G,P),x,ty)];
    for(const [a0,a1] of pc.windows)o.push(d.cutout(rectPts(a0,2,a1,G.depth-2),x,ty));
    if(P.engraveIds&&(pc.kind==='wall'||pc.kind==='angle')&&this.w>=14){
      const lx=labelX(this.w,pc.notches.map(n=>n-pc.s),G.tunnelW,pc.id);
      if(lx!==null)o.push(d.txt(x+lx,ty+G.depth/2,pc.id,Math.min(2.6,G.depth/4)));
    }
    return o;
  }}));
  const kit=hardwareParts(G,L,P,geo);
  for(const part of kit)for(let n=0;n<part.qty;n++)items.push({w:part.w,h:part.h,draw(x,y){
    const o=[d.outline(part.poly,x,y)];
    for(const h of part.holes)o.push(d.cutout(h,x,y));
    return o;
  }});
  items.sort((a,b)=>b.w-a.w);
  const margin=5,gap=2+P.kerf;
  const sheets=[];let cur=null,x=0,y=0,rowH=0;
  const newSheet=()=>{cur=[];sheets.push(cur);x=margin;y=margin;rowH=0;};
  newSheet();
  for(const it of items){
    if(x+it.w>P.stockW-margin){x=margin;y+=rowH+gap;rowH=0;}
    if(y+it.h>P.stockH-margin){newSheet();}
    cur.push({it,x,y});x+=it.w+gap;rowH=Math.max(rowH,it.h);
  }
  sheets.forEach((sh,i)=>{
    const b=[];
    for(const {it,x,y} of sh)b.push(...it.draw(x,y));
    files.push({name:`parts-sheet-${i+1}.svg`,data:svgDoc(P.stockW,P.stockH,b.join('\n'),`Wall sheet parts, sheet ${i+1} of ${sheets.length}`)});
  });
  const asm=drawTopdown(G,L,P,geo,null,{labels:true,mm:true});
  files.push({name:'assembly-map.svg',data:`<?xml version="1.0" encoding="UTF-8"?>\n`+asm});
  return {files,stripSheets:sheets.length,kit};
}

// One small sheet that checks kerf, tab fit, door fit, peg fit and vent sizes before a full cut.
export function testPiece(G,P){
  const d=pen(P),t=G.t,b=[];
  const W=170,H=120;
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
  return {name:'test-piece.svg',data:svgDoc(W,H,b.join('\n'),'Fit test piece')};
}
