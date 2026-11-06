import test from 'node:test';
import assert from 'node:assert/strict';
import {run} from './helpers.js';
import {meshSolids,partSolid,ringSolid,stlBinary,circlePts,recorder,shapesToSolids} from '../../src/stl.js';
import {exporters,printPlan} from '../../src/export.js';
import {NEST_MATS,ALL_FIELDS} from '../../src/params.js';
import {buildRack,rackFiles,rackDefaults,RACK_MATS} from '../../src/rack.js';
import {buildOutworld,outworldFiles,OUT_MATS} from '../../src/outworld.js';
import {cleanParam} from '../../src/sanitize.js';
import {rectPts} from '../../src/util.js';
import {chambers,interiorEdges,getEdge} from '../../src/layout.js';
import {buildGeometry} from '../../src/geometry.js';

const all=mats=>Object.fromEntries(mats.map(([k])=>['m_'+k,'print']));
// reads a binary STL back into triangles
function parse(u8){
  const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength),n=dv.getUint32(80,true),tris=[];
  assert.equal(u8.byteLength,84+50*n,'file length matches the triangle count');
  for(let i=0;i<n;i++){const o=84+50*i+12,v=k=>[0,1,2].map(j=>dv.getFloat32(o+12*k+4*j,true));tris.push([v(0),v(1),v(2)]);}
  return tris;
}
// every edge is met by exactly one edge running the other way, and the volume is positive
function closed(tris){
  const key=v=>v.map(x=>x.toFixed(3)).join(','),m=new Map();let vol=0;
  for(const [a,b,c] of tris){
    for(const [p,q] of [[a,b],[b,c],[c,a]]){const e=key(p)+'>'+key(q);m.set(e,(m.get(e)||0)+1);}
    vol+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  }
  for(const [e,n] of m){const [p,q]=e.split('>');if((m.get(q+'>'+p)||0)!==n)return {ok:false,vol};}
  return {ok:true,vol};
}
const stls=files=>files.filter(f=>f.name.endsWith('.stl'));

test('an extruded plate with holes is a closed solid of the right volume',()=>{
  const r=closed(meshSolids([partSolid({poly:rectPts(0,0,20,10),holes:[rectPts(2,2,5,5)]},0,3)]));
  assert.ok(r.ok);assert.ok(Math.abs(r.vol-(200-9)*3)<1e-6);
  // a hole lined up with an edge of another used to leave a crack
  const c=closed(meshSolids([partSolid({poly:rectPts(0,0,20,10),holes:[rectPts(2,2,5,5)],circles:[[12,5,4]]},0,3)]));
  assert.ok(c.ok);
  const ring=closed(meshSolids([ringSolid(rectPts(0,0,10,10),rectPts(2,2,8,8),0,5),partSolid({poly:rectPts(0,0,10,10)},5,6)]));
  assert.ok(ring.ok);assert.ok(Math.abs(ring.vol-(64*5+100))<1e-6);
});
test('the STL file is binary with a triangle count that matches',()=>{
  const tris=meshSolids([partSolid({poly:rectPts(0,0,5,5)},0,1)]);
  assert.equal(parse(stlBinary(tris)).length,tris.length);
});
test('the recorder keeps holes with the outline around them',()=>{
  const r=recorder(),s=shapesToSolids([r.outline(rectPts(0,0,10,10)),r.outline(rectPts(20,0,30,10)),r.hole(25,5,2),r.txt(1,1,'x',2)],0,3);
  assert.equal(s.length,2);assert.equal(s[0].holes.length,0);assert.equal(s[1].holes.length,1);
});
test('a fully printed nest has no cut files, and every print is a closed solid',()=>{
  for(const cfg of [{},{orient:'upright'},{heatTop:true,B:25},{heatChannel:true},{fastener:'bolt'}]){
    const r=run({...cfg,...all(NEST_MATS),printW:2000,printD:2000},1),ex=exporters(r.G,r.L,r.P,r.geo);
    assert.deepEqual(ex.files.filter(f=>f.name.endsWith('.svg')).map(f=>f.name),['assembly-map.svg'],JSON.stringify(cfg));
    for(const f of stls(ex.files))assert.ok(closed(parse(f.data)).ok,`${f.name} ${JSON.stringify(cfg)}`);
  }
});
test('printed frame and plugs are one solid each, not a stack of layers',()=>{
  const r=run({m_frame:'print',m_plug:'print'},1),plan=printPlan(r.G,r.L,r.P,r.geo);
  assert.equal(plan.filter(i=>/^frame section/.test(i.name)).length,r.geo.frame.length);
  const plug=plan.find(i=>i.name==='port plug');
  assert.equal(plug.qty,r.geo.ports.filter(p=>p.cut&&!p.used).length);
  assert.equal(plug.solids[0].z1,r.G.depth);
  const names=exporters(r.G,r.L,r.P,r.geo).files.map(f=>f.name);
  assert.ok(!names.some(n=>/^frame-layer/.test(n)));
  assert.ok(names.includes(`print-port-plug-x${plug.qty}.stl`));
});
test('printing one part type leaves the rest on the cut sheets',()=>{
  const cut=run({},1),pr=run({m_peg:'print'},1);
  const kit=r=>exporters(r.G,r.L,r.P,r.geo);
  assert.ok(kit(pr).files.some(f=>/^print-peg-x\d+\.stl$/.test(f.name)));
  const sheets=r=>kit(r).files.filter(f=>/^parts-sheet/.test(f.name)).map(f=>f.data).join('');
  assert.ok(sheets(pr).length<sheets(cut).length);
  assert.ok(kit(pr).files.some(f=>f.name==='front-sheet.svg'));
});
test('prints too big for the printer, and sheets too big for the laser, are errors',()=>{
  assert.match(run({m_front:'print'},1).errors.join(),/too big for the 220 x 220 x 250mm print area/);
  assert.deepEqual(run({m_peg:'print'},1).errors,[]);
  assert.match(run({bed:'custom',bedW:300,bedH:300},1).errors.join(),/laser cutting area/);
  assert.deepEqual(run({bed:'custom',bedW:900,bedH:600},1).errors,[]);
  // a panel bigger than the laser is fine once every sheet-sized part is printed
  const big={bed:'custom',bedW:300,bedH:300,stockW:290,stockH:290,m_front:'print',m_back:'print',m_frame:'print',m_cover:'print',printW:500,printD:500};
  assert.ok(!run(big,1).errors.some(e=>/panel is too big/.test(e)));
});
test('old settings with no material choices stay acrylic',()=>{
  for(const f of ALL_FIELDS.filter(f=>f.k.startsWith('m_')))assert.equal(cleanParam(f,undefined),'acrylic');
  assert.equal(cleanParam(ALL_FIELDS.find(f=>f.k==='m_peg'),'<script>'),'acrylic');
});
test('rack covers print as one piece each, and leave the cut sheets',()=>{
  const caps=buildRack({...rackDefaults(),cover:'caps',gap:7,m_cap:'print'});
  assert.deepEqual(caps.errors,[]);
  const cap=caps.prints.find(p=>p.name==='cap');
  assert.equal(cap.qty,caps.R.left+caps.R.right);
  assert.ok(!caps.cutCover.some(p=>/^cap/.test(p.name)));
  assert.match(caps.warnings.join(),/no labels/);
  const sh=buildRack({...rackDefaults(),m_sheath:'print'});
  assert.equal(sh.prints.find(p=>p.name==='sheath').qty,2);
  for(const r of [caps,sh,buildRack({...rackDefaults(),cover:'hood',m_hood:'print'},{printW:900,printD:900,printH:300}),buildRack({...rackDefaults(),...all(RACK_MATS)},{printW:900,printD:900,printH:300})])
    for(const f of stls(rackFiles(r)))assert.ok(closed(parse(f.data)).ok,f.name);
  assert.match(buildRack({...rackDefaults(),cover:'hood',m_hood:'print'}).errors.join(),/print area/);
});
test('hood and sheath tops are packed at their real width',()=>{
  const r=buildRack({...rackDefaults(),cover:'sheath'});
  for(const p of r.cover.filter(p=>/ top$/.test(p.name)))assert.equal(p.w,Math.max(...p.poly.map(q=>q[0]))-Math.min(...p.poly.map(q=>q[0])));
});
test('outworld prints: sleeves widen the tube holes, docks get a socket, clips get thicker',()=>{
  const n=run({},1),plain=buildOutworld({},n.P,n.geo),sl=buildOutworld({m_tport:'print',m_tdock:'print'},n.P,n.geo);
  assert.ok(sl.portHoles[0][2]>plain.portHoles[0][2]);
  assert.equal(sl.prints.find(p=>p.name==='tube sleeve').qty,1);
  assert.equal(sl.prints.find(p=>p.name==='tube dock').solids.length,2);
  const up=run({orient:'upright'},1),thin=buildOutworld({connect:'direct'},up.P,up.geo),thick=buildOutworld({connect:'direct',m_clip:'print'},up.P,up.geo);
  assert.equal(thin.clipH,up.P.t);assert.equal(thick.clipH,5);
  assert.equal(thick.prints.find(p=>p.name==='edge clip').solids[0].z1,5);
  const everything=buildOutworld({connect:'direct',...all(OUT_MATS)},up.P,up.geo);
  assert.match(everything.errors.join(),/print area/);
  for(const f of stls(outworldFiles(everything,{cutColor:'#f00',engraveColor:'#000'})))assert.ok(closed(parse(f.data)).ok,f.name);
});
test('a printed vial holder is one piece with its two posts, and no loose posts are cut',()=>{
  const r=run({m_vial:'print'},1),L=JSON.parse(JSON.stringify(r.L));
  const ch=chambers(L),e=interiorEdges(L,ch).find(x=>getEdge(L,x)==='sponge');
  L.vials.push(e.type==='H'?{type:'H',j:e.j,k:e.k}:{type:'V',r:e.r,i:e.i});
  const geo=buildGeometry(r.G,L,r.P),ex=exporters(r.G,L,r.P,geo);
  const holder=ex.prints.find(p=>p.name==='vial holder');
  assert.equal(holder.qty,1);
  assert.equal(holder.solids.length,3);
  assert.equal(holder.solids[0].z1,r.P.vialRings*r.G.t);
  assert.ok(!ex.prints.some(p=>/post|ring/.test(p.name)));
  assert.ok(closed(parse(ex.files.find(f=>f.name==='print-vial-holder.stl').data)).ok);
});
