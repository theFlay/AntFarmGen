// Outworld: a tabbed box the ants forage in, joined to a nest by a tube or docked straight onto
// its edge. It reads the sheet, kerf, port and machine settings from the nest page.
import {fmt,f1,rectPts} from './util.js';
import {pen,svgDoc} from './export.js';
import {cleanParam} from './sanitize.js';
import {plate,spread,packParts} from './rack.js';
import {derive} from './grid.js';
import {heatDepth,heatFrameLayers,borderHeatOn,borderRow} from './heat.js';
import {coverStand,FOOT_LIFT} from './hardware.js';
import {MAT_OPTS} from './params.js';
import {partSolid,ringSolid,circlePts,printFile,solidBounds,fitsPrinter} from './stl.js';

// part types that can be cut or printed
export const OUT_MATS=[
  ['side','Side walls'],['ends','End walls'],['floor','Floor'],['lid','Lid or lip ring'],
  ['clip','Edge clips','Printed clips are 5mm thick, so they spring onto the nest.'],
  ['bar','Dock bars'],['pin','Dock pins'],['dkey','Dock keys'],
  ['tdock','Tube docks','Printed docks have a socket that holds the tube for 10mm.'],
  ['tport','Tube ports','Acrylic is a plain hole. Printed adds a sleeve that grips the tube.'],
  ['bulk','Bulkhead rings'],
];
export const OUT_FIELDS=[
  {k:'owL',l:'Inside length (mm)',d:250,step:1,range:[60,1500]},
  {k:'owW',l:'Inside width (mm)',d:150,step:1,range:[40,1000],h:'The port wall is this wide, plus the walls.'},
  {k:'owH',l:'Inside height (mm)',d:80,step:1,range:[20,400],h:'Measured from the floor. Leave room above any sand or soil.'},
  {k:'lid',l:'Lid',d:'lift',opts:[['lift','Lift-off lid'],['slide','Sliding lid'],['open','Open top with a lip']],h:'Lift-off is the simplest. Sliding is harder to leave open by mistake. Open top needs a barrier coating such as Fluon below the lip.'},
  {k:'lipW',l:'Lip width, open top (mm)',d:12,step:1,range:[5,60],h:'How far the lip reaches in over the walls.'},
  {k:'ventD',l:'Vent hole diameter (mm)',d:1,step:0.1,range:[0.5,10],h:'Smaller than the head of your smallest worker.'},
  {k:'ventCols',l:'Vent holes along the length',d:8,step:1,range:[0,40]},
  {k:'ventRows',l:'Vent holes across',d:4,step:1,range:[0,40]},
  {k:'connect',g:'Connection',l:'Joins the nest by',d:'tube',opts:[['tube','A tube'],['direct','Docking onto the nest'],['none','Nothing']],h:'Docking butts the port wall against the nest edge, with a window lined up with one nest port. Flat nests clamp on with bars. Upright nests stand beside it and clip on at a side port.'},
  {k:'dockPort',g:'Connection',l:'Upright nest port to dock (0 = lowest)',d:0,step:1,range:[0,200],h:'The number of a port on the left or right edge, as shown on the nest page. 0 picks the lowest one.'},
  {k:'clipGrip',g:'Connection',l:'Edge clip grip (mm)',d:0.2,step:0.05,range:[0,1],h:'How much narrower than the nest the clips are, so they hold on.'},
  {k:'tubes',g:'Connection',l:'Tube holes',d:1,step:1,range:[1,4],h:'All in the port wall, just above the floor.'},
  {k:'tubeOD',g:'Connection',l:'Tube outside diameter (mm)',d:12,step:0.5,range:[4,30]},
  {k:'tubeID',g:'Connection',l:'Tube inside diameter (mm)',d:8,step:0.5,range:[2,28],h:'Should be at least the nest tunnel width.'},
  {k:'tubeClear',g:'Connection',l:'Tube hole clearance (mm)',d:0,step:0.1,range:[-2,3],h:'Added to the outside diameter. Negative grips tighter. Tune it with the tube hole test.'},
  {k:'nestDock',g:'Connection',l:'Cut a tube dock for the nest',d:true,bool:true,h:'A plate with a tube hole that fixes over a nest port. One for each tube.'},
  {k:'bulkheads',g:'Connection',l:'Bulkheads for a bought tub',d:0,step:1,range:[0,10],h:'Two rings each. Drill the tub, ring each side, push the tube through.'},
  ...OUT_MATS.map(([k,l,h])=>({k:'m_'+k,g:'Materials',l,d:'acrylic',opts:MAT_OPTS,h})),
];
export const outDefaults=()=>Object.fromEntries(OUT_FIELDS.map(f=>[f.k,f.d]));
export const cleanOut=O=>Object.fromEntries(OUT_FIELDS.map(f=>[f.k,cleanParam(f,f.k in O?O[f.k]:f.d)]));

// fixed sizes, first guesses until a test cut
const LIFT=3,BAR_W=10,PIN_L=8,SLIT_FIT=0.1,KEY_SLOT=2.7,ARM=4,CLIP_SPINE=4,CLIP_PRINT=5,SLEEVE_WALL=1.6,SOCKET=10;
export const DOCK_KEY={name:'dock key',key:'dkey',w:12,h:2.6,poly:[[0,0],[12,0],[12,2.6],[0,1.6]],holes:[],circles:[],labels:[]};

// heights above the bench of a flat nest's port and top face
export function nestHeights(P){
  const G=derive(P),base=heatDepth(G,P),hf=borderHeatOn(P)?heatFrameLayers(P)*G.t:0;
  return {G,base,portBot:base+P.S+hf,portTop:base+P.S+G.depth,top:base+2*P.S+G.depth,stack:2*P.S+G.depth};
}
// nest ports with a joining slot each side, so a dock can clamp over them
export function dockablePorts(P,geo){
  if(!geo)return [];
  const h=P.portPitch/2;
  return geo.ports.filter(p=>p.cut&&[p.pos-h,p.pos+h].every(q=>geo.joints.some(j=>j.side===p.side&&Math.abs(j.pos-q)<1e-3)));
}
// ports on the left and right edges of an upright nest, lowest first
export function sidePorts(P,geo){
  if(geo)return geo.ports.filter(p=>p.cut&&(p.side==='left'||p.side==='right')).sort((a,b)=>b.pos-a.pos);
  const out=[];
  if(P.portPitch>=5)for(let q=P.portOffset;q<=P.H-P.portOffset+1e-6;q+=P.portPitch)out.push({id:'',side:'right',pos:q});
  return out.sort((a,b)=>b.pos-a.pos);
}
// Edge clip, seen from above: two arms grip the front and back of an upright nest, pass through
// slits in the wall, and join behind it. x runs from the arm tips (over the nest) into the box.
export function clipPart(stack,grip,reach,t,thick){
  const gap=stack-grip,W=gap+2*ARM,L=reach+t+CLIP_SPINE,c=1,a=ARM;
  return {name:'edge clip',key:'clip',w:L,h:W,thick,holes:[],circles:[],labels:[],
    poly:[[0,0],[L,0],[L,W],[0,W],[0,a+gap+c],[c,a+gap],[reach+t,a+gap],[reach+t,a],[c,a],[0,a-c]]};
}

export function buildOutworld(input,P,geo){
  const O=cleanOut(input),t=P.t,cl=P.slotClear,errors=[],warnings=[],notes=[];
  const pr=k=>O['m_'+k]==='print';
  const L=O.owL,W=O.owW,floorTop=LIFT+t;
  const slide=O.lid==='slide',topTabs=O.lid!=='slide';
  const e=slide?8:4;                             // end walls reach past the side walls, so slots there keep a rim
  const Wt=W+2*t+2*e;
  const Hl=floorTop+O.owH;                       // side walls
  const Hw=slide?Hl+t+0.3+5:Hl;                  // end walls rise over a sliding lid
  const NH=nestHeights(P),pitch=P.portPitch,docking=O.connect==='direct',tube=O.connect==='tube';
  const upright=P.orient==='upright',stack=NH.stack;
  const D=O.tubeOD+O.tubeClear;
  const sleeveOD=D+2*SLEEVE_WALL,portHole=pr('tport')?sleeveOD+0.1:D;
  const clipH=pr('clip')?CLIP_PRINT:t,reach=Math.min(12,P.B-2);
  const parts=[],lidParts=[],conn=[];
  const sl=Math.min(10,(Hl-floorTop)/4);
  const sideZ=Hl-floorTop>=40?[floorTop+(Hl-floorTop)*0.3,floorTop+(Hl-floorTop)*0.75]:[(floorTop+Hl)/2];
  const xs=spread(L,10),ys=spread(W,10);
  // a part drawn with heights measured up from the bench
  function wall(name,key,w,h,f,cuts=[],circles=[]){
    const p=plate(w,h,f);
    const rz=([u0,z0,u1,z1])=>rectPts(u0+p.ox,h-z1+p.oy,u1+p.ox,h-z0+p.oy);
    return {name,key,w:p.w,h:p.h,poly:p.poly,holes:cuts.map(rz),circles:circles.map(([u,z,d])=>[u+p.ox,h-z+p.oy,d]),labels:[],ox:p.ox,oy:p.oy,H:h};
  }
  const baseSlot=u=>[u-5-cl/2,LIFT-cl/2,u+5+cl/2,LIFT+t+cl/2];
  // side walls run between the end walls
  for(let i=0;i<2;i++){
    const f={left:sideZ.map(z=>({u:Hl-z,l:sl,d:t})),right:sideZ.map(z=>({u:Hl-z,l:sl,d:t}))};
    if(topTabs)f.top=xs.map(u=>({u,l:10,d:t}));
    parts.push(wall('side wall','side',L,Hl,f,xs.map(baseSlot)));
  }
  // end walls: the port wall faces the nest, the far wall faces away
  const endCuts=()=>[...[e+t/2,e+1.5*t+W].flatMap(u=>sideZ.map(z=>[u-t/2-cl/2,z-sl/2-cl/2,u+t/2+cl/2,z+sl/2+cl/2])),...ys.map(u=>baseSlot(e+t+u))];
  const endTabs=()=>topTabs?{top:ys.map(u=>({u:e+t+u,l:10,d:t}))}:{};
  const portCuts=endCuts(),portHoles=[];
  if(tube){
    const gapW=W/O.tubes;
    if(gapW<portHole+4)errors.push(`${O.tubes} tube holes of ${f1(portHole)}mm do not fit across a ${W}mm wall.`);
    for(let i=0;i<O.tubes;i++)portHoles.push([e+t+gapW*(i+0.5),floorTop+portHole/2+2,portHole]);
    if(floorTop+portHole+2>Hl-3)errors.push('The tube holes are taller than the walls.');
  }
  // slits for the clamp bars of a flat nest, at its joining slots either side of the port
  const slitsAt=(w0,w1)=>[w0,w1].map(u=>[u-BAR_W/2-SLIT_FIT,NH.top,u+BAR_W/2+SLIT_FIT,NH.top+t+2*SLIT_FIT]);
  // slits for the two arms of an edge clip, either side of a nest edge centred at u
  const clipSlits=(u,z)=>{const u0=u-stack/2,g=O.clipGrip/2,z0=z-clipH/2-SLIT_FIT,z1=z+clipH/2+SLIT_FIT;
    return [[u0+g-ARM-SLIT_FIT,z0,u0+g+SLIT_FIT,z1],[u0+stack-g-SLIT_FIT,z0,u0+stack-g+ARM+SLIT_FIT,z1]];};
  let dock=null;                                 // where an upright nest's port meets the wall
  const clamp=upright?'clip':'bar';
  const docks=docking?1:tube&&O.nestDock?O.tubes:0;
  if(docking&&!upright){
    const z0=Math.max(NH.portBot,floorTop),z1=NH.portTop;
    if(z1-z0<3)errors.push('The nest port sits below the outworld floor, so a dock window would be too low. Use a tube.');
    else portCuts.push([Wt/2-NH.G.tunnelW/2,z0,Wt/2+NH.G.tunnelW/2,z1]);
    if(NH.portBot<floorTop-0.5)notes.push(`The outworld floor is ${f1(floorTop-NH.portBot)}mm above the bottom of the nest port, so the ants step up into it.`);
    if(NH.top+t+5>Hw)errors.push('The outworld is too low to dock onto this nest.');
    if(W<pitch+BAR_W+2)errors.push(`The port wall must be at least ${f1(pitch+BAR_W+2)}mm wide inside to reach the joining slots ${pitch/2}mm either side of the port.`);
    portCuts.push(...slitsAt(Wt/2-pitch/2,Wt/2+pitch/2));
  }
  if(docking&&upright){
    const list=sidePorts(P,geo),port=O.dockPort?list.find(p=>p.id==='P'+O.dockPort):list[0];
    if(!port)errors.push(O.dockPort?`Port P${O.dockPort} is not a port on the left or right edge of the nest.`:'The nest has no ports on its left or right edge to dock to.');
    else{
      const zc=FOOT_LIFT+P.H-port.pos,tw=NH.G.tunnelW,zClip=[zc-tw/2-3-clipH/2,zc+tw/2+3+clipH/2];
      dock={port,zc};
      const pid=port.id||'the lowest side port';
      if(zc-tw/2<floorTop)errors.push(`The port (${pid}) sits below the outworld floor. Pick a higher port.`);
      else notes.push(`Docks onto ${pid}, ${f1(zc-tw/2-floorTop)}mm above the outworld floor. Most ants climb acrylic. For ones that cannot, add a ramp or deeper sand.`);
      if(zClip[1]+clipH/2+3>Hl)errors.push(`That port is ${f1(zc)}mm up. Make the outworld at least ${Math.ceil(zClip[1]+clipH/2+3-floorTop)}mm tall inside, or pick a lower port.`);
      if(W<stack+2*ARM+2)errors.push(`The port wall must be at least ${f1(stack+2*ARM+2)}mm wide inside.`);
      portCuts.push([Wt/2-stack/2+P.S,zc-tw/2,Wt/2+stack/2-P.S,zc+tw/2]);
      for(const z of zClip)portCuts.push(...clipSlits(Wt/2,z));
    }
  }
  if(docks){
    if(!upright){
      if(!P.joinSlots||P.B<12||P.portPitch<5)errors.push('On a flat nest, a dock clamps on through the nest joining slots. Turn on Slots for joining panels on the nest page (needs a border of 12mm or more).');
      const ok=dockablePorts(P,geo);
      if(geo){
        if(!ok.length)errors.push('No port on this nest has a joining slot on both sides, so there is nowhere to dock.');
        else{
          notes.push(`Docks fit nest port${ok.length>1?'s':''} ${ok.map(p=>p.id).join(', ')}.`);
          if(!ok.some(p=>p.used))warnings.push('On the nest page, mark the port you dock to as used with the Ports tool, so no plug is cut for it.');
        }
      }
      if(P.coverType==='whole'&&coverStand(NH.G,P)<t+3.5)warnings.push('The red cover sits too low to clear the dock clamps. Raise the cover gap on the nest page.');
    }else{
      if(reach<6)errors.push('Edge clips need a nest border of at least 8mm to grip.');
      if(geo&&!geo.ports.some(p=>p.used&&(p.side==='left'||p.side==='right')))warnings.push('On the nest page, mark the port you dock to as used with the Ports tool, so no plug is cut for it.');
    }
  }
  parts.push(wall('port wall','ends',Wt,Hw,endTabs(),portCuts,portHoles));
  const farCuts=endCuts();
  if(slide)farCuts.push([e-0.2,Hl,e+2*t+W+0.2,Hl+t+0.3]);
  parts.push(wall(slide?'front wall with lid slot':'front wall','ends',Wt,Hw,endTabs(),farCuts));
  // floor: sits a little up the walls so their slots keep a rim below
  {
    const f={top:xs.map(u=>({u,l:10,d:t})),bottom:xs.map(u=>({u,l:10,d:t})),left:ys.map(u=>({u,l:10,d:t})),right:ys.map(u=>({u,l:10,d:t}))};
    const p=plate(L,W,f);
    parts.push({name:'floor',key:'floor',w:p.w,h:p.h,poly:p.poly,holes:[],circles:[],labels:[]});
  }
  // vents over the inside, kept clear of the walls
  const vents=(x0,y0,w,h)=>{
    const out=[];if(!O.ventCols||!O.ventRows)return out;
    const m=10;
    for(let i=0;i<O.ventCols;i++)for(let j=0;j<O.ventRows;j++)
      out.push([x0+m+(w-2*m)*(O.ventCols>1?i/(O.ventCols-1):0.5),y0+m+(h-2*m)*(O.ventRows>1?j/(O.ventRows-1):0.5),O.ventD]);
    return out;
  };
  const topSlots=()=>{
    const s=[];
    // the lid reaches e past the end walls too, so no slot runs out to its edge
    for(const x of [e+t/2,e+L+1.5*t])for(const u of ys)s.push(rectPts(x-t/2-cl/2,e+t+u-5-cl/2,x+t/2+cl/2,e+t+u+5+cl/2));
    for(const y of [e+t/2,e+1.5*t+W])for(const u of xs)s.push(rectPts(e+t+u-5-cl/2,y-t/2-cl/2,e+t+u+5+cl/2,y+t/2+cl/2));
    return s;
  };
  const lidL=L+2*t+2*e;
  if(O.lid==='lift')lidParts.push({name:'lid',key:'lid',w:lidL,h:Wt,poly:rectPts(0,0,lidL,Wt),holes:topSlots(),circles:vents(e+t,e+t,L,W),labels:[]});
  if(O.lid==='open'){
    const m=O.lipW;
    if(W-2*m<20||L-2*m<20)errors.push('The lip is too wide for this box.');
    else lidParts.push({name:'lip ring',key:'lid',w:lidL,h:Wt,poly:rectPts(0,0,lidL,Wt),holes:[...topSlots(),rectPts(e+t+m,e+t+m,e+t+L-m,e+t+W-m)],circles:[],labels:[]});
    warnings.push('An open top only holds ants that cannot climb a barrier coating. Paint Fluon or PTFE on the walls just below the lip, and keep it fresh.');
  }
  if(slide){
    // rests on the side walls, slides out through the front wall, stops at the port wall
    const tongue=16,len=L+t+tongue,wid=W+2*t;
    lidParts.push({name:'sliding lid',key:'lid',w:len,h:wid,poly:rectPts(0,0,len,wid),holes:[],circles:[...vents(0,t,L,W),[L+t+tongue/2,wid/2,9]],labels:[]});
  }
  // flat nests: a bar lies on the nest's top face, through a slit in the wall, and a key pulls the two together
  if(docks&&clamp==='bar'){
    const reachB=borderRow(P);
    const x0=-(reachB+PIN_L/2+4),x1=t+KEY_SLOT+4,len=x1-x0,c=v=>v-x0,hw=BAR_W/2;
    const pinHole=rectPts(c(-reachB-PIN_L/2-0.1),hw-t/2-0.1,c(-reachB+PIN_L/2+0.1),hw+t/2+0.1);
    const keyHole=rectPts(c(t),hw-t/2-0.1,c(t+KEY_SLOT),hw+t/2+0.1);
    const head=PIN_L+6,shank=t+NH.stack-1,pw=PIN_L-0.2,ee=(head-pw)/2,ph=3+shank;
    for(let k=0;k<docks;k++){
      for(let i=0;i<2;i++){
        conn.push({name:'dock bar',key:'bar',w:len,h:BAR_W,poly:rectPts(0,0,len,BAR_W),holes:[pinHole,keyHole],circles:[],labels:[]});
        conn.push({name:'dock pin',key:'pin',w:head,h:ph,poly:[[0,0],[head,0],[head,3],[head-ee,3],[head-ee,ph],[ee,ph],[ee,3],[0,3]],holes:[],circles:[],labels:[]});
        conn.push({...DOCK_KEY});
      }
    }
  }
  // upright nests: edge clips, two at each dock
  if(docks&&clamp==='clip')for(let k=0;k<2*docks;k++)conn.push(clipPart(stack,O.clipGrip,reach,t,clipH));
  if(tube&&O.nestDock){
    // a plate over the nest port: the tube passes through it and butts on the nest edge
    let Wd,Hd,hole,slits;
    if(!upright){
      const mid=(NH.portBot+NH.portTop)/2,room=Math.min(mid,NH.top-mid)-1.5;
      if(D/2>room)errors.push(`A ${f1(D)}mm tube is too big for the nest dock. It can take up to ${f1(2*room)}mm on this nest.`);
      Wd=pitch+BAR_W+16;Hd=NH.top+t+0.2+5;hole=[Wd/2,mid,D];slits=slitsAt(Wd/2-pitch/2,Wd/2+pitch/2);
    }else{
      if(D>stack+2)errors.push(`A ${f1(D)}mm tube is too big for the nest dock. It can take up to ${f1(stack+2)}mm on this nest.`);
      Wd=stack+2*ARM+12;Hd=D+2*(3+clipH+3);hole=[Wd/2,Hd/2,D];
      slits=[Hd/2-D/2-3-clipH/2,Hd/2+D/2+3+clipH/2].flatMap(z=>clipSlits(Wd/2,z));
    }
    for(let k=0;k<O.tubes;k++)conn.push(wall('tube dock','tdock',Wd,Hd,{},slits,[hole]));
  }
  if(tube&&O.tubeID<NH.G.tunnelW)warnings.push(`The tube is ${f1(O.tubeID)}mm inside, narrower than the ${f1(NH.G.tunnelW)}mm nest tunnels. Queens may not fit.`);
  if(tube&&O.tubeID>=O.tubeOD)errors.push('The tube inside diameter must be smaller than the outside.');
  for(let i=0;i<O.bulkheads;i++)for(let k=0;k<2;k++){
    const s=O.tubeOD+16;
    conn.push({name:'bulkhead ring',key:'bulk',w:s,h:s,poly:rectPts(0,0,s,s),holes:[],circles:[[s/2,s/2,D]],labels:[]});
  }
  if(O.ventD>2)warnings.push('Vent holes over 2mm let most small workers out.');
  // printed parts: grouped by type, with the shapes that only make sense printed
  const prints=[],byName=new Map();
  for(const p of [...parts,...lidParts,...conn])if(pr(p.key)){
    if(!byName.has(p.name))byName.set(p.name,{p,qty:0});
    byName.get(p.name).qty++;
  }
  for(const [name,{p,qty}] of byName){
    const h=p.thick||t,solids=[partSolid(p,0,h)];
    if(p.key==='tdock'){const [cx,cy,d]=p.circles[0];solids.push(ringSolid(circlePts(cx,cy,d+2*SLEEVE_WALL),circlePts(cx,cy,d),h,h+SOCKET));}
    prints.push({name,qty,solids});
  }
  if(tube&&pr('tport')){
    const c=0,fl=sleeveOD+8;
    prints.push({name:'tube sleeve',qty:O.tubes,solids:[ringSolid(circlePts(c,c,fl),circlePts(c,c,D),0,2),ringSolid(circlePts(c,c,sleeveOD),circlePts(c,c,D),2,2+t+8)]});
  }
  for(const it of prints){
    const b=solidBounds(it.solids);
    if(!fitsPrinter(b,P))errors.push(`The printed ${it.name} is ${f1(b.w)} x ${f1(b.d)} x ${f1(b.h)}mm, too big for the ${P.printW} x ${P.printD} x ${P.printH}mm print area. Set it to acrylic.`);
  }
  const cut=list=>list.filter(p=>!pr(p.key));
  for(const p of cut([...parts,...lidParts,...conn]))if(p.w>P.stockW-10||p.h>P.stockH-10)errors.push(`The ${p.name} is ${fmt(p.w)} x ${fmt(p.h)}mm, too big for the ${P.stockW} x ${P.stockH}mm sheet.`);
  if(prints.length)notes.push('Printed parts match the acrylic sizes with no kerf offset. Print one first and check it fits.');
  return {O,P,parts,lidParts,conn,prints,cutParts:cut(parts),cutLid:cut(lidParts),cutConn:cut(conn),
    errors:[...new Set(errors)],warnings,notes,L,W,Wt,Hl,Hw,e,floorTop,outL:L+2*t,portHoles,docking,NH,upright,dock,clipH,reach};
}

export function outworldFiles(ow,colors){
  const {P}=ow,stock={stockW:P.stockW,stockH:P.stockH,kerf:P.kerf},d=pen({kerf:P.kerf,...colors}),files=[];
  const draw=(list,name,title)=>{
    if(!list.length)return;
    packParts(list,stock).forEach((sheet,i,all)=>{
      const b=[];
      for(const {it,x,y} of sheet){
        b.push(d.outline(it.poly,x,y));
        for(const h of it.holes)b.push(d.cutout(h,x,y));
        for(const [cx,cy,dia] of it.circles)b.push(d.hole(x+cx,y+cy,dia));
      }
      files.push({name:`${name}${all.length>1?'-'+(i+1):''}.svg`,data:svgDoc(P.stockW,P.stockH,b.join('\n'),title)});
    });
  };
  draw(ow.cutParts,'outworld-box','Outworld walls and floor');
  draw(ow.cutLid,'outworld-lid','Outworld lid');
  draw(ow.cutConn,'outworld-connectors','Docks, clips, clamp bars, pins, keys and bulkhead rings');
  for(const it of ow.prints)files.push(printFile({...it,name:'outworld '+it.name}));
  return files;
}
// holes either side of the tube size, to find a grip that holds without splitting
export function tubeHoleTest(input,P){
  const O=cleanOut(input),d=pen({kerf:P.kerf,cutColor:P.cutColor||'#ff0000',engraveColor:P.engraveColor||'#000000'});
  const steps=[-0.6,-0.4,-0.2,0,0.2,0.4,0.6],D=O.tubeOD,pitch=D+9,W=steps.length*pitch+8,H=D+22,b=[d.outline(rectPts(0,0,W,H))];
  steps.forEach((c,i)=>{
    const x=8+D/2+i*pitch;
    b.push(d.hole(x,6+D/2,D+c),d.txt(x,D+14,(c>0?'+':'')+fmt(c),3));
  });
  return {name:'tube-hole-test.svg',data:svgDoc(W,H,b.join('\n'),'Tube hole test')};
}
// top view, and the port wall seen from the nest side
export function outworldPreview(ow){
  const {P,L,W,Wt,Hw,Hl,e,outL,O,NH,upright,dock}=ow,t=P.t,gap=24,nestW=40,stack=NH.stack;
  const viewW=nestW+outL+20,viewH=Wt+gap+Hw+20;
  const o=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-${nestW} -8 ${fmt(viewW)} ${fmt(viewH)}" font-family="system-ui,Arial,sans-serif">`];
  const wallC='#4a7fa8',floorC='#e8eef2',clampC='#d08c2c',nestC='#f7f4ee';
  o.push(`<rect x="0" y="0" width="${fmt(outL)}" height="${fmt(Wt)}" fill="${floorC}"/>`);
  o.push(`<rect x="0" y="0" width="${fmt(t)}" height="${fmt(Wt)}" fill="${wallC}"/><rect x="${fmt(outL-t)}" y="0" width="${fmt(t)}" height="${fmt(Wt)}" fill="${wallC}"/>`);
  for(const y of [e,e+t+W])o.push(`<rect x="${fmt(t)}" y="${fmt(y)}" width="${fmt(L)}" height="${fmt(t)}" fill="${wallC}"/>`);
  if(O.lid==='open')o.push(`<rect x="${fmt(t+O.lipW)}" y="${fmt(e+t+O.lipW)}" width="${fmt(L-2*O.lipW)}" height="${fmt(W-2*O.lipW)}" fill="none" stroke="#8c867a" stroke-dasharray="3 2" stroke-width="0.6"/>`);
  if(O.connect==='direct'&&!upright){
    o.push(`<rect x="-${nestW}" y="${fmt(Wt/2-P.portPitch/2-20)}" width="${nestW}" height="${fmt(P.portPitch+40)}" fill="${nestC}" stroke="#8c867a" stroke-width="0.6"/>`);
    o.push(`<text x="-${nestW/2}" y="${fmt(Wt/2)}" font-size="6" text-anchor="middle" fill="#736c60">nest</text>`);
    for(const s of [-1,1])o.push(`<rect x="${fmt(-borderRow(P)-PIN_L/2-4)}" y="${fmt(Wt/2+s*P.portPitch/2-BAR_W/2)}" width="${fmt(borderRow(P)+PIN_L/2+8+t+KEY_SLOT)}" height="${BAR_W}" fill="${clampC}"/>`);
  }
  if(O.connect==='direct'&&upright){
    // an upright nest seen from above is a thin slab standing beside the wall
    o.push(`<rect x="-${nestW}" y="${fmt(Wt/2-stack/2)}" width="${nestW}" height="${fmt(stack)}" fill="${nestC}" stroke="#8c867a" stroke-width="0.6"/>`);
    o.push(`<text x="-${nestW/2}" y="${fmt(Wt/2-stack/2-3)}" font-size="5" text-anchor="middle" fill="#736c60">upright nest</text>`);
    const c=clipPart(stack,O.clipGrip,ow.reach,t,ow.clipH),x0=-ow.reach,y0=Wt/2-stack/2-ARM+O.clipGrip/2;
    o.push(`<path d="M${c.poly.map(([x,y])=>`${fmt(x+x0)} ${fmt(y+y0)}`).join('L')}Z" fill="${clampC}" opacity="0.85"/>`);
  }
  if(O.connect==='tube')for(const [u,,d] of ow.portHoles)o.push(`<rect x="-${nestW}" y="${fmt(u-O.tubeOD/2)}" width="${nestW}" height="${fmt(O.tubeOD)}" fill="#cfe7d6" stroke="#5c9a6c" stroke-width="0.5"/>`);
  o.push(`<text x="${fmt(outL/2)}" y="${fmt(Wt/2+2)}" font-size="7" text-anchor="middle" fill="#55606a">${O.lid==='slide'?'sliding lid comes out this way &#8594;':'outworld'}</text>`);
  // the port wall from the nest side
  const y0=Wt+gap;
  o.push(`<text x="0" y="${fmt(y0-4)}" font-size="5" fill="#55606a">Port wall, from the nest side</text>`);
  const wy=z=>y0+Hw-z,wall=ow.parts.find(p=>p.name==='port wall');
  o.push(`<rect x="0" y="${fmt(y0)}" width="${fmt(Wt)}" height="${fmt(Hw)}" fill="#cbdce8" stroke="${wallC}" stroke-width="0.6"/>`);
  o.push(`<line x1="0" y1="${fmt(wy(ow.floorTop))}" x2="${fmt(Wt)}" y2="${fmt(wy(ow.floorTop))}" stroke="#8c867a" stroke-dasharray="2 2" stroke-width="0.4"/>`);
  // every cut in the wall except the joints with the side walls and floor
  for(const h of wall.holes){
    const X=h.map(p=>p[0]-wall.ox),Y=h.map(p=>p[1]-wall.oy),x=Math.min(...X),w=Math.max(...X)-x,y=Math.min(...Y),hh=Math.max(...Y)-y;
    if(w<t+1&&hh>t+1)continue;
    if(Math.abs(hh-(t+P.slotClear))<1e-6&&Math.abs(w-10-P.slotClear)<1e-6)continue;
    o.push(`<rect x="${fmt(x)}" y="${fmt(y0+y)}" width="${fmt(w)}" height="${fmt(hh)}" fill="#fff" stroke="#333" stroke-width="0.4"/>`);
  }
  for(const [u,z,dd] of ow.portHoles)o.push(`<circle cx="${fmt(u)}" cy="${fmt(wy(z))}" r="${fmt(dd/2)}" fill="#fff" stroke="#333" stroke-width="0.4"/>`);
  if(O.lid==='slide')o.push(`<line x1="0" y1="${fmt(wy(Hl))}" x2="${fmt(Wt)}" y2="${fmt(wy(Hl))}" stroke="#8c867a" stroke-width="0.4"/>`);
  if(dock)o.push(`<text x="${fmt(Wt/2)}" y="${fmt(wy(dock.zc+NH.G.tunnelW/2+ow.clipH+8))}" font-size="4.5" text-anchor="middle" fill="#55606a">${dock.port.id||'port'}</text>`);
  o.push('</svg>');
  return o.join('');
}
