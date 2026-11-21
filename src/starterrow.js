// A row of starter nests. Each nest is its own print, a narrow tray with the outworld across the
// front and the chambers behind it, so the test tube and spare port go in the front and the water
// tower stands on the back wall. Nests slide down onto each other's T rails, and a square pin
// through a lug shared by each pair locks every joint, front and back. End caps finish the row.
// Rows stack on printed legs whose pins go into the same joint holes, and every second row
// prints mirrored, so its water tower sits on the other side and a tall tube clears it.
import {fmt,f1} from './util.js';
import {escapeHtml} from './sanitize.js';
import {meshBoxes,mapMesh} from './stl.js';
import {SOCK_LEN,SOCK_WALL,TOWER_WALL,TOWER_CLEAR,NOTCH,tubeSocket,plugPrints,checkPrinter,lidSet} from './startercommon.js';

// first guesses until a test print. The rail: a stem a wide and s deep, then a head b wide and h
// deep, with c clearance all round in the slot.
export const RAIL={a:3.5,s:1.6,b:7,h:1.4,c:0.25};
const RAIL_DEPTH=RAIL.s+RAIL.h+RAIL.c;
// a lug sticks out d from the wall, w along the row, half on each nest. Its square hole is off
// from the wall and takes a pin, with fit clearance.
export const LUG={w:16,d:12,off:2,pin:6,fit:0.4};
export const LEG_W=14,LEG_D=9,FOOT=3,CAP_W=LUG.w/2;
const HOLE=LUG.pin+LUG.fit;

const rail=(X,yc,zt)=>{const {a,s,b,h}=RAIL;return [[X,yc-a/2,0,X+s,yc+a/2,zt],[X+s,yc-b/2,0,X+s+h,yc+b/2,zt]];};
const slot=(X,yc,zt)=>{const {a,s,b,h,c}=RAIL;return [[X-1,yc-a/2-c,-1,X+s,yc+a/2+c,zt+c],[X+s-c,yc-b/2-c,-1,X+s+h+c,yc+b/2+c,zt+c]];};

export function buildRow(S,M,errors,warnings,notes){
  const w=S.wall,F=S.floor,wi=S.inner,ledge=w/2,Cw=S.cellW,Ly=S.Wd,tW=S.tunnelW,lc=S.lidClear;
  const sw=Math.max(w,RAIL_DEPTH+1.6);                // side walls are thick enough for the rail slot
  const nestRecess=S.lidT*(S.redSheet?2:1),nestH=F+S.chH+nestRecess,owH=S.owH,lugH=nestH;
  const dy1=Ly-w-S.owLen,dy0=dy1-w;                    // the divider: the nest behind it, the outworld in front
  const cx0=sw,cx1=Cw-sw,cy0=w,cy1=dy0-ledge,n=S.chambers;
  const bh=(cy1-cy0-(n-1)*wi)/n,edge=LUG.w/2+1;
  const N=S.countBy==='space'?Math.floor((S.space-2*CAP_W)/Cw):S.count,R=S.rows,nn=Math.max(1,N);
  if(N<1)errors.push(`A ${fmt(S.space)}mm space has no room for one ${fmt(Cw)}mm nest and its end caps.`);
  if(cy1-cy0<20)errors.push(`The nest is only ${f1(cy1-cy0)}mm deep inside. Make the nests deeper or the outworld shallower.`);
  else if(bh<Math.max(10,tW+4))errors.push(`Each chamber is only ${f1(bh)}mm deep. Use fewer chambers or deeper nests.`);
  if(cx1-cx0<tW+12)errors.push('The nests are too narrow for their tunnels. Make them wider.');
  if(owH<nestH)errors.push(`The outworld must be at least as tall as the nest section, which is ${f1(nestH)}mm.`);
  if(S.tubeID>=S.tubeOD)errors.push('The test tube inside diameter must be less than its outside diameter.');
  if(S.portID>=S.portOD)errors.push('The spare port inside diameter must be less than its outside diameter.');
  if(tW>S.chH*3)warnings.push('Tunnels much wider than the chamber height give the ants little sense of a tunnel.');
  if(S.towers>1)errors.push('A nest in a row has room for one water tower, on its back wall.');

  const add=[[0,dy0,0,Cw,Ly,owH],[0,0,0,Cw,dy0,nestH]],sub=[];
  // outworld: open box, with a recess round the top for its lid
  sub.push([sw,dy1,F,Cw-sw,Ly-w,owH+1],[sw-ledge,dy1-ledge,owH-S.lidT,Cw-sw+ledge,Ly-w+ledge,owH+1]);
  // nest: the lid recess, then chambers in bands from the divider to the back wall
  sub.push([sw-ledge,w-ledge,F+S.chH,Cw-sw+ledge,dy0,nestH+1]);
  const ch=[];
  for(let j=0;j<n;j++){
    const y1=cy1-j*(bh+wi),y0=y1-bh;
    ch.push({x0:cx0,x1:cx1,y0,y1});
    sub.push([cx0,y0,F,cx1,y1,F+S.chH]);
  }
  // doors alternate ends. The water tower is at the left of the back wall, so the last door is at
  // the right and the left end of the back chamber stays quiet and damp.
  const doors=[];
  const door=(right,y0,y1)=>{
    const [x0,x1]=right?[cx1-3-tW,cx1-3]:[cx0+3,cx0+3+tW];
    doors.push({x0,y0,x1,y1});sub.push([x0,y0,F,x1,y1,F+S.chH]);
  };
  door(n%2===1,ch[0].y1,dy1);
  for(let k=0;k<n-1;k++)door((n-2-k)%2===0,ch[k].y0-wi,ch[k].y0);

  // water tower: a socket on the back wall, damp through a grille of slits into the back chamber
  const towers=[],ts=S.towerD+TOWER_CLEAR+2*TOWER_WALL;
  if(S.towers>=1){
    const c=ch[n-1],t={x0:edge,x1:edge+ts,y0:-ts,y1:0,slits:[]};
    if(t.x1>Cw-edge)errors.push('The water tower socket is too wide for the back wall. Make the nests wider.');
    add.push([t.x0,t.y0,0,t.x1,0,S.towerH]);
    sub.push([t.x0+TOWER_WALL,t.y0+TOWER_WALL,F,t.x1-TOWER_WALL,0,S.towerH+1]);
    const xa=Math.max(t.x0+TOWER_WALL,c.x0)+0.5,xb=Math.min(t.x1-TOWER_WALL,c.x1)-0.5,g=S.grille,pitch=g+Math.max(1,g);
    const gh=Math.max(1.5,S.chH-1.5);
    for(let x=xa;x+g<=xb+1e-9;x+=pitch){t.slits.push(x);sub.push([x,0,F,x+g,w,F+gh]);}
    if(t.slits.length<3)errors.push('The water tower lines up with too little of the back chamber for a grille.');
    towers.push(t);
    if(S.towerH<nestH)warnings.push('The water tower sockets are lower than the nest, so a tower may tip over.');
  }

  // the test tube goes in the front, into the outworld. The spare port goes beside it, or on the back.
  const half=od=>(od+S.fit)/2+SOCK_WALL,ht=half(S.tubeOD),hs=half(S.portOD),sockets=[];
  const front=(name,od,id,uc)=>tubeSocket(S,{name,od,id,face:'y+',pos:Ly,t:w,uc,ceil:owH-S.lidT,lo:-1e9,hi:1e9,wall:'front'},errors,warnings);
  if(S.spareOn==='front'){
    const g=(Cw-2*edge-2*ht-2*hs)/3;
    if(g<0.5)errors.push(`The test tube and spare port do not fit side by side on the front. Make the nests at least ${Math.ceil(2*edge+2*ht+2*hs+1.5)}mm wide, or put the spare port on the back.`);
    const gg=Math.max(g,0.5);
    sockets.push(front('test tube',S.tubeOD,S.tubeID,edge+gg+ht),front('spare port',S.portOD,S.portID,Cw-edge-gg-hs));
  }else{
    sockets.push(front('test tube',S.tubeOD,S.tubeID,Cw/2));
    const lo=towers.length?towers[0].x1+1:edge,hi=Cw-edge;
    sockets.push(tubeSocket(S,{name:'spare port',od:S.portOD,id:S.portID,face:'y-',pos:0,t:w,uc:(lo+hi)/2,ceil:F+S.chH,lo,hi,nest:true,wall:'back'},errors,warnings));
  }
  for(const s of sockets)sub.push(...s.cuts);

  // finger notches: the outworld's in the front wall, the nest's in the back wall where it is free
  const notches=[{x0:Cw/2-NOTCH/2,x1:Cw/2+NOTCH/2,wall:'front'}];
  sub.push([Cw/2-NOTCH/2,Ly-w+ledge,owH-S.lidT,Cw/2+NOTCH/2,Ly+1,owH+1]);
  {
    const blocked=[[-1e9,LUG.w/2+1],[Cw-LUG.w/2-1,1e9],...towers.map(t=>[t.x0-1,t.x1+1]),
      ...sockets.filter(s=>s.wall==='back').map(s=>[s.uc-s.half-1,s.uc+s.half+1])].sort((p,q)=>p[0]-q[0]);
    let x=cx0,best=null;
    for(const [p,q] of blocked){
      const seg=[x,Math.min(p,cx1)];
      if(seg[1]-seg[0]>(best?best[1]-best[0]:0))best=seg;
      x=Math.max(x,q);
    }
    if(best&&best[1]-best[0]>=NOTCH){
      const xc=(best[0]+best[1])/2;
      notches.push({x0:xc-NOTCH/2,x1:xc+NOTCH/2,wall:'back'});
      sub.push([xc-NOTCH/2,-1,nestH-nestRecess,xc+NOTCH/2,w-ledge,nestH+1]);
    }else notes.push('There is no room on the back wall for a finger notch. Lift the nest lid with a tab of tape.');
  }

  // rails on the right side wall, slots in the left one: one at the outworld, one at the nest
  const rails=[[(dy1+Ly-w)/2,owH-S.lidT-1.5],[(cy0+cy1)/2,F+S.chH-1.5]];
  for(const [yc,zt] of rails){add.push(...rail(Cw,yc,zt));sub.push(...slot(0,yc,zt));}
  // a half lug at each corner, front and back, with half the joint's pin hole
  const lugs=(X0,X1)=>[[X0,Ly,0,X1,Ly+LUG.d,lugH],[X0,-LUG.d,0,X1,0,lugH]];
  const holes=(X0,X1)=>[[X0,Ly+LUG.off,-1,X1,Ly+LUG.off+HOLE,lugH+1],[X0,-LUG.off-HOLE,-1,X1,-LUG.off,lugH+1]];
  add.push(...lugs(0,LUG.w/2),...lugs(Cw-LUG.w/2,Cw));
  sub.push(...holes(-1,HOLE/2),...holes(Cw-HOLE/2,Cw+1));

  // end caps: the left one has rails for the first nest's slots, the right one slots for the last nest's rails
  const capH=Math.max(...rails.map(r=>r[1]))+RAIL.c+1.6;
  const capRail=meshBoxes([[-CAP_W,0,0,0,Ly,capH],...lugs(-CAP_W,0),...rails.flatMap(([yc,zt])=>rail(0,yc,zt))],holes(-HOLE/2,1));
  const capSlot=meshBoxes([[0,0,0,CAP_W,Ly,capH],...lugs(0,CAP_W)],[...rails.flatMap(([yc,zt])=>slot(0,yc,zt)),...holes(-1,HOLE/2)]);

  // legs: a body between two square pins, printed lying on the side the pins sit flush with,
  // which faces the nests. Feet: a short body with one pin, for the bottom row.
  const pitch=owH+S.rowGap,legL=pitch-lugH,pinL=lugH/2-0.5,P0=LUG.pin,py0=(LEG_W-P0)/2;
  const leg=meshBoxes([[0,py0,0,pinL,py0+P0,P0],[pinL,0,0,pinL+legL,LEG_W,LEG_D],[pinL+legL,py0,0,2*pinL+legL,py0+P0,P0]],[]);
  const foot=meshBoxes([[-LEG_W/2,0,0,LEG_W/2,LEG_D,FOOT],[-P0/2,0,FOOT,P0/2,P0,FOOT+pinL]],[]);

  const tray=[...meshBoxes(add,sub),...sockets.flatMap(s=>s.mesh)];
  // seen from above as in the preview; the mirrored prints are flipped left to right
  const view=([x,y,z])=>[x,-y,z],mirror=([x,y,z])=>[-x,-y,z];
  const Rn=Math.ceil(R/2),Rm=Math.floor(R/2),joints=2*(nn+1);
  const prints=[{name:'starter row nest',qty:nn*Rn,tris:mapMesh(tray,view)}];
  if(Rm)prints.push({name:'starter row nest mirrored',qty:nn*Rm,tris:mapMesh(tray,mirror)});
  prints.push({name:'starter row end with rails',qty:Rn,tris:mapMesh(capRail,view)},{name:'starter row end with slots',qty:Rn,tris:mapMesh(capSlot,view)});
  if(Rm)prints.push({name:'starter row end with rails mirrored',qty:Rm,tris:mapMesh(capRail,mirror)},{name:'starter row end with slots mirrored',qty:Rm,tris:mapMesh(capSlot,mirror)});
  if(S.feet)prints.push({name:'starter row foot',qty:joints,tris:foot});
  if(R>1)prints.push({name:'starter row leg',qty:joints*(R-1),tris:leg});
  if(S.plugs)prints.push(...plugPrints(sockets,nn*R));

  const Ls=lidSet(S,{w:Cw-2*sw+2*ledge-lc,h:S.owLen+2*ledge-lc},{w:Cw-2*sw+2*ledge-lc,h:dy0-w+ledge-lc},nn*R,errors,warnings,notes);
  prints.push(...Ls.prints);
  checkPrinter(prints,M,errors);

  // stacking: room to lift a lid out, and how tall a water tower can be under the row above
  let tubeMax=Infinity;
  if(R>1){
    const need=(Ls.hatch?Ls.hatch.top:0)+15;
    if(S.rowGap<need)errors.push(`A ${fmt(S.rowGap)}mm gap between rows leaves no room to lift the outworld lid out. Use at least ${fmt(Math.ceil(need))}mm.`);
    else if(S.rowGap<30)warnings.push('A gap under 30mm between rows makes the nests hard to feed and the lids hard to lift out.');
    if(towers.length){
      // the row above is mirrored: anything of its back wall over this tower stops a tall tube
      const t=towers[0],over=[[Cw-t.x1,Cw-t.x0],...sockets.filter(s=>s.wall==='back').map(s=>[Cw-s.uc-s.half,Cw-s.uc+s.half])];
      if(over.some(([p,q])=>p<t.x1&&t.x0<q))tubeMax=pitch-F;
      else if(R>2)tubeMax=2*pitch-F;
      if(tubeMax<S.towerH)errors.push('The water tower socket is taller than the room under the row above. Lower it or widen the gap.');
      else if(tubeMax<2*pitch-F)warnings.push(`Something on the row above sits over each water tower, so a tower tube can be at most ${f1(tubeMax)}mm tall. Put the spare port on the front to clear it.`);
    }
  }

  if(S.towers)notes.push('Put a small piece of sponge in the bottom of each water tower socket. Fill a tube with water, plug it with cotton, and stand it open end down on the sponge. The grille keeps the back chamber damp.');
  if(Number.isFinite(tubeMax))notes.push(`Water tower tubes can stand up to ${f1(tubeMax)}mm tall before they meet the row ${tubeMax<2*pitch-F?'above':'two above'}.`);
  notes.push(`To build a row: start at the left with the end that has rails. Lower each nest onto the rails of the one before it, then fit the end with slots.${S.feet?' Push a foot up into each joint hole from underneath, front and back.':''}`);
  if(R>1)notes.push(`Stand each row above on legs, one in every joint hole front and back. The flat side of each leg, where the pins sit flush, faces the nests. ${Rm>1?'Rows':'Row'} ${Array.from({length:Rm},(_,i)=>2*i+2).join(', ')} ${Rm>1?'use':'uses'} the mirrored nests and ends.`);
  notes.push('Lift a row from underneath. The rails and pins hold the nests together side to side, but a nest can still slide up and out, which is how you take one out to clean it.');
  notes.push('Coat the top 10mm of the outworld walls with a barrier such as Fluon, so ants stay in when the lid is off.');
  notes.push('Prints upright with no supports. PETG copes with damp better than PLA.');
  if(S.grille>=1)warnings.push(`The grille slits are ${fmt(S.grille)}mm wide. Small workers may get through. Check against your smallest worker.`);

  const len=nn*Cw+2*CAP_W;
  const backOut=Math.max(LUG.d,towers.length?ts:0,sockets.some(s=>s.wall==='back')?SOCK_LEN:0);
  const outD=Ly+Math.max(LUG.d,SOCK_LEN)+backOut;
  const height=(S.feet?FOOT:0)+(R-1)*pitch+Math.max(owH,towers.length?S.towerH:0);
  return {S,errors,warnings,notes,prints,lids:Ls.lids,ch,doors,towers,sockets,notches,hatch:Ls.hatch,
    row:{n:nn,R,pitch,len,lugH,legL,pinL,tubeMax,height,sw,capH,rails,backOut},
    Lx:Cw,Ly,w,F,ledge,nestH,owH,bh,cx0,cx1,cy0,cy1,dy0,dy1,outW:len,outD,nestRecess};
}

// the row from above, front at the bottom, and from the front when rows stack
export function rowPreview(st){
  const {S,Lx:Cw,Ly,w,ch,doors,towers,sockets,notches,row,hatch,dy1}=st,sw=row.sw;
  const show=Math.min(row.n,4),W=show*Cw,back=row.backOut+5,frontPad=Math.max(LUG.d,SOCK_LEN)+10;
  const elev=row.R>1?row.height+14:0,top=Ly+frontPad;
  const o=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(-CAP_W-6)} ${fmt(-back)} ${fmt(W+2*CAP_W+12)} ${fmt(back+top+elev)}" font-family="system-ui,Arial,sans-serif">`];
  const rect=(x0,y0,x1,y1,fill,extra='')=>o.push(`<rect x="${fmt(x0)}" y="${fmt(y0)}" width="${fmt(x1-x0)}" height="${fmt(y1-y0)}" fill="${fill}"${extra}/>`);
  const text=(x,y,s,size=4)=>o.push(`<text x="${fmt(x)}" y="${fmt(y)}" font-size="${size}" text-anchor="middle" dominant-baseline="middle" fill="#5a5247">${escapeHtml(s)}</text>`);
  // end caps and lugs
  for(const [a,b] of [[-CAP_W,0],[W,W+CAP_W]])rect(a,-LUG.d,b,Ly+LUG.d,'#c9c2b5',' rx="1"');
  for(let i=0;i<show;i++){
    const X=i*Cw,x=v=>X+v;
    for(const [a,b] of [[0,LUG.w/2],[Cw-LUG.w/2,Cw]]){rect(x(a),-LUG.d,x(b),0,'#d9d4ca');rect(x(a),Ly,x(b),Ly+LUG.d,'#d9d4ca');}
    rect(X,0,X+Cw,Ly,'#d9d4ca',' rx="1"');
    for(const s of sockets){
      const y=s.wall==='front'?[Ly,Ly+SOCK_LEN]:[-SOCK_LEN,0];
      rect(x(s.uc-s.half),y[0],x(s.uc+s.half),y[1],'#d9d4ca');
      rect(x(s.uc-s.D/2),y[0],x(s.uc+s.D/2),y[1],s.name==='test tube'?'#1b6fd0':'#2fb37a');
    }
    for(const t of towers){rect(x(t.x0),t.y0,x(t.x1),t.y1,'#d9d4ca');o.push(`<circle cx="${fmt(x((t.x0+t.x1)/2))}" cy="${fmt((t.y0+t.y1+TOWER_WALL)/2)}" r="${fmt(S.towerD/2)}" fill="#bcd8f3" stroke="#4a90d9" stroke-width="0.6"/>`);}
    rect(x(sw),dy1,x(Cw-sw),Ly-w,'#f3e3bd');
    for(const c of ch)rect(x(c.x0),c.y0,x(c.x1),c.y1,'#e9d5a6');
    for(const d of doors)rect(x(d.x0),d.y0,x(d.x1),d.y1,'#2fb37a');
    for(const t of towers)for(const sx of t.slits)rect(x(sx),0,x(sx+S.grille),w,'#4a90d9');
    for(const nn of notches)nn.wall==='front'?rect(x(nn.x0),Ly-w/2,x(nn.x1),Ly,'#a8a093'):rect(x(nn.x0),0,x(nn.x1),w/2,'#a8a093');
    if(hatch){
      const c=[x(Cw/2),(dy1+Ly-w)/2],f=hatch.flange/2,v=hatch.view/2;
      rect(c[0]-f,c[1]-f,c[0]+f,c[1]+f,'#d9d4ca',' rx="1"');rect(c[0]-v,c[1]-v,c[0]+v,c[1]+v,'#cfe3f5');
    }
  }
  // joint pin holes, and the rails where each pair meets
  for(let j=0;j<=show;j++){
    const X=j*Cw;
    rect(X-HOLE/2,Ly+LUG.off,X+HOLE/2,Ly+LUG.off+HOLE,'#5a5247');rect(X-HOLE/2,-LUG.off-HOLE,X+HOLE/2,-LUG.off,'#5a5247');
    for(const [yc] of row.rails)rect(X,yc-RAIL.b/2,X+RAIL.s+RAIL.h,yc+RAIL.b/2,'#8c8478');
  }
  if(!hatch)text(Cw/2,(dy1+Ly-w)/2,'Outworld',4);
  ch.forEach((c,i)=>text((c.x0+c.x1)/2,(c.y0+c.y1)/2,i===ch.length-1&&towers.length?`${i+1} (damp)`:String(i+1),4));
  for(const s of sockets)text(s.uc,s.wall==='front'?Ly+SOCK_LEN+3:-SOCK_LEN-3,s.name==='test tube'?'Test tube':'Spare',3);
  if(towers.length&&!sockets.some(s=>s.wall==='back'))text((towers[0].x0+towers[0].x1)/2,towers[0].y0-3,'Water',3);
  if(row.n>show)text(W/2,Ly+SOCK_LEN+8,`Showing ${show} of ${row.n} nests`,4);

  // from the front: each row on its legs, the bottom row on feet
  if(row.R>1){
    const base=top+row.height+8,zy=z=>base-z,foot=S.feet?FOOT:0;
    for(let r=0;r<row.R;r++){
      const z0=foot+r*row.pitch,mir=r%2===1;
      for(let i=0;i<show;i++){
        for(const t of towers){
          const [a,b]=mir?[Cw-t.x1,Cw-t.x0]:[t.x0,t.x1];
          rect(i*Cw+a,zy(z0+S.towerH),i*Cw+b,zy(z0),'#e8e4dc');
        }
      }
      rect(-CAP_W,zy(z0+row.capH),0,zy(z0),'#c9c2b5');rect(W,zy(z0+row.capH),W+CAP_W,zy(z0),'#c9c2b5');
      rect(0,zy(z0+st.owH),W,zy(z0),'#f3e3bd',' stroke="#a8a093" stroke-width="0.4"');
      for(let i=1;i<show;i++)rect(i*Cw-0.3,zy(z0+st.owH),i*Cw+0.3,zy(z0),'#a8a093');
      for(let j=0;j<=show;j++){
        rect(j*Cw-LUG.w/2,zy(z0+row.lugH),j*Cw+LUG.w/2,zy(z0),'#d9d4ca',' stroke="#a8a093" stroke-width="0.3"');
        if(r<row.R-1)rect(j*Cw-LEG_W/2,zy(z0+row.pitch),j*Cw+LEG_W/2,zy(z0+row.lugH),'#8c8478');
        if(r===0&&S.feet)rect(j*Cw-LEG_W/2,zy(FOOT),j*Cw+LEG_W/2,zy(0),'#8c8478');
      }
      text(Cw/2,zy(z0+st.owH/2),`Row ${r+1}${mir?', mirrored':''}`,4);
    }
    o.push(`<line x1="${fmt(-CAP_W-4)}" y1="${fmt(base)}" x2="${fmt(W+CAP_W+4)}" y2="${fmt(base)}" stroke="#5a5247" stroke-width="0.4"/>`);
  }
  o.push('</svg>');
  return o.join('');
}
