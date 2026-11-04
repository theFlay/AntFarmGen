import test from 'node:test';
import assert from 'node:assert/strict';
import {run,files} from './helpers.js';
import {doorType} from '../../src/doors.js';
import {stripOutline} from '../../src/strip.js';
import {testPiece} from '../../src/export.js';
import {hardwareParts} from '../../src/hardware.js';

const countTunnels=g=>g.pieces.reduce((a,p)=>a+p.notches.length,0);

test('every tunnel gets exactly one door and door slot',()=>{
  for(const cfg of [{},{orient:'upright'},{W:300,H:500}])for(let seed=1;seed<=20;seed++){
    const {geo}=run(cfg,seed);
    assert.equal(geo.doors.length,countTunnels(geo));
    assert.equal(geo.doorSlots.length,geo.doors.length);
  }
});
test('door slots go in the service sheet only',()=>{
  const count=(r,n)=>(files(r).find(f=>f.name===n).data.match(/<path/g)||[]).length;
  const a=run({orient:'flat'},3),b=run({orient:'flat',doorType:'none'},3);
  assert.equal(count(a,'front-sheet.svg')-count(b,'front-sheet.svg'),a.geo.doors.length);
  assert.equal(count(a,'back-sheet.svg'),count(b,'back-sheet.svg'));
  const c=run({orient:'upright'},3),d=run({orient:'upright',doorType:'none'},3);
  assert.equal(count(c,'back-sheet.svg')-count(d,'back-sheet.svg'),c.geo.doors.length);
});
test('notches open toward the service side and leave a sill',()=>{
  for(const [orient,edge] of [['flat',0],['upright',12]]){
    const r=run({orient},2);
    const pc=r.geo.pieces.find(p=>p.notches.length);
    const pts=stripOutline(pc,r.G,r.P);
    const u=pc.notches[0]-pc.s,ys=pts.filter(p=>Math.abs(p[0]-(u-3.5))<1e-6).map(p=>p[1]);
    assert.ok(ys.includes(edge),`${orient} notch reaches its edge`);
    assert.ok(ys.includes(orient==='flat'?9:3),`${orient} notch stops at the sill`);
  }
});
test('a closed door has no opening below the sheet, and fills the notch within the fit',()=>{
  const r=run();
  const [door]=doorType(r.P).parts(r.G,r.P,1);
  const head=Math.max(3,r.P.doorGrip);
  for(const h of door.holes)for(const [,y] of h)assert.ok(y<=head+1e-9,'hole must stay in the head');
  const xs=door.poly.filter(p=>p[1]>head+1).map(p=>p[0]);
  const body=Math.max(...xs)-Math.min(...xs);
  assert.ok(Math.abs(r.G.tunnelW-body-2*r.P.doorFit)<1e-9);
  assert.ok(Math.abs(door.h-head-(r.G.tunnelH+r.P.S))<1e-9,'head rests on the sheet when the door reaches the sill');
});
test('saddle ledge holds the door bottom flush with the inside of the sheet',()=>{
  const r=run();
  const z=doorType(r.P).sizes(r.G,r.P);
  const [,saddle]=doorType(r.P).parts(r.G,r.P,1);
  const ledge=saddle.poly.filter(p=>p[1]>z.bar+1&&p[1]<saddle.h-1e-9)[0][1];
  assert.ok(Math.abs((saddle.h-ledge)-r.G.tunnelH)<1e-9);
});
test('changing the starting area never changes the cut sheets for one layout',()=>{
  const a=run({activeCount:8},5),L2=JSON.parse(JSON.stringify(a.L));
  for(const row of L2.active)row.fill(true);
  const f1=files(a).find(f=>f.name==='front-sheet.svg').data;
  assert.ok(a.geo.vents.length===a.geo.ch.list.length*9,'vents over every chamber');
  assert.ok(f1.length>0);
});
test('small starts always hold a port, a sponge and every chance of a brood chamber',()=>{
  for(const cfg of [{activeCount:7,brood:1},{activeCount:8,brood:2},{activeCount:9,brood:2},{activeCount:7,brood:1,W:300,H:500},{activeCount:3,brood:1}]){
    for(let seed=1;seed<=200;seed++){
      const r=run(cfg,seed);
      assert.deepEqual(r.errors,[],JSON.stringify(cfg)+' seed '+seed);
      assert.ok(r.geo.ch.list.some(c=>c.merged&&c.active));
      assert.ok(r.geo.ports.some(p=>p.cut&&p.active));
    }
  }
});
test('peg, bolt and cement modes cut the right fastener holes',()=>{
  const sheet=c=>files(run(c,1)).find(f=>f.name==='front-sheet.svg').data;
  const circles=s=>(s.match(/<circle/g)||[]).length;
  const n=run({},1).geo.fasteners.length;
  assert.ok(n>=8);
  assert.equal(circles(sheet({fastener:'bolt'}))-circles(sheet({fastener:'peg'})),n);
  assert.equal(run({fastener:'cement'},1).geo.fasteners.length,0);
});
test('fasteners and cover sockets avoid ports and each other',()=>{
  for(const cfg of [{},{W:300,H:500},{W:200,H:500}])for(let seed=1;seed<=10;seed++){
    const {geo,G,P}=run(cfg,seed);
    assert.ok(geo.sockets.length>=4);
    const rects=[...geo.fasteners.map(f=>[f,P.pegW]),...geo.sockets.map(s=>[s,geo.socketL])];
    for(let a=0;a<rects.length;a++)for(let b=a+1;b<rects.length;b++){
      const [p,pl]=rects[a],[q,ql]=rects[b];
      const dx=Math.abs(p.x-q.x)-((p.along==='x'?pl:G.t)+(q.along==='x'?ql:G.t))/2;
      const dy=Math.abs(p.y-q.y)-((p.along==='y'?pl:G.t)+(q.along==='y'?ql:G.t))/2;
      assert.ok(Math.max(dx,dy)>=1,`seed ${seed}: border cuts too close`);
    }
  }
});
test('joiner slots sit on a fixed grid, clear of everything else in the border',()=>{
  const sig=r=>r.geo.joints.map(j=>j.side+j.pos).join();
  const a=run({},1),b=run({},9),c=run({queenWidth:8,oddShare:0.5},3);
  assert.ok(a.geo.joints.length>=8);
  assert.equal(sig(a),sig(b));assert.equal(sig(a),sig(c));
  for(const cfg of [{},{W:300,H:500},{fastener:'bolt'}])for(let seed=1;seed<=10;seed++){
    const {geo,G,P}=run(cfg,seed);
    const rect=(o,l)=>o.along==='x'?{x0:o.x-l/2,x1:o.x+l/2,y0:o.y-G.t/2,y1:o.y+G.t/2}:{x0:o.x-G.t/2,x1:o.x+G.t/2,y0:o.y-l/2,y1:o.y+l/2};
    const others=[...geo.fasteners.map(f=>rect(f,P.pegW)),...geo.sockets.map(s=>rect(s,geo.socketL))];
    for(const j of geo.joints){
      const p=rect(j,8);
      for(const q of others)assert.ok(Math.max(p.x0-q.x1,q.x0-p.x1,p.y0-q.y1,q.y0-p.y1)>=1,`seed ${seed}`);
      for(const port of geo.ports.filter(x=>x.cut&&x.side===j.side))assert.ok(Math.abs(port.pos-j.pos)>=G.tunnelW/2+2);
    }
  }
});
test('a joiner spans two panels exactly, and uses 2 keys',()=>{
  const r=run({joinerQty:3},1);
  const kit=hardwareParts(r.G,r.L,r.P,r.geo);
  const j=kit.find(p=>p.name==='panel joiner');
  assert.equal(j.qty,3);
  assert.equal(j.w-8,r.P.B,'leg centres sit one border apart from the seam on each side');
  assert.equal(kit.find(p=>p.name==='key').qty,r.geo.fasteners.length+6);
  assert.equal(run({},1).geo.joints.length>0,true);
  assert.ok(!hardwareParts(...(x=>[x.G,x.L,x.P,x.geo])(run({},1))).some(p=>p.name==='panel joiner'));
});
test('frosted floors add an engrave-only file',()=>{
  const f=files(run({floorFinish:'frosted'},1)).find(x=>x.name==='floor-frost-layer.svg');
  assert.ok(f);assert.match(f.data,/fill="#000000"/);assert.doesNotMatch(f.data,/stroke="#ff0000"/);
  assert.ok(!files(run({},1)).some(x=>/frost/.test(x.name)));
});
test('upright nests get a saddle for every door, like flat nests',()=>{
  for(const orient of ['flat','upright']){
    const r=run({orient},2);
    const saddle=hardwareParts(r.G,r.L,r.P,r.geo).find(p=>p.name==='saddle');
    assert.equal(saddle.qty,r.geo.doors.length);
  }
});
test('upright nests get sand lips on floor tunnels only, and feet',()=>{
  const r=run({orient:'upright'},4);
  const lips=r.geo.pieces.filter(p=>p.kind==='lip');
  assert.equal(lips.length,2*r.geo.doors.filter(d=>d.orient==='H').length);
  assert.deepEqual(r.errors,[]);
  assert.ok(hardwareParts(r.G,r.L,r.P,r.geo).some(p=>p.name==='foot'));
  assert.equal(run({},4).geo.pieces.filter(p=>p.kind==='lip').length,0);
});
test('upright bulk passes rules with no bad values',()=>{
  for(const cfg of [{orient:'upright'},{orient:'upright',W:300,H:500,activeCount:8},{orient:'upright',fastener:'bolt'},{orient:'flat',doorType:'none'},{coverType:'none',fastener:'cement'}])
    for(let seed=1;seed<=30;seed++){
      const r=run(cfg,seed);
      assert.deepEqual(r.errors,[],JSON.stringify(cfg)+' seed '+seed);
      for(const f of files(r))assert.doesNotMatch(f.data,/NaN|undefined|Infinity/,f.name);
    }
});
test('door, saddle and sheet cuts keep at least 1mm of acrylic between them',()=>{
  for(const cfg of [{},{orient:'upright'},{queenWidth:8}])for(let seed=1;seed<=20;seed++)
    assert.ok(run(cfg,seed).geo.minWeb>=1,`seed ${seed}`);
});
test('all parts land on the stock sheets',()=>{
  for(const cfg of [{},{orient:'upright',W:300,H:500}]){
    const r=run(cfg,1);
    for(const f of files(r).filter(f=>/parts-sheet/.test(f.name)))
      for(const m of f.data.matchAll(/d="M([^"]+)"/g))for(const q of m[1].matchAll(/(-?[\d.]+) (-?[\d.]+)/g)){
        assert.ok(+q[1]>0&&+q[1]<r.P.stockW&&+q[2]>0&&+q[2]<r.P.stockH,`${f.name}: ${q[0]}`);
      }
  }
});
test('test piece door slots really change the side gap, and no line is cut twice',()=>{
  const r=run();
  const data=testPiece(r.G,r.P).data;
  const ds=[...data.matchAll(/<path d="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ds).size,ds.length,'duplicate path');
  const k2=r.P.kerf/2,body=r.G.tunnelW-2*r.P.doorFit;
  for(const f of [0.05,0.25]){
    const want=(body+2*f-2*k2).toFixed(3);
    assert.ok(ds.some(d=>{const n=[...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(q=>+q[1]);return (Math.max(...n)-Math.min(...n)).toFixed(3)===want;}),`no slot for fit ${f}`);
  }
});
test('test piece exports cleanly and fits its sheet',()=>{
  const r=run();
  const f=testPiece(r.G,r.P);
  assert.doesNotMatch(f.data,/NaN|undefined|Infinity/);
  for(const m of f.data.matchAll(/d="M([^"]+)"/g))for(const q of m[1].matchAll(/(-?[\d.]+) (-?[\d.]+)/g))
    assert.ok(+q[1]>-1&&+q[1]<171&&+q[2]>-1&&+q[2]<121,q[0]);
});
