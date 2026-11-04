import {fmt,rectPts} from './util.js';
import {polyD,offsetPoly} from './offset.js';
import {stripOutline} from './strip.js';
import {drawTopdown} from './draw.js';
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

export function exporters(G,L,P,geo){
  const k2=P.kerf/2, cut=`fill="none" stroke="${P.cutColor}" stroke-width="0.01"`;
  const cutPoly=(pts,d,tx=0,ty=0)=>`<path d="${polyD(offsetPoly(pts,d).map(q=>[q[0]+tx,q[1]+ty]))}" ${cut}/>`;
  const hole=(x,y,dia)=>`<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(Math.max(0.05,dia/2-k2))}" ${cut}/>`;
  const txt=(x,y,s,size,rot)=>`<text x="${fmt(x)}" y="${fmt(y)}" font-size="${fmt(size)}" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" fill="${P.engraveColor}" stroke="none"${rot?` transform="rotate(${rot} ${fmt(x)} ${fmt(y)})"`:''}>${s}</text>`;
  const W=P.W,H=P.H;
  const files=[];
  function sheet(name,slots,fillHere,vents,label){
    const b=[];
    b.push(cutPoly(rectPts(0,0,W,H),k2));
    for(const s of slots)b.push(cutPoly(rectPts(s.x0,s.y0,s.x1,s.y1),-k2));
    for(const o of geo.bolts)b.push(hole(o.x,o.y,P.boltD));
    if(vents)for(const v of geo.vents)b.push(hole(v.x,v.y,P.ventD));
    if(fillHere)for(const f of geo.fills)b.push(hole(f.x,f.y,P.fillD));
    if(P.engraveIds)b.push(txt(W/2,P.B/2,label,Math.min(4,P.B*0.35)));
    files.push({name,data:svgDoc(W,H,b.join('\n'),label)});
  }
  sheet('front-sheet.svg',geo.slotsFront,P.fillSide!=='back',true,'FRONT (outside face up, top edge)');
  sheet('back-sheet.svg',geo.slotsBack,P.fillSide!=='front',false,'BACK (inside face up, top edge)');
  // frame layer
  {
    const b=[];
    for(const f of geo.frame){b.push(cutPoly(f.poly,k2));if(f.hole)b.push(cutPoly(f.hole,-k2));}
    for(const o of geo.bolts)b.push(hole(o.x,o.y,P.boltD));
    files.push({name:`frame-layer-cut-x${P.layers}.svg`,data:svgDoc(W,H,b.join('\n'),`Frame layer, cut ${P.layers} times`)});
  }
  // strips nested onto stock sheets
  const parts=geo.pieces.map(pc=>({pc,w:pc.e-pc.s,h:G.depth+2*P.S})).sort((a,b)=>b.w-a.w);
  const margin=5,gap=2+P.kerf;
  const sheets=[];let cur=null,x=0,y=0,rowH=0;
  const newSheet=()=>{cur=[];sheets.push(cur);x=margin;y=margin;rowH=0;};
  newSheet();
  for(const it of parts){
    if(x+it.w>P.stockW-margin){x=margin;y+=rowH+gap;rowH=0;}
    if(y+it.h>P.stockH-margin){newSheet();}
    cur.push({it,x,y});x+=it.w+gap;rowH=Math.max(rowH,it.h);
  }
  sheets.forEach((sh,i)=>{
    const b=[];
    for(const {it,x,y} of sh){
      const pc=it.pc,ty=y+P.S;
      b.push(cutPoly(stripOutline(pc,G,P),k2,x,ty));
      for(const [a0,a1] of pc.windows)b.push(cutPoly(rectPts(a0,2,a1,G.depth-2),-k2,x,ty));
      if(P.engraveIds&&pc.kind==='wall'&&it.w>=14){
        const lx=labelX(it.w,pc.notches.map(n=>n-pc.s),G.tunnelW,pc.id);
        if(lx!==null)b.push(txt(x+lx,ty+G.depth/2,pc.id,Math.min(2.6,G.depth/4)));
      }
    }
    files.push({name:`strips-sheet-${i+1}.svg`,data:svgDoc(P.stockW,P.stockH,b.join('\n'),`Wall strips, sheet ${i+1} of ${sheets.length}`)});
  });
  const asm=drawTopdown(G,L,P,geo,null,{labels:true,mm:true});
  files.push({name:'assembly-map.svg',data:`<?xml version="1.0" encoding="UTF-8"?>\n`+asm});
  return {files,stripSheets:sheets.length};
}
