// Printed body: the floor, frame and walls of a nest panel print as one piece, with acrylic on top.
// Flat nests are a tray, and the top sheet drops into a recess round the border. Upright nests are
// the frame and walls only, between two full acrylic sheets held by printed edge clips and feet.
// A body too big for the printer is split into tiles along wall lines, so every chamber stays whole.
import {rectPts,f1,fmt} from './util.js';
import {svgDoc,pen} from './export.js';
import {meshBoxes,meshInPlace,meshBounds,circlePts,partSolid,fitsPrinter,printFile} from './stl.js';
import {plugPart} from './hardware.js';
import {doorType} from './doors.js';

const SHEET_FIT=0.2,NOTCH=16,PLUG_FIT=0.1,ADAPT_WALL=1.2,SOCK_WALL=2.4,SOCK_LEN=12,CLIP_LEN=15,CLIP_WALL=2,CLIP_GRIP=0.2;
const cache={key:null,out:null};

// the cheapest split along grid lines that leaves every tile small enough to print
function tiles(G,P,h){
  const {xs,ys}=G,W=P.W,H=P.H;
  const pick=(lines,len,n)=>{
    const cuts=[0];
    for(let i=1;i<n;i++){
      const want=len*i/n,inner=lines.slice(1,-1).filter(v=>v>cuts[cuts.length-1]+1);
      if(!inner.length)return null;
      cuts.push(inner.reduce((a,b)=>Math.abs(b-want)<Math.abs(a-want)?b:a));
    }
    cuts.push(len);
    return new Set(cuts).size===cuts.length?cuts:null;
  };
  let best=null;
  for(let nx=1;nx<=8;nx++)for(let ny=1;ny<=8;ny++){
    if(best&&nx*ny>=best.n)continue;
    const cx=pick(xs,W,nx),cy=pick(ys,H,ny);
    if(!cx||!cy)continue;
    let ok=true;
    for(let i=0;i<nx&&ok;i++)for(let j=0;j<ny&&ok;j++)if(!fitsPrinter({w:cx[i+1]-cx[i],d:cy[j+1]-cy[j],h},P))ok=false;
    if(ok)best={n:nx*ny,cx,cy};
  }
  return best;
}

export function printedBody(G,L,P,geo){
  const key=[G,L,P,geo];
  if(cache.key&&cache.key.every((v,i)=>v===key[i]))return cache.out;
  const out=build(G,L,P,geo);
  cache.key=key;cache.out=out;
  return out;
}

function build(G,L,P,geo){
  const errors=[],warnings=[],notes=[];
  const {t,depth,tunnelW:tw,tunnelH}=G,W=P.W,H=P.H,B=P.B,S=P.S;
  const flat=P.orient==='flat';
  const F=flat?P.pbFloor:0,top=flat?F+depth+S:depth,z1=F+depth;
  if(P.angled&&geo.pieces.some(p=>p.kind==='angle'))errors.push('A printed body cannot have angled walls yet. Turn off Use angled shapes.');
  const left=[];
  if(geo.heat||geo.edgeHeat)left.push('heat');
  if(geo.sensorBoxes.length)left.push('sensor pockets');
  if(L.pillars.length||P.broodPillar)left.push('pillars');
  if(geo.vials.length)left.push('vial holders');
  if(L.reservoirs.length)left.push('water chambers');
  if(left.length)errors.push(`A printed body does not have ${left.join(', ')} yet. Remove them, or use the all acrylic build.`);
  if(B<8)errors.push('A printed body needs a border of at least 8mm.');

  const add=[],sub=[];
  // floor and border
  if(flat)add.push([0,0,0,W,H,F]);
  add.push([0,0,0,W,B,top],[0,H-B,0,W,H,top],[0,0,0,B,H,top],[W-B,0,0,W,H,top]);
  // walls and sponge pockets, from the same pieces as the acrylic strips
  for(const pc of geo.pieces){
    if(pc.kind==='angle')continue;
    const box=(u0,u1,za,zb,grow=0)=>pc.orient==='H'?[u0,pc.c-t/2-grow,za,u1,pc.c+t/2+grow,zb]:[pc.c-t/2-grow,u0,za,pc.c+t/2+grow,u1,zb];
    add.push(box(pc.s,pc.e,F,z1));
    // tunnels open from the top of the print, the service side either way
    for(const n of pc.notches)sub.push(box(n-tw/2,n+tw/2,z1-tunnelH,top+1,0.01));
    // sponge vent slots become a grille of slits
    for(const [a0,a1] of pc.windows)sub.push(box(pc.s+a0,pc.s+a1,F+2,z1-2,0.01));
  }
  // ports: a channel through the border, the full depth, as on the acrylic frame
  const ports=geo.ports.filter(p=>p.cut);
  for(const p of ports){
    const a=p.pos-tw/2,b=p.pos+tw/2;
    if(p.side==='top')sub.push([a,-1,F,b,B+0.01,z1]);
    if(p.side==='bottom')sub.push([a,H-B-0.01,F,b,H+1,z1]);
    if(p.side==='left')sub.push([-1,a,F,B+0.01,b,z1]);
    if(p.side==='right')sub.push([W-B-0.01,a,F,W+1,b,z1]);
  }
  // flat: the top sheet drops into a recess half the border wide, with a finger notch to lift it
  const inset=B/2;
  if(flat){
    sub.push([inset,inset,z1,W-inset,H-inset,top+1]);
    if(P.liftNotch){
      // on the first edge with no port under the middle
      const free=side=>!ports.some(p=>p.side===side&&Math.abs(p.pos-(side==='top'||side==='bottom'?W:H)/2)<NOTCH/2+tw);
      const side=['top','bottom','left','right'].find(free)||'top';
      const h=NOTCH/2,cx=W/2,cy=H/2;
      sub.push(side==='top'?[cx-h,-1,z1,cx+h,inset+0.01,top+1]:side==='bottom'?[cx-h,H-inset-0.01,z1,cx+h,H+1,top+1]
        :side==='left'?[-1,cy-h,z1,inset+0.01,cy+h,top+1]:[W-inset-0.01,cy-h,z1,W+1,cy+h,top+1]);
    }
  }

  // tiles, split along wall lines so seams run down the middle of a wall
  const prints=[],T=tiles(G,P,top);
  if(!T)errors.push(`The printed body is too big to split into tiles that fit the ${P.printW} x ${P.printD} x ${P.printH}mm print area. Use a bigger printer setting, or a smaller panel.`);
  else if(!errors.length){
    const nx=T.cx.length-1,ny=T.cy.length-1;
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      const x0=T.cx[i],x1=T.cx[i+1],y0=T.cy[j],y1=T.cy[j+1];
      const clip=b=>[Math.max(b[0],x0),Math.max(b[1],y0),b[2],Math.min(b[3],x1),Math.min(b[4],y1),b[5]];
      const ok=b=>b[3]>b[0]+1e-6&&b[4]>b[1]+1e-6;
      // turned so it matches the preview seen from above
      const tris=meshBoxes(add.map(clip).filter(ok),sub.map(clip).filter(ok)).map(tr=>tr.map(([x,y,z])=>[x,-y,z]).reverse());
      prints.push({name:nx*ny>1?`body tile ${String.fromCharCode(65+j)}${i+1}`:'body',qty:1,tris});
    }
    if(nx*ny>1)notes.push(`The body is split into ${nx*ny} tiles (${nx} x ${ny}), lettered by row from the top and numbered from the left. Each seam runs down the middle of a wall. Glue the tiles together, then check the seams are sealed before ants go in.`);
  }

  // plugs for unused ports, and an adaptor that takes a tube for each port in use
  const unused=ports.filter(p=>!p.used).length,used=ports.filter(p=>p.used).length;
  if(unused){
    const pp=plugPart(G,P);
    prints.push({name:'port plug',qty:unused,solids:[partSolid({poly:pp.poly},0,depth-2*PLUG_FIT)]});
  }
  {
    const D=P.pbTubeOD+0.4,sq=D+2*SOCK_WALL,sw=tw-2*PLUG_FIT,sh=depth-2*PLUG_FIT;
    const pw=Math.max(1,sw-2*ADAPT_WALL);
    let ph=Math.max(1,sh-2*ADAPT_WALL);
    ph=Math.min(ph,2*Math.sqrt(Math.max(0,(D/2)**2-(pw/2)**2))-0.6);
    const fw=Math.max(sw+6,sq),fh=Math.max(sh+4,sq),zf=SOCK_LEN,zs=zf+2,len=B-1;
    if(ph<3)errors.push('The tube for the port adaptors is too small for these tunnels.');
    const tris=[...meshInPlace([{outer:rectPts(-sq/2,-sq/2,sq/2,sq/2),holes:[circlePts(0,0,D)],z0:0,z1:SOCK_LEN}]),
      ...meshBoxes([[-fw/2,-fh/2,zf,fw/2,fh/2,zs],[-sw/2,-sh/2,zs,sw/2,sh/2,zs+len]],[[-pw/2,-ph/2,zf-1,pw/2,ph/2,zs+len+1]])];
    prints.push({name:'port tube adaptor',qty:Math.max(1,used),tris});
    if(!used)notes.push('On the nest page, mark the ports you join tubes to as used with the Ports tool. One tube adaptor is printed until then.');
  }

  // upright: clips along the sides and top, and two feet along the bottom, clear of the ports
  if(!flat){
    const T2=depth+2*S,g=T2-CLIP_GRIP,reach=Math.min(B-2,10),c=CLIP_WALL;
    const profile=foot=>{
      const a=[[-c,-c,0,g+c,0,CLIP_LEN],[-c,-c,0,0,reach,CLIP_LEN],[g,-c,0,g+c,reach,CLIP_LEN]];
      if(foot)a.push([-25,-c-4,0,g+25,-c,CLIP_LEN]);
      return meshBoxes(a,[]);
    };
    const spots=(side,len)=>{
      const busy=q=>ports.some(p=>p.side===side&&Math.abs(p.pos-q)<tw/2+CLIP_LEN/2+2);
      return [0.25,0.75].map(f=>{
        for(let d=0;d<len/4;d+=2)for(const q of [len*f-d,len*f+d])if(q>B+CLIP_LEN&&q<len-B-CLIP_LEN&&!busy(q))return q;
        return null;
      });
    };
    let clips=0;
    for(const [side,len] of [['left',H],['right',H],['top',W]]){
      const s=spots(side,len);
      if(s.includes(null))warnings.push(`No room for an edge clip clear of the ports on the ${side} edge.`);
      clips+=s.filter(q=>q!==null).length;
    }
    if(spots('bottom',W).includes(null))errors.push('No room for the feet clear of the ports on the bottom edge.');
    prints.push({name:'edge clip',qty:clips,tris:profile(false)},{name:'foot',qty:2,tris:profile(true)});
    notes.push(`Edge clips grip the ${f1(T2)}mm stack of sheets and body. Push them on at the quarter points of each edge, clear of the ports.`);
  }

  for(const it of prints){
    const b=it.tris?meshBounds(it.tris):{w:0,d:0,h:0};
    if(it.tris&&!fitsPrinter(b,P))errors.push(`The printed ${it.name} is ${f1(b.w)} x ${f1(b.d)} x ${f1(b.h)}mm, too big for the print area.`);
  }

  // the acrylic: a drop-in top sheet (flat), or front and back sheets (upright)
  const sheets=[];
  const holesFor=(side,off)=>{
    const svc=side==='service',h=[];
    if(svc)for(const s of geo.doorSlots)h.push({poly:(s.poly||rectPts(s.x0,s.y0,s.x1,s.y1)).map(([x,y])=>[x-off,y-off])});
    if(svc&&(P.fillSide!=='front'||flat)||(!svc&&(P.fillSide==='front'||P.fillSide==='both')))for(const f of geo.fills)h.push({c:[f.x-off,f.y-off,P.fillD]});
    if(side==='vents')for(const v of geo.vents)h.push({c:[v.x-off,v.y-off,P.ventD]});
    return h;
  };
  if(flat){
    const off=inset+SHEET_FIT,w=W-2*off,h=H-2*off;
    sheets.push({name:'top sheet',w,h,holes:[...holesFor('service',off),...holesFor('vents',off)]});
    if(P.fillSide==='back')warnings.push('Fill holes cannot go in a printed floor, so they are in the top sheet.');
  }else{
    sheets.push({name:'front sheet',w:W,h:H,holes:[...holesFor('front',0),...holesFor('vents',0)]});
    sheets.push({name:'back sheet',w:W,h:H,holes:holesFor('service',0)});
  }
  const d=pen(P),files=[];
  for(const s of sheets){
    const b=[d.outline(rectPts(0,0,s.w,s.h))];
    for(const hh of s.holes)b.push(hh.poly?d.cutout(hh.poly):d.hole(...hh.c));
    files.push({name:s.name.replace(' ','-')+'.svg',data:svgDoc(s.w,s.h,b.join('\n'),`${s.name[0].toUpperCase()+s.name.slice(1)} for the printed body`)});
  }
  // doors and saddles are still cut, as they slide in the tunnel notches
  const doorParts=P.doorType==='none'?[]:doorType(P).parts(G,P,geo.doors.length);
  if(doorParts.length){
    const items=doorParts.flatMap(p=>Array.from({length:p.qty},()=>p));
    let x=5,y=5,row=0;const b=[],SW=P.stockW;
    for(const p of items){
      if(x+p.w>SW-5){x=5;y+=row+2+P.kerf;row=0;}
      b.push(d.outline(p.poly,x,y));
      for(const hh of p.holes||[])b.push(d.cutout(hh,x,y));
      x+=p.w+2+P.kerf;row=Math.max(row,p.h);
    }
    files.push({name:'doors-sheet.svg',data:svgDoc(SW,y+row+5,b.join('\n'),'Doors and saddles')});
  }
  for(const it of prints)files.push(printFile(it));
  notes.push(flat?`The body prints as a ${fmt(top)}mm deep tray with a ${fmt(F)}mm floor. The top sheet drops into a ${fmt(S)}mm recess and rests on the walls.`
    :'The body is the frame and walls only. The sheets go either side and the clips hold them on.');
  notes.push('Docking an outworld straight onto a nest needs the all acrylic build. Join a printed body with tubes and the port adaptors.');
  return {errors,warnings,notes,files,prints,tiles:T};
}
