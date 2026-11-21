// Starter nest: a small 3D printed tray with the outworld and the nest side by side, like the
// small bought nests, and a cut acrylic or glass lid over each. It is for moving a young colony
// out of its test tube. A test tube plugs into a socket, a spare port takes any tube, and water
// towers stand in sockets on the nest's end wall, damp through a printed grille instead of a wick.
import {fmt,f1,rectPts} from './util.js';
import {pen,svgDoc} from './export.js';
import {cleanParam,escapeHtml} from './sanitize.js';
import {meshBoxes,mapMesh,partSolid,printFile} from './stl.js';
import {SOCK_LEN,TOWER_WALL,TOWER_CLEAR,NOTCH,tubeSocket,plugPrints,checkPrinter,lidSet} from './startercommon.js';
import {buildRow,rowPreview} from './starterrow.js';

const LID_OPTS=[['acrylic','Cut acrylic'],['glass','Glass or a bought sheet']];
export const STARTER_FIELDS=[
  {k:'layout',l:'Layout',d:'single',opts:[['single','One nest, outworld at one end'],['row','A row of nests, outworlds along the front']],h:'A row is made of nests that slide together on rails, with a pin through each joint at the front and back. Rows stack on printed legs.'},
  {k:'L',l:'Length (mm)',d:100,step:1,range:[60,300],h:'Outside size of the tray, not counting the sockets that stick out.'},
  {k:'cellW',l:'Width of each nest, along the row (mm)',d:64,step:1,range:[45,150],h:'Outside size, not counting the rail. 64 fits a test tube and the spare port side by side on the front.'},
  {k:'Wd',l:'Depth, front to back (mm)',d:100,step:1,range:[50,300],h:'Outside size, not counting the sockets, towers and lugs that stick out.'},
  {k:'owLen',l:'Outworld size, inside (mm)',d:36,step:1,range:[20,200],h:'One nest: along its length. A row: front to back. The rest is the nest.'},
  {k:'owH',l:'Outworld height (mm)',d:30,step:1,range:[10,120],h:'Outside height, lid included.'},
  {k:'chambers',l:'Chambers',d:3,step:1,range:[1,4],h:'They run in a row from the outworld to the damp end by the water towers.'},
  {k:'chH',l:'Chamber height (mm)',d:8,step:0.5,range:[3,30],h:'About twice the height of a worker. 6 to 8 suits most small species, 10 to 12 larger ones like Camponotus.'},
  {k:'tunnelW',l:'Tunnel width (mm)',d:6,step:0.5,range:[2,30],h:'Wider than the queen, legs included.'},
  {k:'tubeOD',g:'Test tube',l:'Test tube outside diameter (mm)',d:16,step:0.5,range:[6,40],h:'Common sizes are 16, 18 and 20. Not sure? Print the tube gauge below.'},
  {k:'tubeID',g:'Test tube',l:'Test tube inside diameter (mm)',d:13.5,step:0.5,range:[4,38]},
  {k:'tubeOn',g:'Test tube',l:'Test tube socket on',d:'outworld',opts:[['outworld','Outworld end'],['nest','Nest front, first chamber']],h:'On the outworld the colony walks out and finds the nest. On the nest it moves straight in.'},
  {k:'portOD',g:'Test tube',l:'Spare port tube outside diameter (mm)',d:12,step:0.5,range:[4,40],h:'For tubing to another outworld or nest. 12 matches the Outworld page.'},
  {k:'portID',g:'Test tube',l:'Spare port tube inside diameter (mm)',d:8,step:0.5,range:[2,38]},
  {k:'spareOn',g:'Test tube',l:'Spare port on',d:'front',opts:[['front','The front, beside the test tube'],['back','The back, into the last chamber']],h:'In a row the test tube is always on the front, into the outworld.'},
  {k:'plugs',g:'Test tube',l:'Print a plug for each socket',d:true,bool:true},
  {k:'towers',g:'Water',l:'Water towers',d:1,step:1,range:[0,2],h:'Each stands in a socket on the nest end wall, beside a chamber.'},
  {k:'towerD',g:'Water',l:'Water tower outside diameter (mm)',d:16,step:0.5,range:[6,40],h:'A test tube or small vial, stood open end down on a piece of sponge.'},
  {k:'towerH',g:'Water',l:'Water tower socket height (mm)',d:30,step:1,range:[10,120]},
  {k:'grille',g:'Water',l:'Grille slit width (mm)',d:0.8,step:0.05,range:[0.3,3],h:'Water reaches the chamber through these slits. Keep them narrower than the head of your smallest worker. A 0.4mm nozzle prints down to about 0.6.'},
  {k:'lidNest',g:'Lids',l:'Nest lid',d:'acrylic',opts:LID_OPTS,h:'The clear sheet that keeps the ants in.'},
  {k:'redSheet',g:'Lids',l:'Red sheet over the nest lid',d:true,bool:true,h:'The nest recess is two sheets deep. Lift the red sheet to look in, and the clear one still keeps the ants in.'},
  {k:'lidOw',g:'Lids',l:'Outworld lid',d:'acrylic',opts:LID_OPTS},
  {k:'lidT',g:'Lids',l:'Lid thickness, measured (mm)',d:3,step:0.1,range:[1,8],h:'Each lid drops into a recess this deep, so it sits flush.'},
  {k:'vents',g:'Lids',l:'Outworld lid vents',d:'slits',opts:[['slits','Slits along the long sides'],['holes','A grid of holes'],['none','None']]},
  {k:'slitW',g:'Lids',l:'Vent slit width (mm)',d:0.8,step:0.05,range:[0.3,3],h:'Three slits along each long side. Narrower than the head of your smallest worker.'},
  {k:'ventD',g:'Lids',l:'Vent hole diameter (mm)',d:1,step:0.1,range:[0.3,4],h:'Smaller than the head of your smallest worker.'},
  {k:'ventPitch',g:'Lids',l:'Vent hole spacing (mm)',d:8,step:1,range:[3,40]},
  {k:'hatch',g:'Lids',l:'Feeding hatch in the outworld lid',d:true,bool:true,h:'A square hole with a printed hatch that drops into it, and a small acrylic window in its top, so you can feed without lifting the lid.'},
  {k:'hatchSize',g:'Lids',l:'Feeding hatch hole (mm)',d:18,step:1,range:[10,60]},
  {k:'countBy',g:'Row',l:'How many nests',d:'count',opts:[['count','A set number'],['space','As many as fit a length']]},
  {k:'count',g:'Row',l:'Nests in a row',d:4,step:1,range:[1,30]},
  {k:'space',g:'Row',l:'Space for the row (mm)',d:400,step:1,range:[60,3000],h:'End caps included.'},
  {k:'rows',g:'Row',l:'Rows stacked',d:1,step:1,range:[1,6],h:'Each row above stands on printed legs. Every second row prints mirrored, so its water towers sit on the other side and a tall tube clears the row above.'},
  {k:'rowGap',g:'Row',l:'Gap between rows (mm)',d:40,step:1,range:[15,150],h:'From the top of the outworld below to the floor of the row above. Room to lift a lid out.'},
  {k:'feet',g:'Row',l:'Feet under the bottom row',d:true,bool:true,h:'Short feet whose pins lock the bottom of each joint.'},
  {k:'wall',g:'Printing',l:'Outer wall (mm)',d:3.2,step:0.1,range:[2,8],h:'Half of it is the ledge each lid rests on.'},
  {k:'inner',g:'Printing',l:'Inner walls (mm)',d:2,step:0.1,range:[1,6]},
  {k:'floor',g:'Printing',l:'Floor (mm)',d:2,step:0.1,range:[1,6]},
  {k:'fit',g:'Printing',l:'Socket clearance (mm)',d:0.4,step:0.05,range:[-1,2],h:'Added to each tube diameter. Tune it with the tube gauge.'},
  {k:'lidClear',g:'Printing',l:'Lid clearance (mm)',d:0.4,step:0.05,range:[0,2],h:'Taken off each lid, so it drops in.'},
];
{
  const acr=S=>S.lidOw==='acrylic';
  const row=S=>S.layout==='row',one=S=>S.layout!=='row';
  const WHEN={L:one,tubeOn:one,cellW:row,spareOn:row,countBy:row,count:S=>row(S)&&S.countBy==='count',space:S=>row(S)&&S.countBy==='space',rows:row,rowGap:S=>row(S)&&S.rows>1,feet:row,
    vents:acr,slitW:S=>acr(S)&&S.vents==='slits',ventD:S=>acr(S)&&S.vents==='holes',ventPitch:S=>acr(S)&&S.vents==='holes',hatch:acr,hatchSize:S=>acr(S)&&S.hatch,towerD:S=>S.towers>0,towerH:S=>S.towers>0,grille:S=>S.towers>0};
  for(const f of STARTER_FIELDS)if(WHEN[f.k])f.when=WHEN[f.k];
}
export const starterDefaults=()=>Object.fromEntries(STARTER_FIELDS.map(f=>[f.k,f.d]));
export const cleanStarter=S=>Object.fromEntries(STARTER_FIELDS.map(f=>[f.k,cleanParam(f,f.k in S?S[f.k]:f.d)]));

export const GAUGE=[13,13.5,14,14.5,15,15.5,16,16.5,17,17.5,18,18.5,19,19.5,20];

// M has the printer size, kerf and colours from the nest page
export function buildStarter(input,M={printW:220,printD:220,printH:250}){
  const S=cleanStarter(input),errors=[],warnings=[],notes=[];
  if(S.layout==='row')return buildRow(S,M,errors,warnings,notes);
  const w=S.wall,F=S.floor,wi=S.inner,ledge=w/2,Lx=S.L,Ly=S.Wd,tW=S.tunnelW,lc=S.lidClear;
  const dx0=w+S.owLen,dx1=dx0+w;                 // outworld inside end, then the divider
  const nestRecess=S.lidT*(S.redSheet?2:1),nestH=F+S.chH+nestRecess,owH=S.owH;
  const cx0=dx1+ledge,cx1=Lx-w,n=S.chambers;
  const bh=(Ly-2*w-(n-1)*wi)/n;
  if(cx1-cx0<20)errors.push(`The nest is only ${f1(cx1-cx0)}mm long inside. Make the tray longer or the outworld shorter.`);
  if(bh<Math.max(10,tW+4))errors.push(`Each chamber is only ${f1(bh)}mm deep. Use fewer chambers or a wider tray.`);
  if(owH<nestH)errors.push(`The outworld must be at least as tall as the nest section, which is ${f1(nestH)}mm.`);
  if(S.tubeID>=S.tubeOD)errors.push('The test tube inside diameter must be less than its outside diameter.');
  if(S.portID>=S.portOD)errors.push('The spare port inside diameter must be less than its outside diameter.');
  if(tW>S.chH*3)warnings.push('Tunnels much wider than the chamber height give the ants little sense of a tunnel.');

  const add=[[0,0,0,dx1,Ly,owH],[dx1,0,0,Lx,Ly,nestH]],sub=[];
  // outworld: open box, with a recess round the top for its lid
  sub.push([w,w,F,dx0,Ly-w,owH+1],[w-ledge,w-ledge,owH-S.lidT,dx0+ledge,Ly-w+ledge,owH+1]);
  // nest: the lid recess, then chambers in bands from the front (next to the outworld door) to the back
  sub.push([dx1,w-ledge,F+S.chH,Lx-w+ledge,Ly-w+ledge,nestH+1]);
  const ch=[];
  for(let j=0;j<n;j++){
    const y1=Ly-w-j*(bh+wi),y0=y1-bh;
    ch.push({x0:cx0,x1:cx1,y0,y1});
    sub.push([cx0,y0,F,cx1,y1,F+S.chH]);
  }
  // doors alternate ends, so the ants walk the length of every chamber. The last door is at the
  // outworld end, so the far end of the last chamber, by the towers, stays quiet and damp.
  const doors=[];
  const door=(x0,y0,x1,y1)=>{doors.push({x0,y0,x1,y1});sub.push([x0,y0,F,x1,y1,F+S.chH]);};
  {
    const yc=(ch[0].y0+ch[0].y1)/2;
    door(dx0,yc-tW/2,cx0,yc+tW/2);
  }
  for(let j=0;j<n-1;j++){
    const left=(n-2-j)%2===0,y1=ch[j].y0,y0=y1-wi;
    if(left)door(cx0+3,y0,cx0+3+tW,y1);else door(cx1-3-tW,y0,cx1-3,y1);
  }
  if(cx1-cx0<tW+6)errors.push('The nest is too short for its tunnels.');
  // finger notches in the back wall, to lift each lid
  const notches=[];
  for(const [xa,xb,top,deep] of [[w,dx0,owH,S.lidT],[cx0,cx1,nestH,nestRecess]]){
    const xc=(xa+xb)/2;
    notches.push({x0:xc-NOTCH/2,x1:xc+NOTCH/2});
    sub.push([xc-NOTCH/2,-1,top-deep,xc+NOTCH/2,w-ledge,top+1]);
  }

  // water towers: a socket on the end wall, damp through a grille of slits into the chamber
  const towers=[],ts=S.towerD+TOWER_CLEAR+2*TOWER_WALL;
  if(S.towers>n)errors.push(`${S.towers} water towers need at least ${S.towers} chambers.`);
  for(let i=0;i<Math.min(S.towers,n);i++){
    const c=ch[n-1-i];
    let yc=(c.y0+c.y1)/2;
    yc=Math.min(Math.max(yc,ts/2),Ly-ts/2);
    const t={x0:Lx,x1:Lx+ts,y0:yc-ts/2,y1:yc+ts/2,slits:[]};
    if(towers.some(o=>o.y0<t.y1&&t.y0<o.y1))errors.push('The water tower sockets overlap. Make the chambers deeper or use one tower.');
    add.push([t.x0,t.y0,0,t.x1,t.y1,S.towerH]);
    sub.push([t.x0,t.y0+TOWER_WALL,F,t.x1-TOWER_WALL,t.y1-TOWER_WALL,S.towerH+1]);
    // slits only where the well and the chamber face each other
    const ya=Math.max(t.y0+TOWER_WALL,c.y0)+0.5,yb=Math.min(t.y1-TOWER_WALL,c.y1)-0.5,g=S.grille,pitch=g+Math.max(1,g);
    const gh=Math.max(1.5,S.chH-1.5);
    for(let y=ya;y+g<=yb+1e-9;y+=pitch){t.slits.push(y);sub.push([Lx-w,y,F,Lx,y+g,F+gh]);}
    if(t.slits.length<3)errors.push('A water tower lines up with too little of its chamber for a grille.');
    towers.push(t);
  }
  if(S.towers&&S.towerH<nestH)warnings.push('The water tower sockets are lower than the nest, so a tower may tip over.');

  // tube sockets: a printed block with a round bore, and a doorway through the wall the size of the tube's inside
  const sockets=[];
  function socket(name,od,id,wall,uc){
    const span=wall==='nest'?[cx0,cx1]:wall==='end'?[w,Ly-w]:[w,dx0];
    const face=wall==='end'?{face:'x-',pos:0}:{face:'y+',pos:Ly};
    const s=tubeSocket(S,{name,od,id,...face,t:w,uc,ceil:wall==='nest'?F+S.chH:owH-S.lidT,lo:span[0]-w,hi:span[1]+w,nest:wall==='nest',wall},errors,warnings);
    sub.push(...s.cuts);
    sockets.push(s);
  }
  if(S.tubeOn==='nest'){
    socket('test tube',S.tubeOD,S.tubeID,'nest',(cx0+cx1)/2);
    socket('spare port',S.portOD,S.portID,'end',Ly/2);
  }else{
    socket('test tube',S.tubeOD,S.tubeID,'end',Ly/2);
    socket('spare port',S.portOD,S.portID,'owfront',(w+dx0)/2);
  }

  // the tray, turned so it matches the preview when seen from above
  const body=mapMesh([...meshBoxes(add,sub),...sockets.flatMap(s=>s.mesh)],([x,y,z])=>[x,-y,z]);
  const prints=[{name:'starter nest tray',qty:1,tris:body}];
  if(S.plugs)prints.push(...plugPrints(sockets));

  // lids drop into the recesses, so each is the recess less the clearance
  const Ls=lidSet(S,{w:dx0-w+2*ledge-lc,h:Ly-2*w+2*ledge-lc},{w:Lx-w+ledge-dx1-lc,h:Ly-2*w+2*ledge-lc},1,errors,warnings,notes);
  const lids=Ls.lids,hatch=Ls.hatch;
  prints.push(...Ls.prints);
  checkPrinter(prints,M,errors);

  if(S.towers)notes.push('Put a small piece of sponge in the bottom of each water tower socket. Fill a tube with water, plug it with cotton, and stand it open end down on the sponge. The grille keeps the chamber behind it damp.');
  notes.push('Coat the top 10mm of the outworld walls with a barrier such as Fluon, so ants stay in when the lid is off.');
  notes.push('Prints upright with no supports. PETG copes with damp better than PLA.');
  if(S.grille>=1)warnings.push(`The grille slits are ${fmt(S.grille)}mm wide. Small workers may get through. Check against your smallest worker.`);

  // footprint with everything that sticks out
  const outW=Lx+(sockets.some(s=>s.wall==='end')?SOCK_LEN:0)+(towers.length?ts:0),outD=Ly+(sockets.some(s=>s.wall!=='end')?SOCK_LEN:0);
  return {S,errors,warnings,notes,prints,lids,ch,doors,towers,sockets,notches,
    Lx,Ly,w,F,dx0,dx1,ledge,nestH,owH,bh,cx0,cx1,outW,outD,hatch,nestRecess};
}

export function starterFiles(st,P={kerf:0.15,cutColor:'#ff0000',engraveColor:'#000000'}){
  const files=[],d=pen({kerf:P.kerf,cutColor:P.cutColor,engraveColor:P.engraveColor});
  for(const l of st.lids.filter(l=>l.kind==='acrylic')){
    const b=[d.outline(l.poly)];
    for(const h of l.holes)b.push(d.cutout(h));
    for(const [x,y,dia] of l.circles)b.push(d.hole(x,y,dia));
    files.push({name:`starter-${l.name.replace(/ /g,'-')}${l.qty>1?'-x'+l.qty:''}.svg`,data:svgDoc(l.w,l.h,b.join('\n'),`Starter nest ${l.name}`)});
  }
  for(const it of st.prints)files.push(printFile(it));
  return files;
}
// a printed plate of holes from 13 to 20mm, to find a test tube's size. The cut corner marks the smallest.
export function tubeGauge(){
  const pitch=25,cols=5,rows=Math.ceil(GAUGE.length/cols),W=cols*pitch+5,H=rows*pitch+5;
  const poly=[[6,0],[W,0],[W,H],[0,H],[0,6]];
  const solid=partSolid({poly,circles:GAUGE.map((dia,i)=>[5+pitch/2+(i%cols)*pitch-2.5,5+pitch/2+Math.floor(i/cols)*pitch-2.5,dia])},0,3);
  return printFile({name:'tube gauge',qty:1,solids:[solid]});
}

// a plain top-down picture of the tray
export function starterPreview(st){
  if(st.row)return rowPreview(st);
  const {S,Lx,Ly,w,dx0,dx1,ch,doors,towers,sockets,notches}=st;
  const padL=sockets.some(s=>s.wall==='end')?SOCK_LEN+4:4,padR=(towers.length?S.towerD+TOWER_CLEAR+2*TOWER_WALL:0)+4,padB=sockets.some(s=>s.wall!=='end')?SOCK_LEN+4:4;
  const o=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(-padL)} -6 ${fmt(Lx+padL+padR)} ${fmt(Ly+6+padB)}" font-family="system-ui,Arial,sans-serif">`];
  const rect=(x0,y0,x1,y1,fill,extra='')=>o.push(`<rect x="${fmt(x0)}" y="${fmt(y0)}" width="${fmt(x1-x0)}" height="${fmt(y1-y0)}" fill="${fill}"${extra}/>`);
  const text=(x,y,s,size=4)=>o.push(`<text x="${fmt(x)}" y="${fmt(y)}" font-size="${size}" text-anchor="middle" dominant-baseline="middle" fill="#5a5247">${escapeHtml(s)}</text>`);
  rect(0,0,Lx,Ly,'#d9d4ca',' rx="1.5"');
  for(const s of sockets){
    if(s.wall==='end')rect(-SOCK_LEN,s.uc-s.half,0,s.uc+s.half,'#d9d4ca');
    else rect(s.uc-s.half,Ly,s.uc+s.half,Ly+SOCK_LEN,'#d9d4ca');
  }
  for(const t of towers){rect(t.x0,t.y0,t.x1,t.y1,'#d9d4ca');o.push(`<circle cx="${fmt((t.x0+t.x1-TOWER_WALL)/2)}" cy="${fmt((t.y0+t.y1)/2)}" r="${fmt(S.towerD/2)}" fill="#bcd8f3" stroke="#4a90d9" stroke-width="0.6"/>`);}
  rect(w,w,dx0,Ly-w,'#f3e3bd');
  for(const c of ch)rect(c.x0,c.y0,c.x1,c.y1,'#e9d5a6');
  for(const d of doors)rect(d.x0,d.y0,d.x1,d.y1,'#2fb37a');
  for(const t of towers)for(const y of t.slits)rect(Lx-w,y,Lx,y+S.grille,'#4a90d9');
  for(const s of sockets){
    const bore=s.wall==='end'?[-SOCK_LEN,s.uc-s.D/2,0,s.uc+s.D/2]:[s.uc-s.D/2,Ly,s.uc+s.D/2,Ly+SOCK_LEN];
    rect(...bore,s.name==='test tube'?'#1b6fd0':'#2fb37a');
  }
  for(const nn of notches)rect(nn.x0,0,nn.x1,w/2,'#a8a093');
  if(st.hatch){
    const c=[(w+dx0)/2,Ly/2],f=st.hatch.flange/2,v=st.hatch.view/2;
    rect(c[0]-f,c[1]-f,c[0]+f,c[1]+f,'#d9d4ca',' rx="1"');rect(c[0]-v,c[1]-v,c[0]+v,c[1]+v,'#cfe3f5');
    text(c[0],c[1]+f+4,'Hatch',3.2);
  }
  text((w+dx0)/2,st.hatch?Ly/2-st.hatch.flange/2-6:Ly/2-6,'Outworld',4.5);
  ch.forEach((c,i)=>text((c.x0+c.x1)/2,(c.y0+c.y1)/2,i===ch.length-1&&towers.length?`${i+1} (damp)`:String(i+1),4.5));
  for(const s of sockets){
    const [x,y]=s.wall==='end'?[-SOCK_LEN/2,s.uc+s.half+3]:[s.uc,Ly+SOCK_LEN+2.5];
    text(x,y,s.name==='test tube'?'Test tube':'Spare port',3.2);
  }
  if(towers.length)text((towers[0].x0+towers[0].x1)/2,towers[0].y0-3,'Water',3.2);
  o.push('</svg>');
  return o.join('');
}
