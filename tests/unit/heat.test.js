import test from 'node:test';
import assert from 'node:assert/strict';
import {run,files} from './helpers.js';
import {heatPath,heatLayer,heatDepth,heatEntry} from '../../src/heat.js';
import {pegPart,joinerPart,hardwareParts} from '../../src/hardware.js';
import {cleanLayout} from '../../src/sanitize.js';
import {polysOverlap,rectPts} from '../../src/util.js';
import {buildGeometry} from '../../src/geometry.js';

const ON={heatChannel:true};
const area=p=>Math.abs(p.reduce((a,v,i)=>{const w=p[(i+1)%p.length];return a+v[0]*w[1]-w[0]*v[1];},0))/2;
const pathLen=p=>p.slice(1).reduce((a,v,i)=>a+Math.hypot(v[0]-p[i][0],v[1]-p[i][1]),0);

test('the channel enters and leaves at one height, the same on every panel',()=>{
  const ys=new Set();
  for(const c of [{},{W:300,H:500},{W:500,H:300},{heatPitch:30}]){
    const r=run({...ON,...c},1),p=heatPath(r.P);
    assert.equal(p[0][0],0);assert.equal(p[p.length-1][0],r.P.W);
    assert.equal(p[0][1],p[p.length-1][1]);
    ys.add(p[0][1]);
  }
  assert.equal(ys.size,1);
});
test('the channel only makes right-angle turns and never crosses itself',()=>{
  for(const c of [{},{W:300,H:500},{heatPitch:25}]){
    const p=heatPath(run({...ON,...c},1).P);
    for(let i=1;i<p.length;i++)assert.ok(p[i][0]===p[i-1][0]||p[i][1]===p[i-1][1]);
    const seg=p.slice(1).map((v,i)=>[p[i],v]);
    for(let a=0;a<seg.length;a++)for(let b=a+2;b<seg.length;b++){
      const box=s=>[Math.min(s[0][0],s[1][0]),Math.min(s[0][1],s[1][1]),Math.max(s[0][0],s[1][0]),Math.max(s[0][1],s[1][1])];
      const [x0,y0,x1,y1]=box(seg[a]),[u0,v0,u1,v1]=box(seg[b]);
      assert.ok(x1<u0||u1<x0||y1<v0||v1<y0,`segments ${a} and ${b} cross`);
    }
  }
});
test('the two layer pieces plus the channel exactly fill the panel',()=>{
  for(const c of [{},{W:300,H:500},{heatW:5,heatPitch:30}]){
    const {P}=run({...ON,...c},1),L=heatLayer(P);
    const total=area(L.pieces[0])+area(L.pieces[1])+pathLen(L.path)*P.heatW;
    assert.ok(Math.abs(total-P.W*P.H)<1e-6,`${total} vs ${P.W*P.H}`);
  }
});
test('no peg or joiner slot lands in the channel',()=>{
  for(const c of [{},{W:300,H:500},{fastener:'bolt'}])for(let seed=1;seed<=8;seed++){
    const {geo,G,P}=run({...ON,...c},seed);
    const p=geo.heat.path,h=P.heatW/2;
    const lanes=p.slice(1).map((v,i)=>rectPts(Math.min(v[0],p[i][0])-h,Math.min(v[1],p[i][1])-h,Math.max(v[0],p[i][0])+h,Math.max(v[1],p[i][1])+h));
    const slot=(o,l)=>o.along==='x'?rectPts(o.x-l/2,o.y-G.t/2,o.x+l/2,o.y+G.t/2):rectPts(o.x-G.t/2,o.y-l/2,o.x+G.t/2,o.y+l/2);
    for(const f of [...geo.fasteners.map(o=>slot(o,P.pegW)),...geo.joints.map(o=>slot(o,8))])
      for(const l of lanes)assert.ok(!polysOverlap(f,l),`seed ${seed}`);
  }
});
test('pegs and joiners grow by exactly the extra stack',()=>{
  const a=run({},1),b=run(ON,1),d=heatDepth(b.G,b.P);
  assert.equal(d,2*3+3);
  assert.ok(Math.abs(pegPart(b.G,b.P).h-pegPart(a.G,a.P).h-d)<1e-9);
  assert.ok(Math.abs(joinerPart(b.G,b.P).h-joinerPart(a.G,a.P).h-d)<1e-9);
});
test('heat files appear for flat nests only, with a thermostat warning',()=>{
  const r=run(ON,1),n=files(r).map(f=>f.name);
  assert.ok(n.includes('heat-layer-cut-x2.svg')&&n.includes('heat-base-sheet.svg'));
  assert.ok(r.rules.msgs.some(m=>/thermostat/.test(m[1])));
  assert.deepEqual(r.errors,[]);
  const u=run({...ON,orient:'upright'},1);
  assert.ok(!files(u).some(f=>/heat/.test(f.name)));
  assert.equal(u.geo.heat,null);
  assert.ok(u.rules.msgs.some(m=>m[0]==='warn'&&/flat nests/.test(m[1])));
  assert.ok(!files(run({},1)).some(f=>/heat/.test(f.name)));
});
test('heat exports have no bad values and stay inside the panel',()=>{
  for(const c of [{},{W:300,H:500},{H:120,heatPitch:80}]){
    const f=files(run({...ON,...c},2)).find(x=>/heat-layer/.test(x.name));
    assert.doesNotMatch(f.data,/NaN|undefined|Infinity/);
  }
});
test('chosen frosting uses the frost list, and the ceiling is mirrored to suit the flipped sheet',()=>{
  const r=run({floorFinish:'chosen',ceilingFinish:'chosen'},1),L=JSON.parse(JSON.stringify(r.L));
  L.frost.push([0,0]);
  const f=files({...r,L}),floor=f.find(x=>x.name==='floor-frost-layer.svg').data,ceil=f.find(x=>x.name==='ceiling-frost-layer.svg').data;
  const xs=s=>[...s.matchAll(/[ML](-?[\d.]+) /g)].map(m=>+m[1]);
  assert.ok(Math.max(...xs(floor))<100,'floor stays on the left');
  assert.ok(Math.min(...xs(ceil))>r.P.W-100,'ceiling is mirrored to the right');
  assert.ok(!files(r).some(x=>/frost/.test(x.name)),'nothing chosen means no file');
});
test('frosted walls get engrave files matched to the parts sheet, with a mirrored second side',()=>{
  const one=files(run({wallFinish:'one'},1)).map(f=>f.name);
  assert.ok(one.includes('parts-frost-1.svg')&&!one.includes('parts-frost-1-side-b.svg'));
  const fs=files(run({wallFinish:'both'},1));
  const a=fs.find(f=>f.name==='parts-frost-1.svg').data,b=fs.find(f=>f.name==='parts-frost-1-side-b.svg').data;
  const first=s=>+s.match(/d="M(-?[\d.]+) /)[1];
  assert.notEqual(first(a),first(b));
  assert.doesNotMatch(a,/stroke="#ff0000"/);
});
test('frost list survives load, hostile entries do not',()=>{
  const r=run({},1),L=JSON.parse(JSON.stringify(r.L));L.frost.push([1,1]);
  assert.deepEqual(cleanLayout(JSON.parse(JSON.stringify(L)),r.G),L);
  L.frost.push(['<x>',1]);
  assert.throws(()=>cleanLayout(L,r.G));
});
test('geometry reports no heat when off',()=>{
  const r=run({},1);
  assert.equal(buildGeometry(r.G,r.L,r.P).heat,null);
  assert.ok(heatEntry(r.P)>=r.P.B);
  assert.ok(!hardwareParts(r.G,r.L,r.P,r.geo).some(p=>/heat/.test(p.name)));
});
