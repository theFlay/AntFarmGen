import {f1,rectPts,polysOverlap} from './util.js';
import {stH,stV,chambers,chamberCenter,unitCenter,interiorEdges,getEdge} from './layout.js';
import {doorType} from './doors.js';
import {heatOn,heatEntry,heatLayer,borderHeat,borderRow,minHeatBorder} from './heat.js';
import {spongeLength} from './generate.js';
/* ---------------- geometry ---------------- */
// Tabs go in the solid runs either side of each tunnel notch, leaving room for a door slot.
export function tabPositions(len,notches,G,P,tl=P.tabL){
  const m=G.t+1,clear=G.tunnelW/2+3;
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
  const angles=[];
  function runPieces(orient,line,c,a,b,s,e,segState,segCenter,jogAt=()=>0){
    let cur={s,notches:[]};
    for(let q=a;q<b;q++){
      const st=segState(q),uc=segCenter(q);
      if(st==='tunnel')cur.notches.push(uc);
      const off=st==='solid'?jogAt(q):0;
      if(off){
        // out and back, so both ends of the wall stay on the grid and junctions are untouched
        const flat=cellW*0.18,m=Math.abs(off),b1=uc-flat-m,b2=uc-flat,b3=uc+flat,b4=uc+flat+m;
        const stub=push(orient,line,c,cur.s,b1+t/2,cur.notches,'wall');
        if(stub)stub.adapt=true;
        const mid=push(orient,line,c+off,b2-t/2,b3+t/2,[],'wall');
        if(mid)mid.adapt=true;
        angles.push([[b1,c],[b2,c+off]],[[b3,c+off],[b4,c]]);
        cur={s:b4-t/2,notches:[],adapt:true};
      }
      if(st==='sponge'){
        const Ls=spongeLength(P,G);
        if(Ls<8){errors.push(`Sponge on ${orient}${line} does not fit: cells too small for a ${P.spongeLen}mm pocket.`);continue;}
        push(orient,line,c,cur.s,uc-Ls/2-t,cur.notches,'wall');
        addSponge(orient,c,uc,Ls,{orient,line,q});
        cur={s:uc+Ls/2+t,notches:[]};
      }
    }
    const last=push(orient,line,c,cur.s,e,cur.notches,'wall');
    if(last&&cur.adapt)last.adapt=true;
  }
  // horizontal walls run straight through junctions
  for(let j=1;j<rows;j++){
    let k=0;
    while(k<cols){
      if(!present(hS(j,k))){k++;continue;}
      const a=k;while(k<cols&&present(hS(j,k)))k++;const b=k;
      const s=a===0?B:xs[a]-t/2, e=b===cols?W-B:xs[b]+t/2;
      runPieces('H',j,ys[j],a,b,s,e,q=>hS(j,q),q=>(xs[q]+xs[q+1])/2,q=>L.jogH[j][q]);
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
      const off=vS(a,i)==='solid'?L.jogV[a][i]:0;
      if(off){
        // a vertical wall butts a horizontal wall at both ends, so its lower half can simply sit to one side
        const k=off>0?i:i-1;
        const ok=b===a+1&&a>=1&&b<rows&&present(hS(a,k))&&present(hS(b,k));
        if(ok){
          const uc=(ys[a]+ys[b])/2,m=Math.abs(off),b1=uc-m/2,b2=uc+m/2;
          const top=push('V',i,xs[i],s,b1+t/2,[],'wall'),bot=push('V',i,xs[i]+off,b2-t/2,e,[],'wall');
          for(const x of [top,bot])if(x)x.adapt=true;
          angles.push([[xs[i],b1],[xs[i]+off,b2]]);
          continue;
        }
        warnings.push(`A jog on wall V${i} was skipped: it needs a solid wall at both ends.`);
      }
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
  // sensor pockets: a vented box in a chamber corner, opening through the service sheet
  const sensorBoxes=[];
  L.sensors.forEach(([r,c],n)=>{
    const sw=P.sensorW,sh=P.sensorH,id='N'+(n+1);
    const solid={
      top:r===0||(hS(r,c)==='solid'&&!L.jogH[r][c]),bottom:r===rows-1||(hS(r+1,c)==='solid'&&!L.jogH[r+1][c]),
      left:c===0||(vS(r,c)==='solid'&&!L.jogV[r][c]),right:c===cols-1||(vS(r,c+1)==='solid'&&!L.jogV[r][c+1]),
    };
    const corner=[['top','left'],['top','right'],['bottom','left'],['bottom','right']].find(([a,b])=>solid[a]&&solid[b]);
    if(L.diag[r][c]||!corner){errors.push(`Sensor pocket ${id} needs two solid walls meeting at a corner of its cell.`);return;}
    if(sw+2*t+8>cellW||sh+2*t+8>cellH){errors.push(`Sensor pocket ${id} is too big for this cell.`);return;}
    const sx=corner[1]==='left'?1:-1,sy=corner[0]==='top'?1:-1;
    const ex=sx>0?xs[c]+(c===0?0:t/2):xs[c+1]-(c===cols-1?0:t/2);
    const ey=sy>0?ys[r]+(r===0?0:t/2):ys[r+1]-(r===rows-1?0:t/2);
    const fx=ex+sx*sw,fy=ey+sy*sh,gx=ex+sx*(sw+t),gy=ey+sy*(sh+t);
    const v=push('V','N',ex+sx*(sw+t/2),Math.min(ey,gy),Math.max(ey,gy),[],'vent');
    const h=push('H','N',ey+sy*(sh+t/2),Math.min(ex,fx),Math.max(ex,fx),[],'vent');
    if(v){v.id=id+'a';v.adapt=true;}
    if(h){h.id=id+'b';h.adapt=true;}
    sensorBoxes.push({id,x0:Math.min(ex,fx),x1:Math.max(ex,fx),y0:Math.min(ey,fy),y1:Math.max(ey,fy),
      outer:{x0:Math.min(ex,gx),x1:Math.max(ex,gx),y0:Math.min(ey,gy),y1:Math.max(ey,gy)}});
  });
  // support pillars: a short tabbed post that ties the two sheets together
  const pillarSpots=[];
  L.pillars.forEach(([r,c],n)=>{
    if(L.diag[r][c]){errors.push('A pillar cannot go in a cell with a diagonal.');return;}
    const cham=ch.list[ch.of(r,c)];
    const [x,y]=cham.brood?chamberCenter(G,cham):[(xs[c]+xs[c+1])/2,(ys[r]+ys[r+1])/2];
    const pc=push('H','Q',y,x-6,x+6,[],'pillar');
    if(pc){pc.id='Q'+(n+1);pc.adapt=true;pillarSpots.push({x0:x-6,x1:x+6,y0:y-t/2,y1:y+t/2});}
  });
  // diagonal walls run corner to corner
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    if(L.diag[r][c]===1)angles.push([[xs[c],ys[r+1]],[xs[c+1],ys[r]]]);
    if(L.diag[r][c]===2)angles.push([[xs[c],ys[r]],[xs[c+1],ys[r+1]]]);
  }
  // Angled strips go in last. Each is trimmed until it just touches what it meets, so the
  // straight strips run past the joint and the gap left is a closed wedge, never a slot.
  const footprint=pc=>pc.poly||(pc.orient==='H'?rectPts(pc.s,pc.c-t/2,pc.e,pc.c+t/2):rectPts(pc.c-t/2,pc.s,pc.c+t/2,pc.e));
  const obstacles=pieces.map(footprint).concat([rectPts(0,0,W,B),rectPts(0,H-B,W,H),rectPts(0,0,B,H),rectPts(W-B,0,W,H)]);
  const band=(p,q)=>{
    const dx=q[0]-p[0],dy=q[1]-p[1],l=Math.hypot(dx,dy)||1,nx=-dy/l*t/2,ny=dx/l*t/2;
    return [[p[0]+nx,p[1]+ny],[q[0]+nx,q[1]+ny],[q[0]-nx,q[1]-ny],[p[0]-nx,p[1]-ny]];
  };
  // optional chamfers across the tight corners where a diagonal meets a wall
  if(P.chamfer>0)for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const dg=L.diag[r][c];if(!dg)continue;
    const ends=dg===1?[[xs[c],ys[r+1]],[xs[c+1],ys[r]]]:[[xs[c],ys[r]],[xs[c+1],ys[r+1]]];
    ends.forEach((C,n)=>{
      const D=ends[1-n],l=Math.hypot(D[0]-C[0],D[1]-C[1]),u=[(D[0]-C[0])/l,(D[1]-C[1])/l];
      const atTop=C[1]===ys[r],atLeft=C[0]===xs[c];
      const hasH=atTop?r===0||hS(r,c)!=='none':r===rows-1||hS(r+1,c)!=='none';
      const hasV=atLeft?c===0||vS(r,c)!=='none':c===cols-1||vS(r,c+1)!=='none';
      const onDiag=[C[0]+u[0]*P.chamfer,C[1]+u[1]*P.chamfer];
      if(hasH)angles.push([[C[0]+(atLeft?1:-1)*P.chamfer,C[1]],onDiag,true]);
      if(hasV)angles.push([[C[0],C[1]+(atTop?1:-1)*P.chamfer],onDiag,true]);
    });
  }
  angles.forEach(([p,q,soft],n)=>{
    const full=Math.hypot(q[0]-p[0],q[1]-p[1]),ux=(q[0]-p[0])/full,uy=(q[1]-p[1])/full;
    const at=(from,s)=>[from[0]+s*ux,from[1]+s*uy];
    const trim=(from,sign)=>{
      let s=0;
      const hit=v=>{const a=at(from,sign*v),b=at(from,sign*(v+0.5));const f=band(a,b);return obstacles.some(o=>polysOverlap(f,o));};
      if(!hit(0)){if(!soft)errors.push('A diagonal wall ends in open space, so ants could pass around it.');else skip=true;return 0;}
      while(s<full/2&&hit(s))s+=0.02;
      return s;
    };
    let skip=false;
    const s0=trim(p,1),s1=trim(q,-1);
    if(skip)return;
    const a=at(p,s0),b=at(q,-s1),len=full-s0-s1;
    if(len<4){if(!soft)errors.push('An angled wall is too short to cut.');return;}
    const pc={id:'A'+(n+1),orient:'D',kind:'angle',c:0,s:0,e:len,p0:a,dir:[ux,uy],notches:[],windows:[],poly:band(a,b)};
    pieces.push(pc);obstacles.push(pc.poly);
  });
  // tabs and slots
  const slotsFront=[],slotsBack=[];
  const cl=P.slotClear;
  for(const pc of pieces){
    const len=pc.e-pc.s;
    const small=(pc.kind==='angle'||pc.adapt)&&len<P.tabL+2*(t+1);
    if(small){const tl=Math.min(P.tabL,len-3);if(tl>=3)pc.tabL=tl;pc.top=tl>=3?[len/2]:[];}
    else if(pc.kind==='lip')pc.top=[pc.tabL/2];
    else{
      // a strip with a tunnel needs a tab each side, so shorten the tabs a little if it has to
      const nl=pc.notches.map(x=>x-pc.s);
      pc.top=tabPositions(len,nl,G,P);
      for(const tl of [7,6,5]){
        if(!nl.length||pc.top.length>nl.length||tl>=P.tabL)continue;
        const shorter=tabPositions(len,nl,G,P,tl);
        if(shorter.length>pc.top.length){pc.top=shorter;pc.tabL=tl;}
      }
    }
    pc.bot=pc.top.slice();
    if(pc.kind==='vent'){
      const pitch=P.slotW+2.5, a0=t+1.5, a1=len-(t+1.5);
      for(let u=a0;u+P.slotW<=a1+1e-9;u+=pitch)pc.windows.push([u,u+P.slotW]);
    }
    const slot=(u)=>{
      const g=pc.s+u;
      const tl=(pc.tabL||P.tabL)/2;
      if(pc.orient==='D'){
        const [x,y]=[pc.p0[0]+pc.dir[0]*u,pc.p0[1]+pc.dir[1]*u],[ux,uy]=pc.dir,a=tl+cl/2,b=t/2+cl/2;
        const poly=[[x-ux*a-uy*b,y-uy*a+ux*b],[x+ux*a-uy*b,y+uy*a+ux*b],[x+ux*a+uy*b,y+uy*a-ux*b],[x-ux*a+uy*b,y-uy*a-ux*b]];
        return {poly,x0:Math.min(...poly.map(v=>v[0])),x1:Math.max(...poly.map(v=>v[0])),y0:Math.min(...poly.map(v=>v[1])),y1:Math.max(...poly.map(v=>v[1]))};
      }
      return pc.orient==='H'?{x0:g-tl-cl/2,x1:g+tl+cl/2,y0:pc.c-t/2-cl/2,y1:pc.c+t/2+cl/2}
                            :{x0:pc.c-t/2-cl/2,x1:pc.c+t/2+cl/2,y0:g-tl-cl/2,y1:g+tl+cl/2};
    };
    for(const u of pc.top)slotsFront.push(Object.assign(slot(u),{id:pc.id}));
    for(const u of pc.bot)slotsBack.push(Object.assign(slot(u),{id:pc.id}));
  }
  // footprints
  for(const pc of pieces){
    pc.poly=footprint(pc);
    const X=pc.poly.map(v=>v[0]),Y=pc.poly.map(v=>v[1]);
    pc.rect={x0:Math.min(...X),x1:Math.max(...X),y0:Math.min(...Y),y1:Math.max(...Y)};
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
        p.cell=cell;p.chamber=ch.at(cell[0],cell[1],side);p.active=ch.list[p.chamber].active;
        p.key=`${side}:${q}`;p.used=p.cut&&L.portsUsed.includes(p.key);
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
  const hb=borderRow(P);
  const edgeHeat=borderHeat(P);
  if(edgeHeat&&B<minHeatBorder(P))errors.push(`Border heat needs a border of at least ${f1(minHeatBorder(P))}mm.`);
  // joiner slots sit midway between ports, so they stay on a fixed grid whatever the cells do
  const joints=[];
  if(P.joinSlots&&B>=12&&P.portPitch>=5){
    for(const [side,len] of [['top',W],['bottom',W],['left',H],['right',H]]){
      for(let q=P.portOffset+P.portPitch/2;q<len-P.portOffset;q+=P.portPitch){
        joints.push(Object.assign({side,pos:q},
          side==='top'?{x:q,y:hb,along:'y'}:side==='bottom'?{x:q,y:H-hb,along:'y'}:side==='left'?{x:hb,y:q,along:'x'}:{x:W-hb,y:q,along:'x'}));
      }
    }
  }
  const jointNear=(side,pos,r)=>joints.some(j=>j.side===side&&Math.abs(j.pos-pos)<r+t/2+2);
  const heat=heatOn(P)?heatLayer(P):null;
  const stubW=edgeHeat?P.heatEdgeW:0;
  const heatNear=(side,pos)=>(heat&&(side==='left'||side==='right')&&Math.abs(pos-heatEntry(P))<P.heatW/2+fastD/2+2)||
    (edgeHeat&&edgeHeat.stubs.some(s=>s.side===side&&Math.abs(s.pos-pos)<stubW/2+fastD/2+2));
  const portNear=(side,pos)=>ports.some(p=>p.cut&&p.side===side&&Math.abs(p.pos-pos)<w/2+fastD/2+1.5)||jointNear(side,pos,fastD/2)||heatNear(side,pos);
  for(const [x,y] of [[hb,hb],[W-hb,hb],[W-hb,H-hb],[hb,H-hb]])bolts.push({x,y,along:'x'});
  for(const [side,len] of [['top',W],['bottom',W],['left',H],['right',H]]){
    const span=len-2*hb;const n=Math.max(1,Math.ceil(span/Math.max(10,P.boltSpacing)));
    for(let m=1;m<n;m++){
      let pos=hb+span*m/n;
      if(portNear(side,pos)){
        const step=Math.max(w,heat?P.heatW:0)/2+fastD/2+3;
        const alt=[pos-step,pos+step].find(a=>!portNear(side,a));
        if(alt===undefined)continue;pos=alt;
      }
      if(side==='top')bolts.push({x:pos,y:hb,along:'x'});else if(side==='bottom')bolts.push({x:pos,y:H-hb,along:'x'});
      else if(side==='left')bolts.push({x:hb,y:pos,along:'y'});else bolts.push({x:W-hb,y:pos,along:'y'});
    }
  }
  if(P.fastener==='bolt'&&P.boltD>B-4)errors.push(`Bolt holes (${P.boltD}mm) are too big for a ${B}mm border.`);
  if(P.fastener==='peg'&&t+2>B-4)errors.push(`Peg slots are too wide for a ${B}mm border.`);
  const fasteners=P.fastener==='cement'?[]:bolts;
  if(P.heatChannel&&!heat)warnings.push('The heat channel is for flat nests only, so it is left out.');
  // cover sockets: through slots in the border, so a cover fits either face
  const socketL=14,sockets=[];
  if(P.coverType==='whole'){
    const free=(side,pos)=>{
      const along=side==='top'||side==='bottom';
      if(ports.some(p=>p.cut&&p.side===side&&Math.abs(p.pos-pos)<w/2+socketL/2+2))return false;
      if(jointNear(side,pos,socketL/2))return false;
      if(edgeHeat&&edgeHeat.stubs.some(s=>s.side===side&&Math.abs(s.pos-pos)<stubW/2+socketL/2+2))return false;
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
    if(c.reservoir)continue;
    if(c.merged&&!c.brood)for(const u of c.cells)ventAt(unitCenter(G,u));
    else ventAt(chamberCenter(G,c));
  }
  // no vents inside a sensor pocket or under a pillar
  const clearOf=[...sensorBoxes.map(b=>b.outer),...pillarSpots];
  for(let i=vents.length-1;i>=0;i--){
    const v=vents[i];
    if(clearOf.some(b=>v.x>b.x0-2&&v.x<b.x1+2&&v.y>b.y0-2&&v.y<b.y1+2))vents.splice(i,1);
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
    if(Math.min(p.x1,q.x1)-Math.max(p.x0,q.x0)<=0||Math.min(p.y1,q.y1)-Math.max(p.y0,q.y0)<=0)continue;
    if(polysOverlap(pieces[a].poly,pieces[b].poly))errors.push(`Geometry: ${pieces[a].id} overlaps ${pieces[b].id}.`);
  }
  // water chambers fill through a hole near their top
  for(const [r,c] of L.reservoirs)fills.push({x:(xs[c]+xs[c+1])/2,y:ys[r]+t/2+6,id:'W'});
  // water vials stand over a sponge's fill hole, held by two posts in blind slots over the wall
  const vials=[],vialSlots=[];
  for(const e of L.vials){
    const sp=sponges.find(s=>e.type==='H'?(s.orient==='H'&&s.edge.line===e.j&&s.edge.q===e.k):(s.orient==='V'&&s.edge.line===e.i&&s.edge.q===e.r));
    if(!sp)continue;
    const off=sp.Ls/2+t+2.4,hl=2.1,ht=t/2+0.1;
    if(P.vialD>2*off-6)errors.push(`A ${P.vialD}mm vial is too wide for the sponge pocket, the most that fits is ${f1(2*off-6)}mm.`);
    for(const sgn of [-1,1]){
      const u=sp.uc+sgn*off;
      vialSlots.push(sp.orient==='H'?{x0:u-hl,x1:u+hl,y0:sp.c-ht,y1:sp.c+ht}:{x0:sp.c-ht,x1:sp.c+ht,y0:u-hl,y1:u+hl});
    }
    vials.push({x:sp.orient==='H'?sp.uc:sp.c,y:sp.orient==='H'?sp.c:sp.uc,orient:sp.orient,off});
  }
  // thinnest strip of acrylic left between two cuts in the service sheet
  const asRect=(x,y,r)=>({x0:x-r,x1:x+r,y0:y-r,y1:y+r});
  // rotated slots are left out: their bounding boxes would overstate how close they are
  const front=(G.service==='front'?slotsFront:slotsBack).filter(s=>!s.poly).concat(doorSlots,
    vents.map(v=>asRect(v.x,v.y,P.ventD/2)),fills.map(f=>asRect(f.x,f.y,P.fillD/2)));
  let minWeb=1e9;
  for(let a=0;a<front.length;a++)for(let b=a+1;b<front.length;b++){
    const p=front[a],q=front[b];
    const dx=Math.max(p.x0-q.x1,q.x0-p.x1,0),dy=Math.max(p.y0-q.y1,q.y0-p.y1,0);
    minWeb=Math.min(minWeb,Math.hypot(dx,dy));
  }
  return {pieces,sponges,fills,slotsFront,slotsBack,doors,doorSlots,ports,frame,fasteners,sockets,socketL,joints,sensorBoxes,heat,edgeHeat,vials,vialSlots,vents,minWeb,errors,warnings,ch};
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
