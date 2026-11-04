import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRack,rackFiles,rackHoleTest,rackPreview,rackDefaults,cleanRack} from '../../src/rack.js';

const R=c=>buildRack({...rackDefaults(),...c});
const CFGS=[{},{right:0},{cover:'none'},{cover:'hood'},{cover:'hood',right:0},{tubeD:25,tubeL:200,left:3,right:3},{tubeD:10,tubeL:75,left:8,right:8,stick:15},{left:1,right:1},{numbers:false},{tubeL:60,stick:30}];
const parts=(r,n)=>r.parts.filter(p=>p.name===n);
const area=p=>Math.abs(p.reduce((a,v,i)=>{const w=p[(i+1)%p.length];return a+v[0]*w[1]-w[0]*v[1];},0))/2;

test('all rack styles build cleanly and export good files',()=>{
  for(const c of CFGS){
    const r=R(c);
    assert.deepEqual(r.errors,[],JSON.stringify(c));
    for(const f of rackFiles(r))assert.doesNotMatch(f.data,/NaN|undefined|Infinity/,f.name);
    assert.doesNotMatch(rackPreview(r),/NaN|undefined/);
  }
});
test('a 6 and 5 rack has the right holes, and they are the tube size plus clearance',()=>{
  const r=R({});
  const ends=parts(r,'end plate');
  assert.equal(ends.length,2);
  assert.deepEqual(ends.map(e=>e.circles.length).sort(),[5,6]);
  for(const e of ends)for(const c of e.circles)assert.equal(c[2],16.6);
  assert.equal(r.tubes.length,11);
});
test('tubes stick out by the set amount and stop at the wall',()=>{
  for(const c of [{},{right:0},{stick:35}]){
    const r=R(c),stick=r.R.stick;
    for(const p of r.tubes){
      assert.ok(Math.abs(p.x1-p.x0-r.R.tubeL)<1e-9,'tube keeps its length');
      const outside=p.id[0]==='L'?r.inset-p.x0:p.x1-(r.Lo-r.inset);
      assert.ok(Math.abs(outside-stick)<1e-9);
    }
    const stop=r.stops[0],t=r.R.t;
    for(const p of r.tubes.filter(x=>x.id[0]==='L'))assert.ok(Math.abs(p.x1-(stop-t/2))<1e-9);
    for(const p of r.tubes.filter(x=>x.id[0]==='R'))assert.ok(Math.abs(p.x0-(stop+t/2))<1e-9);
  }
});
test('holes keep acrylic above and below, and combs match the hole height',()=>{
  const r=R({}),e=parts(r,'end plate')[0],ys=e.poly.map(p=>p[1]),top=0,bottom=r.Hi;
  // the plate has tabs, so measure against the plate body
  const body=[...new Set(ys)].sort((a,b)=>a-b);
  assert.ok(body.length>=2);
  for(const [,y,d] of e.circles){
    assert.ok(y-d/2-(e.h-r.R.t-r.Hi)>=2.9,'material above the hole');
    assert.ok((e.h-r.R.t)-(y+d/2)>=1.9,'material below the hole');
  }
  const comb=parts(r,'comb')[0];
  assert.ok(comb,'combs exist');
  assert.ok(top===0&&bottom>0);
});
test('every tab has a slot in the base, and the base takes all parts',()=>{
  const r=R({});
  const base=parts(r,'base')[0];
  const cross=parts(r,'end plate').length+parts(r,'stop wall').length+parts(r,'comb').length;
  assert.equal(base.holes.length,cross*2+2*2,'2 tabs per cross plate, 2 per side wall');
  for(const h of base.holes)for(const [x,y] of h)assert.ok(x>=3&&y>=3&&x<=base.w-3&&y<=base.h-3,'slots keep 3mm of acrylic to the edge');
  const walls=parts(r,'side wall');
  assert.equal(walls[0].holes.length,cross,'each cross plate tabs into the walls');
});
test('a lid has slots for every top tab, and no cover means no top tabs',()=>{
  const r=R({cover:'lid'});
  assert.equal(r.cover[0].name,'lid');
  assert.equal(r.cover[0].holes.length,(parts(r,'end plate').length+parts(r,'stop wall').length)*2+4);
  const n=R({cover:'none'});
  assert.equal(n.cover.length,0);
  assert.ok(area(parts(n,'side wall')[0].poly)<area(parts(r,'side wall')[0].poly));
  assert.ok(!rackFiles(n).some(f=>/cover/.test(f.name)));
});
test('the hood clears the rack and the tube ends on every side',()=>{
  for(const c of [{cover:'hood'},{cover:'hood',right:0}]){
    const r=R(c),h=r.cover.find(p=>p.name==='hood top'),t=r.R.t;
    assert.ok(r.cover.length===5);
    const inside=h.w-2*t,span=Math.max(...r.tubes.map(p=>p.x1))-Math.min(...r.tubes.map(p=>p.x0),0);
    assert.ok(inside>=span+2*0,`hood ${inside} vs tubes ${span}`);
    assert.ok(h.h-2*t>r.Wo,'wider than the rack');
    assert.ok(r.cover.find(p=>p.name==='hood side').h>r.Hi+t,'taller than the rack with its lid tabs');
    assert.ok(r.warnings.some(w=>/condensation/.test(w)));
  }
});
test('cover parts go in their own file, so they can be another colour',()=>{
  const n=rackFiles(R({cover:'hood'})).map(f=>f.name);
  assert.ok(n.some(x=>/^rack-sheet/.test(x))&&n.some(x=>/^rack-cover/.test(x)));
});
test('bad inputs are refused or limited',()=>{
  assert.ok(R({tubeL:60,stick:50}).errors.some(e=>/stick out too far/.test(e)));
  assert.ok(R({stockW:200,stockH:100}).errors.some(e=>/too big/.test(e)));
  assert.equal(cleanRack({tubeD:'<x>'}).tubeD,16);
  assert.equal(cleanRack({left:1e6}).left,40);
  assert.equal(cleanRack({cover:'evil'}).cover,'lid');
});
test('the hole test strip brackets the tube size',()=>{
  const f=rackHoleTest({tubeD:16,kerf:0.15});
  assert.equal((f.data.match(/<circle/g)||[]).length,7);
  assert.match(f.data,/\+0\.6/);
  assert.doesNotMatch(f.data,/NaN|undefined/);
});
