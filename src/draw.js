import {fmt} from './util.js';
import {stH,stV,chambers,unitPoly,isActive} from './layout.js';
import {polyD} from './offset.js';
/* ---------------- top-down drawing ---------------- */
export function drawTopdown(G,L,P,geo,rules,opts){
  const {W,H}=P,{t,xs,ys,cols,rows}=G;
  const o=[];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 ${fmt(W+8)} ${fmt(H+8)}"${opts.mm?` width="${fmt(W+8)}mm" height="${fmt(H+8)}mm"`:''} font-family="system-ui,Arial,sans-serif">`);
  o.push(`<defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#8a8a86"/><line x1="0" y1="0" x2="0" y2="4" stroke="#6f6f6b" stroke-width="1.6"/></pattern></defs>`);
  o.push(`<rect x="0" y="0" width="${fmt(W)}" height="${fmt(H)}" fill="#dfe4e5"/>`);
  const units=geo.ch.list.flatMap(c=>c.cells);
  for(const u of units)o.push(`<path d="${polyD(unitPoly(G,u))}" fill="${isActive(L,u)?'#e9d5a6':'url(#hatch)'}"/>`);
  for(const sp of geo.sponges){
    const D=P.spongeD,L2=sp.Ls/2;
    const r=sp.orient==='H'?[sp.uc-L2,sp.c-D/2,sp.Ls,D]:[sp.c-D/2,sp.uc-L2,D,sp.Ls];
    o.push(`<rect x="${fmt(r[0])}" y="${fmt(r[1])}" width="${fmt(r[2])}" height="${fmt(r[3])}" fill="#4a90d9"/>`);
  }
  for(const [r,c] of L.reservoirs)o.push(`<rect x="${fmt(xs[c])}" y="${fmt(ys[r])}" width="${fmt(xs[c+1]-xs[c])}" height="${fmt(ys[r+1]-ys[r])}" fill="#7fb8ea"/>`);
  if(opts.interactive&&P.dampSide!=='none'&&P.sponges>0){
    const g={left:'x1="0" x2="1" y1="0" y2="0"',right:'x1="1" x2="0" y1="0" y2="0"',top:'x1="0" x2="0" y1="0" y2="1"',bottom:'x1="0" x2="0" y1="1" y2="0"'}[P.dampSide];
    if(g)o.push(`<defs><linearGradient id="damp" ${g}><stop offset="0" stop-color="#4a90d9" stop-opacity="0.22"/><stop offset="1" stop-color="#4a90d9" stop-opacity="0"/></linearGradient></defs><rect x="${fmt(P.B)}" y="${fmt(P.B)}" width="${fmt(W-2*P.B)}" height="${fmt(H-2*P.B)}" fill="url(#damp)"/>`);
  }
  for(const b of geo.sensorBoxes)o.push(`<rect x="${fmt(b.x0)}" y="${fmt(b.y0)}" width="${fmt(b.x1-b.x0)}" height="${fmt(b.y1-b.y0)}" fill="#c9b6e8"/>`);
  if(opts.interactive&&P.floorFinish==='chosen'||opts.interactive&&P.ceilingFinish==='chosen'){
    for(const [r,c] of L.frost)o.push(`<rect x="${fmt(xs[c])}" y="${fmt(ys[r])}" width="${fmt(xs[c+1]-xs[c])}" height="${fmt(ys[r+1]-ys[r])}" fill="#fff" opacity="0.45"/>`);
  }
  for(const f of geo.frame){
    o.push(`<path d="${polyD(f.poly)}${f.hole?' '+polyD(f.hole):''}" fill="#b9c3c6" fill-rule="evenodd" stroke="#7d898c" stroke-width="0.4"/>`);
  }
  for(const pc of geo.pieces){
    const r=pc.rect;
    if(pc.orient==='D'){o.push(`<path d="${polyD(pc.poly)}" fill="#7a4fc4"/>`);continue;}
    o.push(`<rect x="${fmt(r.x0)}" y="${fmt(r.y0)}" width="${fmt(r.x1-r.x0)}" height="${fmt(r.y1-r.y0)}" fill="${pc.kind==='wall'?'#5b4fc4':pc.kind==='lip'?'#8f86d8':'#3c6fb0'}"/>`);
  }
  // tunnel openings
  const tw=G.tunnelW;
  for(const pc of geo.pieces)for(const n of pc.notches){
    const r=pc.orient==='H'?[n-tw/2,pc.c-t/2-0.6,tw,t+1.2]:[pc.c-t/2-0.6,n-tw/2,t+1.2,tw];
    o.push(`<rect x="${fmt(r[0])}" y="${fmt(r[1])}" width="${fmt(r[2])}" height="${fmt(r[3])}" fill="#2fb37a"/>`);
  }
  // ports
  for(const p of geo.ports){
    let x,y;
    if(p.side==='top'){x=p.pos;y=P.B/2;}else if(p.side==='bottom'){x=p.pos;y=H-P.B/2;}else if(p.side==='left'){x=P.B/2;y=p.pos;}else{x=W-P.B/2;y=p.pos;}
    if(!p.cut){o.push(`<path d="M${fmt(x-2.5)} ${fmt(y-2.5)} L${fmt(x+2.5)} ${fmt(y+2.5)} M${fmt(x+2.5)} ${fmt(y-2.5)} L${fmt(x-2.5)} ${fmt(y+2.5)}" stroke="#e5484d" stroke-width="1.2"/>`);continue;}
    const horiz=p.side==='top'||p.side==='bottom';
    const r=horiz?[p.pos-tw/2,p.side==='top'?0:H-P.B,tw,P.B]:[p.side==='left'?0:W-P.B,p.pos-tw/2,P.B,tw];
    o.push(`<rect${opts.tool==='port'?` data-port="${p.key}" style="cursor:pointer"`:''} x="${fmt(r[0])}" y="${fmt(r[1])}" width="${fmt(r[2])}" height="${fmt(r[3])}" fill="${p.used?'#1b6fd0':p.active?'#2fb37a':'#9aa3a5'}"/>`);
    if(opts.labels)o.push(`<text x="${fmt(horiz?p.pos:(p.side==='left'?-2:W+2))}" y="${fmt(horiz?(p.side==='top'?-1:H+3.5):p.pos)}" font-size="3" text-anchor="${horiz?'middle':(p.side==='left'?'end':'start')}" fill="#333">${p.id}</text>`);
  }
  for(const b of geo.fasteners){
    if(P.fastener==='bolt'){o.push(`<circle cx="${fmt(b.x)}" cy="${fmt(b.y)}" r="${fmt(P.boltD/2)}" fill="#fff" stroke="#555" stroke-width="0.4"/>`);continue;}
    const hx=(b.along==='x'?P.pegW:t)/2,hy=(b.along==='x'?t:P.pegW)/2;
    o.push(`<rect x="${fmt(b.x-hx)}" y="${fmt(b.y-hy)}" width="${fmt(2*hx)}" height="${fmt(2*hy)}" fill="#fff" stroke="#555" stroke-width="0.4"/>`);
  }
  for(const s of geo.joints){
    const hx=s.along==='x'?4:t/2,hy=s.along==='x'?t/2:4;
    o.push(`<rect x="${fmt(s.x-hx)}" y="${fmt(s.y-hy)}" width="${fmt(2*hx)}" height="${fmt(2*hy)}" fill="#fff4c2" stroke="#a88a2a" stroke-width="0.3"/>`);
  }
  for(const s of geo.sockets){
    const hl=(geo.socketL-4)/2,hx=s.along==='x'?hl:t/2,hy=s.along==='x'?t/2:hl;
    o.push(`<rect x="${fmt(s.x-hx)}" y="${fmt(s.y-hy)}" width="${fmt(2*hx)}" height="${fmt(2*hy)}" fill="#f3b0b2" stroke="#b33" stroke-width="0.3"/>`);
  }
  if(geo.heat)o.push(`<path d="M${geo.heat.path.map(v=>fmt(v[0])+' '+fmt(v[1])).join(' L')}" fill="none" stroke="#e5484d" stroke-opacity="0.55" stroke-width="${fmt(P.heatW*0.6)}" stroke-dasharray="${fmt(P.heatW)} ${fmt(P.heatW)}"/>`);
  if(geo.edgeHeat)for(const p of geo.edgeHeat.paths)o.push(`<path d="M${p.map(v=>fmt(v[0])+' '+fmt(v[1])).join(' L')}" fill="none" stroke="#e5484d" stroke-opacity="0.7" stroke-width="${fmt(P.heatEdgeW*0.6)}" stroke-dasharray="4 3"/>`);
  for(const v of geo.vials)o.push(`<circle cx="${fmt(v.x)}" cy="${fmt(v.y)}" r="${fmt(P.vialD/2)}" fill="#4a90d9" fill-opacity="0.18" stroke="#2f6fb0" stroke-width="0.6"/>`);
  // closed doors
  for(const d of geo.doors){
    if(!d.closed)continue;
    const w2=G.tunnelW/2+0.8,h2=t/2+0.8;
    const r=d.orient==='H'?[d.x-w2,d.y-h2,2*w2,2*h2]:[d.x-h2,d.y-w2,2*h2,2*w2];
    o.push(`<rect x="${fmt(r[0])}" y="${fmt(r[1])}" width="${fmt(r[2])}" height="${fmt(r[3])}" fill="#e8933a"/>`);
  }
  for(const v of geo.vents)o.push(`<circle cx="${fmt(v.x)}" cy="${fmt(v.y)}" r="${fmt(Math.max(0.35,P.ventD/2))}" fill="#9b8a63"/>`);
  for(const f of geo.fills)o.push(`<circle cx="${fmt(f.x)}" cy="${fmt(f.y)}" r="${fmt(P.fillD/2)}" fill="none" stroke="#fff" stroke-width="0.6"/>`);
  // problems
  if(rules)for(const id of rules.bad){
    const c=geo.ch.list[id];if(!c)continue;
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    for(const [r,cc] of c.cells){x0=Math.min(x0,xs[cc]);x1=Math.max(x1,xs[cc+1]);y0=Math.min(y0,ys[r]);y1=Math.max(y1,ys[r+1]);}
    o.push(`<rect x="${fmt(x0+2)}" y="${fmt(y0+2)}" width="${fmt(x1-x0-4)}" height="${fmt(y1-y0-4)}" fill="none" stroke="#e5484d" stroke-width="1.4" stroke-dasharray="3 2"/>`);
  }
  if(opts.labels){
    for(const pc of geo.pieces){
      if(pc.kind!=='wall'&&pc.kind!=='angle')continue;
      const r=pc.rect,cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2;
      const rot=pc.orient==='D'?` transform="rotate(${fmt(Math.atan2(pc.dir[1],pc.dir[0])*180/Math.PI)} ${fmt(cx)} ${fmt(cy)})"`:pc.orient==='V'?` transform="rotate(-90 ${fmt(cx)} ${fmt(cy)})"`:'';
      o.push(`<text x="${fmt(cx)}" y="${fmt(cy+0.9)}" font-size="2.6" text-anchor="middle" fill="#fff"${rot}>${pc.id}</text>`);
    }
    for(const sp of geo.sponges){const pt=sp.orient==='H'?[sp.uc,sp.c]:[sp.c,sp.uc];o.push(`<text x="${fmt(pt[0])}" y="${fmt(pt[1]+0.9)}" font-size="2.6" text-anchor="middle" fill="#fff">${sp.id}</text>`);}
  }
  if(opts.interactive){
    // hit areas
    for(const u of units)o.push(`<path data-cell="${u.slice(0,3).filter(v=>v!==undefined).join(',')}" d="${polyD(unitPoly(G,u))}" fill="transparent"/>`);
    if(opts.tool==='port')for(const p of geo.ports){
      if(!p.cut)continue;
      const horiz=p.side==='top'||p.side==='bottom',tw2=G.tunnelW;
      const r=horiz?[p.pos-tw2/2,p.side==='top'?0:H-P.B,tw2,P.B]:[p.side==='left'?0:W-P.B,p.pos-tw2/2,P.B,tw2];
      o.push(`<rect data-port="${p.key}" x="${fmt(r[0])}" y="${fmt(r[1])}" width="${fmt(r[2])}" height="${fmt(r[3])}" fill="transparent" style="cursor:pointer"/>`);
    }
    if(opts.tool==='wall'||opts.tool==='jog'||opts.tool==='water'){
      const hw=Math.max(4,t*2);
      for(let j=1;j<rows;j++)for(let k=0;k<cols;k++){if(stH(L,j,k)==='none')continue;
        o.push(`<rect data-edge="H,${j},${k}" x="${fmt(xs[k]+t)}" y="${fmt(ys[j]-hw)}" width="${fmt(xs[k+1]-xs[k]-2*t)}" height="${fmt(2*hw)}" fill="transparent" style="cursor:pointer"/>`);}
      for(let r=0;r<rows;r++)for(let i=1;i<cols;i++){if(stV(L,r,i)==='none')continue;
        o.push(`<rect data-edge="V,${r},${i}" x="${fmt(xs[i]-hw)}" y="${fmt(ys[r]+t)}" width="${fmt(2*hw)}" height="${fmt(ys[r+1]-ys[r]-2*t)}" fill="transparent" style="cursor:pointer"/>`);}
    }
  }
  o.push('</svg>');
  return o.join('');
}
