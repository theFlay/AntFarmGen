// Test tube rack: tubes lie flat, as on a bench, in one or two facing rows.
// Each tube passes through a round hole in an end plate and rests in a comb near its closed
// end, up against a stop wall, so its open end sticks out by a set amount.
import {fmt,rectPts} from './util.js';
import {pen,svgDoc} from './export.js';
import {cleanParam} from './sanitize.js';

export const RACK_FIELDS=[
  {k:'tubeD',l:'Tube diameter (mm)',d:16,step:0.5,range:[5,60],h:'Measure the outside of your widest tube.'},
  {k:'tubeL',l:'Tube length (mm)',d:150,step:1,range:[40,400]},
  {k:'stick',l:'Sticking out (mm)',d:20,step:1,range:[5,150]},
  {k:'left',l:'Tubes on the left',d:6,step:1,range:[1,40]},
  {k:'right',l:'Tubes on the right',d:5,step:1,range:[0,40],h:'0 makes a one-sided rack.'},
  {k:'gap',l:'Gap between tubes (mm)',d:3,step:0.5,range:[1.5,30]},
  {k:'holeClear',l:'Hole clearance (mm)',d:0.6,step:0.1,range:[0,5],h:'Added to the tube diameter. Tune it with the hole test strip.'},
  {k:'lid',l:'Lift-off lid',d:true,bool:true,h:'A red rack with a lid only needs its tube ends covered.'},
  {k:'cover',l:'Tube end cover',d:'sheath',opts:[['none','None'],['caps','One cap per tube'],['sheath','One sheath per side'],['hood','Hood over everything']],h:'Caps and sheaths suit a red rack. The hood is for a rack cut from clear acrylic.'},
  {k:'numbers',l:'Engrave tube numbers',d:true,bool:true},
  {k:'t',l:'Sheet thickness, measured (mm)',d:3,step:0.01,range:[1.5,10]},
  {k:'kerf',l:'Kerf (mm)',d:0.15,step:0.01,range:[0,2]},
  {k:'slotClear',l:'Slot clearance (mm)',d:0,step:0.01,range:[-2,2]},
  {k:'stockW',l:'Sheet width (mm)',d:600,range:[50,3000]},
  {k:'stockH',l:'Sheet height (mm)',d:400,range:[50,3000]},
];
export const rackDefaults=()=>Object.fromEntries(RACK_FIELDS.map(f=>[f.k,f.d]));
export const cleanRack=R=>Object.fromEntries(RACK_FIELDS.map(f=>[f.k,cleanParam(f,f.k in R?R[f.k]:f.d)]));

// a plate with tabs (positive depth) or notches (negative depth) on any edge
function plate(w,h,f={}){
  const pts=[[0,0]];
  const by=(a,dir)=>(a||[]).slice().sort((x,y)=>dir*(x.u-y.u));
  for(const {u,l,d} of by(f.top,1))pts.push([u-l/2,0],[u-l/2,-d],[u+l/2,-d],[u+l/2,0]);
  pts.push([w,0]);
  for(const {u,l,d} of by(f.right,1))pts.push([w,u-l/2],[w+d,u-l/2],[w+d,u+l/2],[w,u+l/2]);
  pts.push([w,h]);
  for(const {u,l,d} of by(f.bottom,-1))pts.push([u+l/2,h],[u+l/2,h+d],[u-l/2,h+d],[u-l/2,h]);
  pts.push([0,h]);
  for(const {u,l,d} of by(f.left,-1))pts.push([0,u+l/2],[-d,u+l/2],[-d,u-l/2],[0,u-l/2]);
  const ox=-Math.min(...pts.map(p=>p[0])),oy=-Math.min(...pts.map(p=>p[1]));
  return {poly:pts.map(([x,y])=>[x+ox,y+oy]),w:Math.max(...pts.map(p=>p[0]))+ox,h:Math.max(...pts.map(p=>p[1]))+oy,ox,oy};
}
const spread=(len,tab)=>len>=4*tab?[len/4,3*len/4]:[len/2];

export function buildRack(input){
  const R=cleanRack(input),{t,gap}=R,errors=[],warnings=[];
  const D=R.tubeD+R.holeClear,twoSided=R.right>0,lift=2,inset=6,head=3;
  const run=R.tubeL-R.stick;                     // from the end plate's outer face to the stop wall
  if(run<25)errors.push('The tubes stick out too far: less than 25mm would be held.');
  const n=Math.max(R.left,R.right);
  const edge=4;                                  // base margin: slots right on an edge would break out
  const Wi=n*D+(n+1)*gap,Wo=Wi+2*t+2*edge;
  const Lo=2*inset+(twoSided?2*run+t:run+t);
  const Hi=lift+D+head;
  const zc=lift+D/2;                             // tube centre above the base
  const tabB=Math.min(10,Wi/3),tabS=Math.min(10,Hi-6);
  const cl=R.slotClear;
  const rowY=k=>{const s=(Wi-(k*D+(k-1)*gap))/2+D/2;return i=>s+i*(D+gap);};
  const hood=R.cover==='hood',lid=R.lid&&!hood;
  const topTabs=lid;

  // where each cross plate sits along the rack
  const stops=[],combs=[],ends=[];
  ends.push({x:inset+t/2,side:'L',count:R.left});
  if(twoSided){
    stops.push(inset+run+t/2);
    ends.push({x:Lo-inset-t/2,side:'R',count:R.right});
    if(run>=45)combs.push({x:inset+run-12,count:R.left},{x:inset+run+t+12,count:R.right});
  }else{
    stops.push(inset+run+t/2);
    if(run>=45)combs.push({x:inset+run-12,count:R.left});
  }
  const parts=[],baseSlots=[],topSlots=[],wallSlots=[];
  const slotAcross=(x,y,l)=>rectPts(x-t/2-cl/2,y-l/2-cl/2,x+t/2+cl/2,y+l/2+cl/2);
  const slotAlong=(x,y,l)=>rectPts(x-l/2-cl/2,y-t/2-cl/2,x+l/2+cl/2,y+t/2+cl/2);
  const yTabs=spread(Wi,tabB);
  function crossPlate(name,x,extra={}){
    const h=extra.h||Hi,sideL=Math.min(tabS,h-4);
    const f={bottom:yTabs.map(u=>({u,l:tabB,d:t})),left:[{u:h/2,l:sideL,d:t}],right:[{u:h/2,l:sideL,d:t}]};
    if(extra.notches)f.top=extra.notches;
    else if(topTabs&&!extra.noTop)f.top=yTabs.map(u=>({u,l:tabB,d:t}));
    const p=plate(Wi,h,f);
    for(const u of yTabs){
      baseSlots.push(slotAcross(x,edge+t+u,tabB));
      if(f.top&&!extra.notches&&lid)topSlots.push(slotAcross(x,edge+t+u,tabB));
    }
    // v runs up from the base
    wallSlots.push({x,v:h/2,l:sideL});
    const out={name,w:p.w,h:p.h,poly:p.poly,holes:[],circles:[],labels:[]};
    (extra.circles||[]).forEach(([u,v])=>out.circles.push([u+p.ox,h-v+p.oy,D]));
    (extra.labels||[]).forEach(([u,v,s])=>out.labels.push([u+p.ox,h-v+p.oy,s]));
    parts.push(out);
  }
  for(const e of ends){
    const y=rowY(e.count),holes=[],labels=[];
    for(let i=0;i<e.count;i++){
      holes.push([y(i),zc]);
      if(R.numbers)labels.push([y(i),Hi-1.6,e.side+(i+1)]);
    }
    crossPlate('end plate',e.x,{circles:holes,labels});
  }
  for(const x of stops)crossPlate('stop wall',x);
  for(const c of combs){
    const y=rowY(c.count),notches=[];
    for(let i=0;i<c.count;i++)notches.push({u:y(i),l:D,d:-D/2});
    crossPlate('comb',x_of(c),{h:zc,notches});
  }
  function x_of(c){return c.x;}

  // side walls run the full length
  const xTabs=spread(Lo,10);
  for(const y of [edge+t/2,Wo-edge-t/2]){
    const f={bottom:xTabs.map(u=>({u,l:10,d:t}))};
    if(topTabs)f.top=xTabs.map(u=>({u,l:10,d:t}));
    const p=plate(Lo,Hi,f);
    const holes=wallSlots.map(s=>rectPts(s.x-t/2-cl/2+p.ox,Hi-s.v-s.l/2-cl/2+p.oy,s.x+t/2+cl/2+p.ox,Hi-s.v+s.l/2+cl/2+p.oy));
    parts.push({name:'side wall',w:p.w,h:p.h,poly:p.poly,holes,circles:[],labels:[]});
    for(const u of xTabs){baseSlots.push(slotAlong(u,y,10));if(lid)topSlots.push(slotAlong(u,y,10));}
  }
  parts.push({name:'base',w:Lo,h:Wo,poly:rectPts(0,0,Lo,Wo),holes:baseSlots,circles:[],labels:[]});

  // covers are separate so they can be cut from a different colour
  const cover=[];
  if(lid)cover.push({name:'lid',w:Lo,h:Wo,poly:rectPts(0,0,Lo,Wo),holes:topSlots,circles:[],labels:[]});
  // a four or five sided box with no bottom, resting on the bench
  function box(name,inL,inW,hh,ends){
    const tl=10,xs=spread(inL,tl),ys=spread(inW,tl),sideH=Math.min(tl,hh-6),hl=inL+2*t,hw=inW+2*t;
    const endX=ends===2?[t/2,hl-t/2]:[hl-t/2];
    const top=[];
    for(const y of [t/2+3,hw+3-t/2])for(const u of xs)top.push(slotAlong(t+u,y,tl));
    for(const x of endX)for(const u of ys)top.push(slotAcross(x,t+3+u,tl));
    cover.push({name:name+' top',w:hl+3,h:hw+6,poly:rectPts(-3,0,hl+3,hw+6).map(([x,y])=>[x+3,y]),holes:top.map(p=>p.map(([x,y])=>[x+3,y])),circles:[],labels:[]});
    for(let i=0;i<2;i++){
      const p=plate(hl,hh,{top:xs.map(u=>({u:t+u,l:tl,d:t}))});
      const holes=endX.map(x=>rectPts(x-t/2-cl/2,p.oy+hh/2-sideH/2-cl/2,x+t/2+cl/2,p.oy+hh/2+sideH/2+cl/2));
      cover.push({name:name+' side',w:p.w,h:p.h,poly:p.poly,holes,circles:[],labels:[]});
    }
    for(let i=0;i<ends;i++){
      const q=plate(inW,hh,{top:ys.map(u=>({u,l:tl,d:t})),left:[{u:hh/2,l:sideH,d:t}],right:[{u:hh/2,l:sideH,d:t}]});
      cover.push({name:name+' end',w:q.w,h:q.h,poly:q.poly,holes:[],circles:[],labels:[]});
    }
    return {hl,hw};
  }
  const rackH=Hi+2*t,reach=R.stick+4;
  let hoodSize=null,sheathSize=null;
  if(hood){
    // for a clear rack: one box over everything, sized to clear the tube ends
    const inL=twoSided?Lo-2*inset+2*reach:Lo-inset+reach;
    hoodSize=box('hood',inL,Wo+1,rackH+3,2);
  }
  if(R.cover==='sheath'){
    // for a red rack: slides over one end, covering every tube end on that side
    const overlap=15,inL=inset+reach+overlap;
    for(let i=0;i<(twoSided?2:1);i++)sheathSize=box('sheath',inL,Wo+1,rackH+1,1);
  }
  const capW=R.tubeD+0.6;                        // inside width of a cap
  const capOut=capW+2*t,capLen=R.stick+3+t;
  if(R.cover==='caps'){
    const need=capOut+0.5-D;
    if(gap<need)errors.push(`Caps are ${fmt(capOut)}mm wide, so neighbours would hit each other. Set the gap to at least ${fmt(need)}mm, or use a sheath.`);
    const fl=capLen/2;
    for(let i=0;i<R.left+R.right;i++){
      // box joints along the corners: two wide sides with notches, two narrow with tabs
      for(let k=0;k<2;k++){
        const p=plate(capOut,capLen,{left:[{u:capLen/2,l:fl,d:-t}],right:[{u:capLen/2,l:fl,d:-t}]});
        const y=p.oy+t+3-t/2,c=capOut/2+p.ox,sw=capW/2;
        cover.push({name:'cap wide side',w:p.w,h:p.h,poly:p.poly,holes:[rectPts(c-sw/2-cl/2,y-t/2-cl/2,c+sw/2+cl/2,y+t/2+cl/2)],circles:[],labels:[]});
        const q=plate(capW,capLen,{left:[{u:capLen/2,l:fl,d:t}],right:[{u:capLen/2,l:fl,d:t}]});
        const qy=q.oy+t+3-t/2,qc=capW/2+q.ox;
        cover.push({name:'cap narrow side',w:q.w,h:q.h,poly:q.poly,holes:[rectPts(qc-sw/2-cl/2,qy-t/2-cl/2,qc+sw/2+cl/2,qy+t/2+cl/2)],circles:[],labels:[]});
      }
      const e=plate(capW,capW,['top','right','bottom','left'].reduce((o,k)=>(o[k]=[{u:capW/2,l:capW/2,d:t}],o),{}));
      cover.push({name:'cap end',w:e.w,h:e.h,poly:e.poly,holes:[],circles:[],labels:[]});
    }
  }
  for(const p of [...parts,...cover])if(p.w>R.stockW-10||p.h>R.stockH-10)errors.push(`The ${p.name} is ${fmt(p.w)} x ${fmt(p.h)}mm, too big for the ${R.stockW} x ${R.stockH}mm sheet.`);
  if(hood)warnings.push('A hood blocks air and light. Tubes breathe through their cotton, so lift it often to check for condensation or mould.');
  if(R.cover==='sheath'||R.cover==='caps')warnings.push('Cut covers from red acrylic, the same as the rack. Check each tube can still breathe through its cotton.');
  const tubes=[];
  const row=(k,x0,x1,tag)=>{const y=rowY(k);for(let i=0;i<k;i++)tubes.push({x0,x1,y:edge+t+y(i),id:tag+(i+1)});};
  row(R.left,inset-R.stick,inset+run,'L');
  if(twoSided)row(R.right,Lo-inset-run,Lo-inset+R.stick,'R');
  return {R,parts,cover,errors,warnings,Lo,Wo,Hi,D,run,tubes,inset,edge,stops,ends,combs:combs.map(c=>c.x),capOut,capLen,hoodSize,sheathSize,rackH};
}

function nest(items,R){
  const sorted=items.slice().sort((a,b)=>b.w-a.w),margin=5,gap=2+R.kerf,sheets=[];
  let cur,x,y,rowH;
  const next=()=>{cur=[];sheets.push(cur);x=margin;y=margin;rowH=0;};
  next();
  for(const it of sorted){
    if(x+it.w>R.stockW-margin){x=margin;y+=rowH+gap;rowH=0;}
    if(y+it.h>R.stockH-margin)next();
    cur.push({it,x,y});x+=it.w+gap;rowH=Math.max(rowH,it.h);
  }
  return sheets;
}
export function rackFiles(rack,colors={cutColor:'#ff0000',engraveColor:'#000000'}){
  const {R}=rack,d=pen({kerf:R.kerf,...colors}),files=[];
  const draw=(list,name,title)=>{
    nest(list,R).forEach((sheet,i,all)=>{
      const b=[];
      for(const {it,x,y} of sheet){
        b.push(d.outline(it.poly,x,y));
        for(const h of it.holes)b.push(d.cutout(h,x,y));
        for(const [cx,cy,dia] of it.circles)b.push(d.hole(x+cx,y+cy,dia));
        for(const [cx,cy,s] of it.labels)b.push(d.txt(x+cx,y+cy,s,2.2));
      }
      files.push({name:`${name}${all.length>1?'-'+(i+1):''}.svg`,data:svgDoc(R.stockW,R.stockH,b.join('\n'),title)});
    });
  };
  draw(rack.parts,'rack-sheet','Test tube rack parts');
  if(rack.cover.length)draw(rack.cover,'rack-cover','Rack covers, kept separate so they can be cut from another colour');
  return files;
}
// holes either side of the chosen size, to find the fit for real tubes
export function rackHoleTest(input){
  const R=cleanRack(input),d=pen({kerf:R.kerf,cutColor:'#ff0000',engraveColor:'#000000'});
  const steps=[0,0.2,0.4,0.6,0.8,1,1.5],D=R.tubeD,pitch=D+9,W=steps.length*pitch+8,H=D+22,b=[d.outline(rectPts(0,0,W,H))];
  steps.forEach((c,i)=>{
    const x=8+D/2+i*pitch;
    b.push(d.hole(x,6+D/2,D+c),d.txt(x,D+14,'+'+fmt(c),3));
  });
  return {name:'rack-hole-test.svg',data:svgDoc(W,H,b.join('\n'),'Tube hole test')};
}
// a plain top-down picture of the rack
export function rackPreview(rack){
  const {R,Lo,Wo,tubes,stops,ends,combs,edge}=rack,t=R.t,pad=R.stick+8,w=Lo+2*pad,h=Wo+16;
  const o=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(-pad)} -8 ${fmt(w)} ${fmt(h)}" font-family="system-ui,Arial,sans-serif">`];
  o.push(`<rect x="0" y="0" width="${fmt(Lo)}" height="${fmt(Wo)}" fill="#e5a59b"/>`);
  for(const p of tubes){
    o.push(`<rect x="${fmt(p.x0)}" y="${fmt(p.y-R.tubeD/2)}" width="${fmt(p.x1-p.x0)}" height="${fmt(R.tubeD)}" rx="${fmt(R.tubeD/2)}" fill="#f7f4ee" stroke="#8c867a" stroke-width="0.6"/>`);
    o.push(`<text x="${fmt((p.x0+p.x1)/2)}" y="${fmt(p.y+1.6)}" font-size="4.5" text-anchor="middle" fill="#736c60">${p.id}</text>`);
  }
  for(const x of [...ends.map(e=>e.x),...stops,...combs])o.push(`<rect x="${fmt(x-t/2)}" y="${fmt(edge+t)}" width="${fmt(t)}" height="${fmt(Wo-2*edge-2*t)}" fill="#a3281f"/>`);
  for(const y of [edge,Wo-edge-t])o.push(`<rect x="0" y="${fmt(y)}" width="${fmt(Lo)}" height="${fmt(t)}" fill="#a3281f"/>`);
  o.push('</svg>');
  return o.join('');
}
