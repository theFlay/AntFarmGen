import {f1,rectPts} from './util.js';
import {stH,stV,chambers,chamberCenter,interiorEdges,getEdge} from './layout.js';
import {doorType} from './doors.js';
import {spongeLength} from './generate.js';
/* ---------------- geometry ---------------- */
// Tabs go in the solid runs either side of each tunnel notch, leaving room for a door slot.
export function tabPositions(len,notches,G,P){
  const m=G.t+1,tl=P.tabL,clear=G.tunnelW/2+3;
  const ivs=[];let a=m;
  for(const n of notches.slice().sort((x,y)=>x-y)){ivs.push([a,n-clear]);a=n+clear;}
  ivs.push([a,len-m]);
  const out=[];
  ivs.forEach(([a,b],i)=>{
    const span=b-a;if(span<tl-1e-9)return;
    const n=Math.max(1,Math.min(Math.round(span/Math.max(10,P.tabPitch)),Math.floor(span/(tl+4))));
    if(n>1){for(let q=0;q<n;q++)out.push(a+tl/2+(span-tl)*q/(n-1));return;}
    const first=i===0,last=i===ivs.length-1;
    out.push(first&&!last?a+tl/2:last&&!first?b-tl/2:(a+b)/2);
  });
  return out;
}

export function buildGeometry(G,L,P){
  const {t,depth,xs,ys,cols,rows,cellW,cellH,tunnelW,tunnelH}=G;
  const B=P.B,W=P.W,H=P.H,D=P.spongeD;
  const errors=[],warnings=[];
  const pieces=[],sponges=[],fills=[];
  const present=s=>s!=='none';
  const hS=(j,k)=>stH(L,j,k), vS=(r,i)=>stV(L,r,i);
  const lineCount={};
  function push(orient,line,c,s,e,notches,kind,extra){
    if(e-s<0.5){warnings.push(`Tiny wall piece dropped on ${orient}${line}.`);return null;}
    const key=orient+line;lineCount[key]=(lineCount[key]||0)+1;
    const pc=Object.assign({id:kind==='wall'?`${orient}${line}-${lineCount[key]}`:'',orient,c,s,e,notches:notches.slice(),kind,windows:[]},extra||{});
    pieces.push(pc);return pc;
  }
  function addSponge(orient,c,uc,Ls,edge){
    const n=sponges.length+1, id='S'+n;
    const u0=uc-Ls/2,u1=uc+Ls/2, off=D/2+t/2;
    const cross=orient==='H'?'V':'H';
    const sp={id,orient,c,uc,Ls,edge,parts:[]};
    for(const [suf,cc] of [['a',c-off],['b',c+off]]){
      const pc=push(orient,'S',cc,u0-t,u1+t,[],'vent');
      if(pc){pc.id=id+suf;sp.parts.push(pc);}
    }
    for(const [suf,cc] of [['c',u0-t/2],['d',u1+t/2]]){
      const pc=push(cross,'S',cc,c-D/2,c+D/2,[],'cap');
      if(pc){pc.id=id+suf;sp.parts.push(pc);}
    }
    sponges.push(sp);
    const pt=orient==='H'?[uc,c]:[c,uc];
    fills.push({x:pt[0],y:pt[1],id});
  }
  function runPieces(orient,line,c,a,b,s,e,segState,segCenter){
    let cur={s,notches:[]};
    for(let q=a;q<b;q++){
      const st=segState(q),uc=segCenter(q);
      if(st==='tunnel')cur.notches.push(uc);
      if(st==='sponge'){
        const Ls=spongeLength(P,G);
        if(Ls<8){errors.push(`Sponge on ${orient}${line} does not fit: cells too small for a ${P.spongeLen}mm pocket.`);continue;}
        push(orient,line,c,cur.s,uc-Ls/2-t,cur.notches,'wall');
        addSponge(orient,c,uc,Ls,{orient,line,q});
        cur={s:uc+Ls/2+t,notches:[]};
      }
    }
    push(orient,line,c,cur.s,e,cur.notches,'wall');
  }
  // horizontal walls run straight through junctions
  for(let j=1;j<rows;j++){
    let k=0;
    while(k<cols){
      if(!present(hS(j,k))){k++;continue;}
      const a=k;while(k<cols&&present(hS(j,k)))k++;const b=k;
      const s=a===0?B:xs[a]-t/2, e=b===cols?W-B:xs[b]+t/2;
      runPieces('H',j,ys[j],a,b,s,e,q=>hS(j,q),q=>(xs[q]+xs[q+1])/2);
    }
  }
  // vertical walls butt against horizontal ones
  const covered=(j,i)=>j>=1&&j<rows&&(present(hS(j,i-1))||present(hS(j,i)));
  for(let i=1;i<cols;i++){
    let r=0;
    while(r<rows){
      if(!present(vS(r,i))){r++;continue;}
      const a=r;r++;
      while(r<rows&&present(vS(r,i))&&!covered(r,i))r++;
      const b=r;
      const s=a===0?B:(covered(a,i)?ys[a]+t/2:ys[a]-t/2);
      const e=b===rows?H-B:(covered(b,i)?ys[b]-t/2:ys[b]+t/2);
      runPieces('V',i,xs[i],a,b,s,e,q=>vS(q,i),q=>(ys[q]+ys[q+1])/2);
    }
  }
  // doors, one per tunnel
  const ch=chambers(L);
  const dt=doorType(P),doors=[];
  for(const e of interiorEdges(L,ch)){
    if(getEdge(L,e)!=='tunnel')continue;
    const closed=!(ch.list[e.a].active&&ch.list[e.b].active);
    const x=e.type==='H'?(xs[e.k]+xs[e.k+1])/2:xs[e.i], y=e.type==='H'?ys[e.j]:(ys[e.r]+ys[e.r+1])/2;
    doors.push({orient:e.type,x,y,closed});
  }
  const doorSlots=doors.map(d=>dt.slot(d,G,P)).filter(Boolean);
  // upright nests: small lips either side of tunnels through floors, to hold back loose sand
  if(P.orient==='upright'&&P.lipH>=2.5){
    const web=1.5;
    let n=0;
    for(const d of doors){
      if(d.orient!=='H')continue;
      n++;
      for(const [suf,sgn] of [['a',-1],['b',1]]){
        const cx=d.x+sgn*(tunnelW/2+t/2);
        pieces.push({id:'L'+n+suf,orient:'V',c:cx,s:d.y-t/2-P.lipH,e:d.y-t/2,notches:[],kind:'lip',windows:[],tabL:P.lipH-web});
      }
    }
  }
  // tabs and slots
  const slotsFront=[],slotsBack=[];
  const cl=P.slotClear;
  for(const pc of pieces){
    const len=pc.e-pc.s;
    pc.top=pc.kind==='lip'?[pc.tabL/2]:tabPositions(len,pc.notches.map(x=>x-pc.s),G,P);
    pc.bot=pc.top.slice();
    if(pc.kind==='vent'){
      const pitch=P.slotW+2.5, a0=t+1.5, a1=len-(t+1.5);
      for(let u=a0;u+P.slotW<=a1+1e-9;u+=pitch)pc.windows.push([u,u+P.slotW]);
    }
    const slot=(u)=>{
      const g=pc.s+u;
      const tl=(pc.tabL||P.tabL)/2;
      return pc.orient==='H'?{x0:g-tl-cl/2,x1:g+tl+cl/2,y0:pc.c-t/2-cl/2,y1:pc.c+t/2+cl/2}
                            :{x0:pc.c-t/2-cl/2,x1:pc.c+t/2+cl/2,y0:g-tl-cl/2,y1:g+tl+cl/2};
    };
    for(const u of pc.top)slotsFront.push(Object.assign(slot(u),{id:pc.id}));
    for(const u of pc.bot)slotsBack.push(Object.assign(slot(u),{id:pc.id}));
  }
  // footprints
  for(const pc of pieces){
    pc.rect=pc.orient==='H'?{x0:pc.s,x1:pc.e,y0:pc.c-t/2,y1:pc.c+t/2}:{x0:pc.c-t/2,x1:pc.c+t/2,y0:pc.s,y1:pc.e};
  }
  // ports
  const ports=[];
  const w=tunnelW;
  if(P.portPitch>=5){
    const sides=[['top',W],['bottom',W],['left',H],['right',H]];
    for(const [side,len] of sides){
      for(let q=P.portOffset;q<=len-P.portOffset+1e-6;q+=P.portPitch){
        const p={side,pos:q,cut:true,why:''};
        if(q-w/2<B+1||q+w/2>len-B-1){p.cut=false;p.why='too close to a corner';}
        let cell;
        if(side==='top'||side==='bottom'){
          const c=Math.min(cols-1,Math.max(0,Math.floor((q-B)/cellW)));const r=side==='top'?0:rows-1;cell=[r,c];
          for(let i=1;i<cols;i++)if(present(vS(r,i))&&Math.abs(q-xs[i])<t/2+w/2+0.5){p.cut=false;p.why='lands on a wall';}
        }else{
          const r=Math.min(rows-1,Math.max(0,Math.floor((q-B)/cellH)));const c=side==='left'?0:cols-1;cell=[r,c];
          for(let j=1;j<rows;j++)if(present(hS(j,c))&&Math.abs(q-ys[j])<t/2+w/2+0.5){p.cut=false;p.why='lands on a wall';}
        }
        p.cell=cell;p.chamber=ch.id[cell[0]][cell[1]];p.active=L.active[cell[0]][cell[1]];
        ports.push(p);
      }
    }
  }
  ports.forEach((p,i)=>p.id='P'+(i+1));
  // frame pieces
  const sideIdx={top:0,right:1,bottom:2,left:3};
  const cuts=ports.filter(p=>p.cut).map(p=>{
    const s=sideIdx[p.side];const q=s===0||s===1?p.pos:(s===2?W-p.pos:H-p.pos);return {side:s,q};
  });
  const frame=framePieces(W,H,B,cuts,w);
  // pegs or bolts around the border
  const fastD=P.fastener==='peg'?P.pegW:P.boltD;
  const bolts=[];
  const portNear=(side,pos)=>ports.some(p=>p.cut&&p.side===side&&Math.abs(p.pos-pos)<w/2+fastD/2+1.5);
  const hb=B/2;
  for(const [x,y] of [[hb,hb],[W-hb,hb],[W-hb,H-hb],[hb,H-hb]])bolts.push({x,y,along:'x'});
  for(const [side,len] of [['top',W],['bottom',W],['left',H],['right',H]]){
    const span=len-2*hb;const n=Math.max(1,Math.ceil(span/Math.max(10,P.boltSpacing)));
    for(let m=1;m<n;m++){
      let pos=hb+span*m/n;
      if(portNear(side,pos)){
        const alt=[pos-(w/2+fastD/2+3),pos+(w/2+fastD/2+3)].find(a=>!portNear(side,a));
        if(alt===undefined)continue;pos=alt;
      }
      if(side==='top')bolts.push({x:pos,y:hb,along:'x'});else if(side==='bottom')bolts.push({x:pos,y:H-hb,along:'x'});
      else if(side==='left')bolts.push({x:hb,y:pos,along:'y'});else bolts.push({x:W-hb,y:pos,along:'y'});
    }
  }
  if(P.fastener==='bolt'&&P.boltD>B-4)errors.push(`Bolt holes (${P.boltD}mm) are too big for a ${B}mm border.`);
  if(P.fastener==='peg'&&t+2>B-4)errors.push(`Peg slots are too wide for a ${B}mm border.`);
  const fasteners=P.fastener==='cement'?[]:bolts;
  // cover sockets: through slots in the border, so a cover fits either face
  const socketL=14,sockets=[];
  if(P.coverType==='whole'){
    const free=(side,pos)=>{
      const along=side==='top'||side==='bottom';
      if(ports.some(p=>p.cut&&p.side===side&&Math.abs(p.pos-pos)<w/2+socketL/2+2))return false;
      return !fasteners.some(f=>{
        const onSide=side==='top'?f.y===hb:side==='bottom'?f.y===H-hb:side==='left'?f.x===hb:f.x===W-hb;
        return onSide&&Math.abs((along?f.x:f.y)-pos)<fastD/2+socketL/2+2;
      });
    };
    for(const [side,len,fr] of [['top',W,[.25,.75]],['bottom',W,[.25,.75]],['left',H,[.5]],['right',H,[.5]]]){
      for(const f of fr){
        for(let dd=0;dd<=len/4;dd+=1){
          const pos=[len*f+dd,len*f-dd].find(q=>q>socketL&&q<len-socketL&&free(side,q));
          if(pos===undefined)continue;
          sockets.push(side==='top'?{x:pos,y:hb,along:'x'}:side==='bottom'?{x:pos,y:H-hb,along:'x'}:side==='left'?{x:hb,y:pos,along:'y'}:{x:W-hb,y:pos,along:'y'});
          break;
        }
      }
    }
    if(sockets.length<4)warnings.push('Could not find room for all the cover sockets.');
  }
  // air vents
  const vents=[];
  const vg=Math.max(0,Math.round(P.ventGrid||0)), vp=Math.max(P.ventD*3,4);
  const ventAt=([cx,cy])=>{for(let a=0;a<vg;a++)for(let b=0;b<vg;b++)vents.push({x:cx+(a-(vg-1)/2)*vp,y:cy+(b-(vg-1)/2)*vp});};
  // a brood chamber is a clear square; odd shapes get vents per cell, because their centre can fall on a wall
  if(vg>0)for(const c of ch.list){
    if(c.merged&&!c.brood)for(const [r,cc] of c.cells)ventAt([(xs[cc]+xs[cc+1])/2,(ys[r]+ys[r+1])/2]);
    else ventAt(chamberCenter(G,c));
  }
  // sanity checks
  if(depth<=0)errors.push('Depth must be above 0.');
  if(tunnelH>=depth-1)errors.push(`Tunnel height ${f1(tunnelH)}mm leaves no bridge above it (depth ${f1(depth)}mm).`);
  if(tunnelW+4>Math.min(cellW,cellH)-t)errors.push(`Tunnels (${f1(tunnelW)}mm) are too wide for ${f1(Math.min(cellW,cellH))}mm cells.`);
  if(Math.min(cellW,cellH)<3*t+P.tabL)warnings.push('Cells are very small for this wall thickness and tab length.');
  // strips are never rotated when nested, so only the stock width counts
  const maxLen=P.stockW-10;
  for(const pc of pieces)if(pc.e-pc.s>maxLen)errors.push(`${pc.id} is ${f1(pc.e-pc.s)}mm long, too long for ${P.stockW}mm wide stock (strips run along the width).`);
  if(depth+2*P.S+10>Math.min(P.stockW,P.stockH))errors.push('Strip stock sheet is too small for one strip.');
  // overlap self-check
  const eps=1e-6;
  for(const pc of pieces){
    const r=pc.rect;
    if(r.x0<B-eps||r.x1>W-B+eps||r.y0<B-eps||r.y1>H-B+eps)errors.push(`Geometry: ${pc.id} pokes into the border.`);
  }
  for(let a=0;a<pieces.length;a++)for(let b=a+1;b<pieces.length;b++){
    const p=pieces[a].rect,q=pieces[b].rect;
    const ox=Math.min(p.x1,q.x1)-Math.max(p.x0,q.x0), oy=Math.min(p.y1,q.y1)-Math.max(p.y0,q.y0);
    if(ox>1e-4&&oy>1e-4)errors.push(`Geometry: ${pieces[a].id} overlaps ${pieces[b].id}.`);
  }
  // thinnest strip of acrylic left between two cuts in the service sheet
  const asRect=(x,y,r)=>({x0:x-r,x1:x+r,y0:y-r,y1:y+r});
  const front=(G.service==='front'?slotsFront:slotsBack).concat(doorSlots,
    vents.map(v=>asRect(v.x,v.y,P.ventD/2)),fills.map(f=>asRect(f.x,f.y,P.fillD/2)));
  let minWeb=1e9;
  for(let a=0;a<front.length;a++)for(let b=a+1;b<front.length;b++){
    const p=front[a],q=front[b];
    const dx=Math.max(p.x0-q.x1,q.x0-p.x1,0),dy=Math.max(p.y0-q.y1,q.y0-p.y1,0);
    minWeb=Math.min(minWeb,Math.hypot(dx,dy));
  }
  return {pieces,sponges,fills,slotsFront,slotsBack,doors,doorSlots,ports,frame,fasteners,sockets,socketL,vents,minWeb,errors,warnings,ch};
}

export function framePieces(W,H,B,cuts,w){
  const outerPt=(s,q)=>[[q,0],[W,q],[W-q,H],[0,H-q]][s];
  const innerPt=(s,q)=>[[q,B],[W-B,q],[W-q,H-B],[B,H-q]][s];
  const outerEnd=[[W,0],[W,H],[0,H],[0,0]], innerEnd=[[W-B,B],[W-B,H-B],[B,H-B],[B,B]];
  if(!cuts.length)return [{poly:rectPts(0,0,W,H),hole:rectPts(B,B,W-B,H-B)}];
  const off=[0,W,W+H,2*W+H];
  const cs=cuts.map(c=>({side:c.side,a:c.q-w/2,b:c.q+w/2,g:off[c.side]+c.q})).sort((x,y)=>x.g-y.g);
  const out=[];
  for(let n=0;n<cs.length;n++){
    const A=cs[n],Bc=cs[(n+1)%cs.length];
    const outer=[outerPt(A.side,A.b)],inner=[innerPt(A.side,A.b)];
    let s=A.side;
    if(!(s===Bc.side&&Bc.a>=A.b&&cs.length>1)){
      let steps=0;
      do{outer.push(outerEnd[s]);inner.push(innerEnd[s]);s=(s+1)%4;steps++;}while(s!==Bc.side&&steps<5);
    }
    outer.push(outerPt(Bc.side,Bc.a));inner.push(innerPt(Bc.side,Bc.a));
    out.push({poly:outer.concat(inner.reverse())});
  }
  return out;
}
