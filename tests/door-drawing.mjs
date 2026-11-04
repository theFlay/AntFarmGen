// Draws docs/door-design-v3.png from the real door and saddle shapes, so the picture cannot drift from the code.
import {chromium} from 'playwright';
import {ALL_FIELDS} from '../src/params.js';
import {derive} from '../src/grid.js';
import {DOOR_TYPES} from '../src/doors.js';

const P=Object.fromEntries(ALL_FIELDS.map(f=>[f.k,f.d]));
const G=derive(P),slide=DOOR_TYPES.slide,z=slide.sizes(G,P);
const [door,saddle]=slide.parts(G,P,1);
const w=G.tunnelW,S=P.S,d=G.depth,s=d-G.tunnelH,SC=12;
const out=[];
const T=(x,y,t,size=14,a='middle',col='#1f1e1c',wt=400)=>out.push(`<text x="${x}" y="${y}" font-size="${size}" text-anchor="${a}" fill="${col}" font-weight="${wt}">${t}</text>`);
const box=(ox,oy,a,b,c,e,col)=>out.push(`<rect x="${ox+a*SC}" y="${oy-e*SC}" width="${(c-a)*SC}" height="${(e-b)*SC}" fill="${col}"/>`);
// parts are drawn y-down from their top-left; place with their top at height `top`, centred on ox
const part=(pt,ox,oy,top,col)=>{
  const to=([x,y])=>`${ox+(x-pt.w/2)*SC},${oy-(top-y)*SC}`;
  let dd='M'+pt.poly.map(to).join(' L')+' Z';
  for(const h of pt.holes)dd+=' M'+h.map(to).join(' L')+' Z';
  out.push(`<path d="${dd}" fill="${col}" fill-rule="evenodd"/>`);
};
const base=(ox,oy,title,sub)=>{
  T(ox,oy-430,title,17,'middle','#1f1e1c',700);T(ox,oy-408,sub,13,'middle','#55534e');
  const X=11;
  box(ox,oy,-X,0,-w/2,d,'#c9cdd0');box(ox,oy,w/2,0,X,d,'#c9cdd0');box(ox,oy,-X,0,X,s,'#c9cdd0');
  box(ox,oy,-X,d,-w/2,d+S,'#a9d3e8');box(ox,oy,w/2,d,X,d+S,'#a9d3e8');
  T(ox-X*SC-6,oy-(d+S/2)*SC+5,'sheet',12,'end');T(ox-X*SC-6,oy-(d/2)*SC+5,'wall',12,'end');T(ox-X*SC-6,oy-(s/2)*SC+5,'sill',12,'end');
};
const W=1400,H=590,oy=540;
out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI,Arial,sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>`);
T(40,40,`Door type A, to scale (${w}mm tunnel, ${d}mm depth, ${S}mm sheet, ${s}mm sill)`,21,'start','#1f1e1c',700);
T(40,64,'Both parts are cut from the wall sheet. Everything below the sheet is solid, so a closed door has no window. Service side at the top.',14,'start','#55534e');
const doorCol='#5b4fc4',sadCol='#e5484d';
T(190,120,'Parts',17,'middle','#1f1e1c',700);
part(door,100,oy-60,door.h,doorCol);T(100,oy-34,'Door',13);T(100,oy-14,`${door.w.toFixed(1)} x ${door.h.toFixed(1)}mm`,12,'middle','#55534e');
part(saddle,270,oy-60,saddle.h,sadCol);T(270,oy-34,'Saddle',13);T(270,oy-14,`${saddle.w.toFixed(1)} x ${saddle.h.toFixed(1)}mm`,12,'middle','#55534e');
const closedTop=d+S+z.headH,openTop=closedTop+G.tunnelH;
base(520,oy,'1. Closed','Head rests on the sheet, door reaches the sill');part(door,520,oy,closedTop,doorCol);
base(830,oy,'2. Pull open','Bottom flush, slot filled, full tunnel');part(door,830,oy,openTop,doorCol);
base(1160,oy,'3. Saddle on','Slides on sideways, holds the head up');part(door,1160,oy,openTop,doorCol);part(saddle,1160,oy,d+S+saddle.h,sadCol);
out.push('</svg>');
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:W,height:H}});
await p.setContent('<body style="margin:0">'+out.join('')+'</body>');
await p.screenshot({path:'docs/door-design-v3.png'});
await b.close();
