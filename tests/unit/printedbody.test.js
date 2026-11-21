import test from 'node:test';
import assert from 'node:assert/strict';
import {run,files} from './helpers.js';
import {printedBody} from '../../src/printedbody.js';
import {exporters} from '../../src/export.js';

const PB=(c,seed=1)=>{const r=run({build:'printed',...c},seed);return {r,pb:printedBody(r.G,r.L,r.P,r.geo)};};
function closed(tris){
  const key=v=>v.map(x=>x.toFixed(3)).join(','),m=new Map();let vol=0;
  for(const [a,b,c] of tris){
    for(const [p,q] of [[a,b],[b,c],[c,a]]){const e=key(p)+'>'+key(q);m.set(e,(m.get(e)||0)+1);}
    vol+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  }
  for(const [e,n] of m){const [p,q]=e.split('>');if((m.get(q+'>'+p)||0)!==n)return false;}
  return vol>0;
}
const CFGS=[{},{orient:'upright'},{doorType:'none'},{W:200,H:200},{W:600,H:300},{sponges:0},{orient:'upright',W:300,H:400},{brood:2,loops:0.4}];

test('every printed body builds cleanly, with closed prints and good files',()=>{
  for(const c of CFGS){
    const {r,pb}=PB(c);
    assert.deepEqual(r.errors,[],JSON.stringify(c));
    for(const it of pb.prints)if(it.tris)assert.ok(closed(it.tris),it.name+' '+JSON.stringify(c));
    for(const f of files(r))if(!f.name.endsWith('.stl'))assert.doesNotMatch(f.data,/NaN|undefined|Infinity/,f.name);
  }
});
test('a flat body gives one drop-in top sheet, an upright one a sheet each side and clips',()=>{
  const flat=files(run({build:'printed'})).map(f=>f.name);
  assert.ok(flat.includes('top-sheet.svg'));
  assert.ok(!flat.some(n=>/frame-layer|parts-sheet|back-sheet|front-sheet/.test(n)));
  assert.ok(flat.some(n=>/^print-body/.test(n)));
  const up=files(run({build:'printed',orient:'upright'})).map(f=>f.name);
  assert.ok(up.includes('front-sheet.svg')&&up.includes('back-sheet.svg'));
  assert.ok(up.some(n=>/edge-clip/.test(n))&&up.some(n=>/print-foot-x2/.test(n)));
});
test('door slots and fill holes all land inside the top sheet',()=>{
  const {r,pb}=PB({});
  const m=r.P.B/2+0.2,w=r.P.W-2*m,h=r.P.H-2*m;
  const nums=pb.files.find(f=>f.name==='top-sheet.svg').data.match(/(?:cx|cy)="[-\d.]+"/g).map(s=>+s.split('"')[1]);
  for(let i=0;i<nums.length;i+=2){assert.ok(nums[i]>0&&nums[i]<w);assert.ok(nums[i+1]>0&&nums[i+1]<h);}
  for(const s of r.geo.doorSlots)assert.ok(s.x0>m&&s.x1<r.P.W-m&&s.y0>m&&s.y1<r.P.H-m);
});
test('without doors there is no door sheet, and the notch can be left out',()=>{
  assert.ok(!files(run({build:'printed',doorType:'none'})).some(f=>f.name==='doors-sheet.svg'));
  assert.ok(files(run({build:'printed'})).some(f=>f.name==='doors-sheet.svg'));
  const a=PB({}).pb.prints.filter(p=>p.tris&&/body/.test(p.name)).reduce((s,p)=>s+p.tris.length,0);
  const b=PB({liftNotch:false}).pb.prints.filter(p=>p.tris&&/body/.test(p.name)).reduce((s,p)=>s+p.tris.length,0);
  assert.notEqual(a,b);
});
test('a big body is split into tiles at wall lines, each small enough to print',()=>{
  const {r,pb}=PB({W:600,H:300});
  assert.ok(pb.tiles.n>1);
  const lines=[0,...r.G.xs,r.P.W];
  for(const x of pb.tiles.cx)assert.ok(lines.some(v=>Math.abs(v-x)<1e-9));
  assert.ok(r.rules.msgs.some(m=>/split into/.test(m[1])));
  const one=PB({W:200,H:200}).pb;
  assert.equal(one.prints.filter(p=>/body/.test(p.name)).length,1);
  const huge=run({build:'printed',W:400,H:400,printW:40,printD:40});
  assert.ok(huge.errors.some(e=>/too big to split/.test(e)));
});
test('plugs and adaptors match the ports',()=>{
  const {r,pb}=PB({});
  const cut=r.geo.ports.filter(p=>p.cut).length;
  assert.equal(pb.prints.find(p=>p.name==='port plug').qty,cut);
  assert.equal(pb.prints.find(p=>p.name==='port tube adaptor').qty,1);
});
test('features a printed body cannot have yet are refused',()=>{
  assert.ok(run({build:'printed',heatTop:true,B:25}).errors.some(e=>/heat/.test(e)));
  assert.ok(run({build:'printed',broodPillar:true}).errors.some(e=>/pillars/.test(e)));
  assert.ok(run({build:'printed',angled:true,diagShare:0.5}).errors.some(e=>/angled/.test(e)));
});
test('the all acrylic build is unchanged by the new settings',()=>{
  const a=exporters(...['G','L','P','geo'].map(k=>run({})[k])).files.map(f=>f.name);
  assert.ok(a.includes('front-sheet.svg')&&a.some(n=>/frame-layer/.test(n)));
});
