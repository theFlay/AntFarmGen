// Parts shared by the single starter nest and the row of starter nests: tube sockets, plugs and lids.
import {fmt,f1,rectPts} from './util.js';
import {meshBoxes,meshInPlace,mapMesh,circlePts,partSolid,meshBounds,solidBounds,fitsPrinter} from './stl.js';

// fixed sizes, first guesses until a test print
export const HATCH_FIT=0.4,HATCH_WALL=1.6,HATCH_FLANGE=4,HATCH_LEDGE=1.5,SLIT_EDGE=3,SLIT_PITCH=2.2;
export const SOCK_WALL=2.4,SOCK_LEN=12,TOWER_WALL=2,TOWER_CLEAR=1,NOTCH=12,PLUG_FLANGE=2;

// A tube socket on an outer wall: a printed block with a round bore, and a doorway through the
// wall the size of the tube's inside. face is 'x-', 'y+' or 'y-': the wall's outer face sits at
// pos and the socket sticks out that way. t is the wall thickness, ceil the doorway's top,
// lo and hi how far along the wall the block may reach.
export function tubeSocket(S,{name,od,id,face,pos,t,uc,ceil,lo,hi,nest,wall},errors,warnings){
  const F=S.floor,D=od+S.fit,zc=Math.max(F+id/2,D/2+1),r=Math.min(id/2+0.5,D/2-0.8),half=D/2+SOCK_WALL;
  if(uc-half<lo-1e-9||uc+half>hi+1e-9)errors.push(`The ${name} socket is wider than the wall it sits on.`);
  if(zc+r>ceil+0.01&&nest)warnings.push(`The ${name} is taller than the chambers, so the doorway into the nest is cut down to the chamber height.`);
  // doorway: steps that stay inside the tube's opening
  const m=8,steps=[];
  for(let i=0;i<m;i++){
    const z0=zc-r+2*r*i/m,z1=z0+2*r/m,half2=Math.sqrt(Math.max(0,r*r-Math.max((z0-zc)**2,(z1-zc)**2)));
    const za=Math.max(z0,F),zb=Math.min(z1,ceil);
    if(half2>=1&&zb-za>0.05)steps.push([uc-half2,za,uc+half2,zb]);
  }
  if(!steps.length)errors.push(`The ${name} doorway has no room. Check the tube sizes and heights.`);
  const s={name,wall,face,od,id,D,zc,uc,half,top:zc+D/2+SOCK_WALL,steps,cuts:[]};
  const ax=face[0],out=face[1]==='+'?1:-1,a=out>0?pos-t:pos,b=out>0?pos:pos+t;
  for(const [u0,z0,u1,z1] of steps)s.cuts.push(ax==='x'?[a,u0,z0,b,u1,z1]:[u0,a,z0,u1,b,z1]);
  // the block, drawn across the wall with the bore and extruded outwards
  const prism=meshInPlace([{outer:rectPts(uc-half,0,uc+half,-s.top),holes:[circlePts(uc,-zc,D)],z0:out>0?pos:pos-SOCK_LEN,z1:out>0?pos+SOCK_LEN:pos}]);
  s.mesh=mapMesh(prism,ax==='x'?p=>[p[2],p[0],p[1]]:p=>[p[0],p[2],p[1]]);
  return s;
}

// one plug per socket, grouped by size
export function plugPrints(sockets,each=1){
  const out=[];
  for(const D of [...new Set(sockets.map(s=>s.D))]){
    const qty=sockets.filter(s=>s.D===D).length*each,flange=D+4;
    out.push({name:`starter plug ${fmt(D)}mm`,qty,solids:[partSolid({poly:circlePts(0,0,flange)},0,PLUG_FLANGE),partSolid({poly:circlePts(0,0,D-0.3)},PLUG_FLANGE,PLUG_FLANGE+SOCK_LEN-1)]});
  }
  return out;
}

export function checkPrinter(prints,M,errors){
  for(const it of prints){
    const b=it.tris?meshBounds(it.tris):solidBounds(it.solids);
    if(!fitsPrinter(b,M))errors.push(`The printed ${it.name} is ${f1(b.w)} x ${f1(b.d)} x ${f1(b.h)}mm, too big for the ${M.printW} x ${M.printD} x ${M.printH}mm print area.`);
  }
}

// The cut lids: the outworld lid with vent slits or holes and a feeding hatch, the nest lid, and
// the red sheet over it. ow and nest give each lid's size, less the clearance. qty is how many
// nests share these files.
export function lidSet(S,ow,nest,qty,errors,warnings,notes){
  const owLid={name:'outworld lid',kind:S.lidOw,w:ow.w,h:ow.h,circles:[],holes:[],qty};
  const nestLid={name:'nest lid',kind:S.lidNest,w:nest.w,h:nest.h,circles:[],holes:[],qty};
  const extra=[],prints=[];
  if(S.redSheet)extra.push({name:'nest red sheet',kind:'acrylic',w:nestLid.w,h:nestLid.h,circles:[],holes:[],qty});
  // three slits along each long side, most of its length, like the bought nests
  let band=0;
  if(S.lidOw==='acrylic'&&S.vents==='slits'){
    const along=owLid.h>=owLid.w,Lg=along?owLid.h:owLid.w,Sh=along?owLid.w:owLid.h,end=Lg*0.1;
    band=SLIT_EDGE+2*SLIT_PITCH+S.slitW;
    if(Sh<2*band+10)errors.push('The outworld lid is too narrow for vent slits. Use holes.');
    for(const e of [0,1])for(let k=0;k<3;k++){
      const a=SLIT_EDGE+k*SLIT_PITCH,c0=e?Sh-a-S.slitW:a;
      owLid.holes.push(along?rectPts(c0,end,c0+S.slitW,Lg-end):rectPts(end,c0,Lg-end,c0+S.slitW));
    }
    if(S.slitW>=1)warnings.push(`The vent slits are ${fmt(S.slitW)}mm wide. Small workers may get through.`);
  }
  // a feeding hatch: a square hole, a printed hatch that drops in, and a small window in its top
  let hatch=null;
  if(S.lidOw==='acrylic'&&S.hatch){
    const hs=S.hatchSize,cx=owLid.w/2,cy=owLid.h/2,short=Math.min(owLid.w,owLid.h);
    if(hs>short-2*band-2)errors.push(`A ${fmt(hs)}mm feeding hatch does not fit between the vent slits. It can be up to ${f1(Math.max(0,short-2*band-2))}mm.`);
    owLid.holes.push(rectPts(cx-hs/2,cy-hs/2,cx+hs/2,cy+hs/2));
    const plug=hs-HATCH_FIT,view=plug-2*HATCH_WALL,flange=hs+2*HATCH_FLANGE,win=view+2*HATCH_LEDGE,tf=S.lidT+HATCH_LEDGE;
    if(view<6)errors.push('The feeding hatch is too small for a window. Make it bigger.');
    // printed plug side down: the plug, then the flange, with the window recess in its top
    const o=v=>-v/2,p2=v=>v/2;
    const tris=meshBoxes([[o(plug),o(plug),0,p2(plug),p2(plug),S.lidT],[o(flange),o(flange),S.lidT,p2(flange),p2(flange),S.lidT+tf]],
      [[o(view),o(view),-1,p2(view),p2(view),S.lidT+tf+1],[o(win),o(win),S.lidT+tf-S.lidT,p2(win),p2(win),S.lidT+tf+1]]);
    hatch={hs,plug,view,flange,win,tris,top:tf};
    extra.push({name:'hatch window',kind:'acrylic',w:win-0.3,h:win-0.3,circles:[],holes:[],qty});
    prints.push({name:'starter feeding hatch',qty,tris});
  }
  if(S.lidOw==='acrylic'&&S.vents==='holes'){
    const m=6,cols=Math.floor((owLid.w-2*m)/S.ventPitch)+1,rows=Math.floor((owLid.h-2*m)/S.ventPitch)+1;
    const ox=(owLid.w-(cols-1)*S.ventPitch)/2,oy=(owLid.h-(rows-1)*S.ventPitch)/2;
    // none under the hatch flange
    const clear=hatch?hatch.flange/2+1:-1,free=(x,y)=>Math.abs(x-owLid.w/2)>clear||Math.abs(y-owLid.h/2)>clear;
    if(cols>0&&rows>0)for(let i=0;i<cols;i++)for(let j=0;j<rows;j++)if(free(ox+i*S.ventPitch,oy+j*S.ventPitch))owLid.circles.push([ox+i*S.ventPitch,oy+j*S.ventPitch,S.ventD]);
    if(S.ventD>2)warnings.push('Vent holes over 2mm let most small workers out.');
  }
  if(S.lidOw==='glass')notes.push('A glass outworld lid has no vents or feeding hatch. Prop it open a little or drill it.');
  if(S.redSheet)notes.push(`Cut the nest lid from clear ${S.lidNest==='glass'?'glass':'acrylic'} and the sheet over it from red acrylic. Lift the red one to look in.`);
  else if(S.lidNest==='acrylic')notes.push('Cut the nest lid from red acrylic, so the colony stays calm when you look in.');
  if(hatch)notes.push('Print the feeding hatch plug side down. Press the small window into the recess in its top.');
  const lids=[owLid,nestLid,...extra].map(l=>({...l,poly:rectPts(0,0,l.w,l.h)}));
  return {lids,hatch,prints};
}
