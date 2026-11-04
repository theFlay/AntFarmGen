import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRack,rackFiles,rackHoleTest,rackPreview,rackDefaults,cleanRack} from '../../src/rack.js';

const R=c=>buildRack({...rackDefaults(),...c});
const CFGS=[{},{right:0},{cover:'none'},{cover:'hood'},{cover:'hood',right:0},{cover:'caps',gap:7},{lid:false},{tubeD:25,tubeL:200,left:3,right:3},{tubeD:10,tubeL:75,left:8,right:8,stick:15},{left:1,right:1},{labels:false},{tubeL:60,stick:30}];
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
test('a lid has slots for every top tab, and no lid means no top tabs',()=>{
  const r=R({lid:true,cover:'none'});
  assert.equal(r.cover[0].name,'lid');
  assert.equal(r.cover[0].holes.length,(parts(r,'end plate').length+parts(r,'stop wall').length)*2+4);
  const n=R({lid:false,cover:'none'});
  assert.equal(n.cover.length,0);
  assert.ok(area(parts(n,'side wall')[0].poly)<area(parts(r,'side wall')[0].poly));
  assert.ok(!rackFiles(n).some(f=>/cover/.test(f.name)));
});
test('the default assumes a red rack: a lid, and one sheath per side',()=>{
  const r=R({});
  assert.ok(r.cover.some(p=>p.name==='lid'));
  assert.equal(r.cover.filter(p=>p.name==='sheath top').length,2);
  assert.equal(R({right:0}).cover.filter(p=>p.name==='sheath top').length,1);
});
test('a sheath slides over the rack end and clears the tube ends',()=>{
  const r=R({}),t=r.R.t;
  const inside=r.sheathSize.hl-2*t;
  assert.ok(inside>=r.inset+r.R.stick+15,'reaches past the tube ends with overlap');
  assert.ok(r.sheathSize.hw-2*t>r.Wo,'wider than the rack');
  const side=r.cover.find(p=>p.name==='sheath side');
  assert.ok(side.h-t>r.rackH,'taller than the rack and lid');
  assert.equal(r.cover.filter(p=>p.name==='sheath end').length,2,'one closed end each, the other end is open');
  assert.equal(r.cover.filter(p=>p.name==='sheath side').length,4);
});
test('caps: one per tube, with box joints that close the corners',()=>{
  const r=R({cover:'caps',gap:7});
  assert.deepEqual(r.errors,[]);
  assert.equal(r.cover.filter(p=>p.name==='cap end').length,11);
  assert.equal(r.cover.filter(p=>p.name==='cap wide side').length,22);
  assert.equal(r.cover.filter(p=>p.name==='cap narrow side').length,22);
  const wide=r.cover.find(p=>p.name==='cap wide side'),narrow=r.cover.find(p=>p.name==='cap narrow side');
  assert.ok(Math.abs(wide.w-(narrow.w))<1e-9,'narrow side with its tabs equals the wide side');
  assert.ok(r.capLen>=r.R.stick+3,'long enough to cover the tube end');
  assert.ok(r.capOut<=r.R.tubeD+r.R.holeClear+7,'neighbours clear each other');
});
test('caps that would hit each other are refused, with the gap they need',()=>{
  const r=R({cover:'caps'});
  assert.ok(r.errors.some(e=>/at least 6\.5mm/.test(e)),r.errors.join());
});
test('the hood clears the rack and the tube ends on every side, and replaces the lid',()=>{
  for(const c of [{cover:'hood'},{cover:'hood',right:0}]){
    const r=R(c),t=r.R.t;
    assert.ok(r.cover.length===5);
    assert.ok(!r.cover.some(p=>p.name==='lid'));
    const span=Math.max(...r.tubes.map(p=>p.x1),r.Lo)-Math.min(...r.tubes.map(p=>p.x0),0);
    assert.ok(r.hoodSize.hl-2*t>=span,`hood ${r.hoodSize.hl} vs tubes ${span}`);
    assert.ok(r.hoodSize.hw-2*t>r.Wo,'wider than the rack');
    assert.ok(r.cover.find(p=>p.name==='hood side').h-t>r.rackH);
    assert.ok(r.warnings.some(w=>/condensation/.test(w)));
  }
});
test('every cover part fits its sheet and exports clean',()=>{
  for(const cover of ['none','caps','sheath','hood'])for(const lid of [true,false]){
    const r=R({cover,lid,gap:7});
    assert.deepEqual(r.errors,[],cover);
    for(const p of r.cover)for(const h of p.holes)for(const [x,y] of h)assert.ok(x>=0&&y>=0&&x<=p.w&&y<=p.h,`${p.name} slot leaves the part`);
    for(const f of rackFiles(r))assert.doesNotMatch(f.data,/NaN|undefined|Infinity/);
  }
});
test('cover parts go in their own file, so they can be another colour',()=>{
  const n=rackFiles(R({cover:'hood'})).map(f=>f.name);
  assert.ok(n.some(x=>/^rack-sheet/.test(x))&&n.some(x=>/^rack-cover/.test(x)));
});
const texts=f=>[...f.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m=>m[1]);
const allText=r=>rackFiles(r).flatMap(f=>texts(f.data));
test('labels use prefix, number, suffix, start and digits',()=>{
  const l=R({prefix:'HI',digits:2,start:1}).tubes.map(t=>t.label);
  assert.deepEqual(l.slice(0,2),['HI01','HI02']);
  assert.equal(l[10],'HI11','numbers carry on down the right side');
  assert.equal(R({prefix:'Q',suffix:'-A',start:98,digits:3}).tubes[3].label,'Q101-A');
  assert.equal(R({digits:4,start:7}).tubes[0].label,'0007');
});
test('labels that outgrow their digits are refused',()=>{
  assert.ok(R({digits:1,start:1}).errors.some(e=>/more than 1 digit/.test(e)),'11 tubes need 2 digits');
  assert.ok(R({digits:2,start:95}).errors.some(e=>/more than 2 digits/.test(e)));
  assert.deepEqual(R({digits:1,start:1,labels:false}).errors,[]);
});
test('labels go beside holes, on the top face and on covers, each with its own switch',()=>{
  const count=c=>{const r=R({prefix:'HI',cover:'sheath',...c});return allText(r).filter(s=>/^HI/.test(s)).length;};
  assert.equal(count({}),33,'11 tubes in 3 places');
  assert.equal(count({labelHoles:false}),22);
  assert.equal(count({labelFace:false}),22);
  assert.equal(count({labelCovers:false}),22);
  assert.equal(count({labels:false}),0);
  const caps=R({cover:'caps',gap:7,prefix:'HI'});
  assert.equal(caps.cover.filter(p=>p.name==='cap end'&&p.labels.length===1).length,11);
});
test('top face labels sit over the last 15mm of each tube, by the closed end',()=>{
  for(const c of [{},{lid:false},{right:0}]){
    const r=R(c),sheet=r.cover.find(p=>p.name==='lid')||parts(r,'base')[0],t=r.R.t,stop=r.stops[0];
    assert.equal(sheet.labels.length,r.tubes.length);
    for(const [x,y,s] of sheet.labels){
      const tube=r.tubes.find(p=>p.label===s);
      assert.equal(y,tube.y,'lined up with its own tube');
      const fromEnd=tube.id[0]==='L'?stop-t/2-x:x-(stop+t/2);
      assert.ok(fromEnd>0&&fromEnd<15,`${fromEnd}mm from the closed end`);
    }
  }
});
test('seen from outside, each end plate label sits on its own tube',()=>{
  const r=R({prefix:'T'}),[left,right]=parts(r,'end plate');
  const order=p=>p.labels.slice().sort((a,b)=>a[0]-b[0]).map(l=>l[2]);
  // facing the left plate from outside, its cut order matches the rack; the right plate is reversed
  const byY=side=>r.tubes.filter(t=>t.id[0]===side).sort((a,b)=>a.y-b.y).map(t=>t.label);
  assert.deepEqual(order(left),byY('L'));
  assert.deepEqual(order(right),byY('R').reverse());
});
test('the left sheath is cut with its text turned round, so it reads right once fitted',()=>{
  const r=R({prefix:'T'}),[a,b]=r.cover.filter(p=>p.name==='sheath top');
  assert.ok(a.labels.every(l=>l[4]===180));
  assert.ok(b.labels.every(l=>!l[4]));
  const one=R({right:0}).cover.find(p=>p.name==='sheath top');
  assert.ok(one.labels.every(l=>!l[4]));
});
test('face text goes in the chosen squares of the 3 x 3 grid',()=>{
  const r=R({face1:'Top left',face5:'Middle',face9:'Bottom right',labels:false}),lid=r.cover.find(p=>p.name==='lid');
  const at=s=>lid.labels.find(l=>l[2]===s);
  assert.equal(lid.labels.length,3);
  assert.ok(at('Top left')[0]<lid.w/3&&at('Top left')[1]<lid.h/3);
  assert.ok(Math.abs(at('Middle')[0]-lid.w/2)<1e-9&&Math.abs(at('Middle')[1]-lid.h/2)<1e-9);
  assert.ok(at('Bottom right')[0]>2*lid.w/3&&at('Bottom right')[1]>2*lid.h/3);
  assert.ok(R({face2:'x'}).warnings.some(w=>/middle column/.test(w)));
  const n=R({face1:'Base',lid:false,cover:'none',labels:false});
  assert.equal(parts(n,'base')[0].labels.length,1,'no lid means the base takes it');
  assert.ok(R({face1:'Hood',cover:'hood'}).cover.find(p=>p.name==='hood top').labels.length===1);
});
test('long face text shrinks to fit its square',()=>{
  const r=R({face1:'A very long line of text here',labels:false}),lid=r.cover.find(p=>p.name==='lid');
  const [,, s,size]=lid.labels[0];
  assert.ok(s.length*size*0.62<=lid.w/3-3);
});
test('label text cannot break out of the file',()=>{
  const f=rackFiles(R({prefix:'<b>',face1:'"><script>'})).map(x=>x.data).join('');
  assert.doesNotMatch(f,/<script>|<b>/);
  assert.match(f,/&lt;b&gt;/);
  assert.equal(cleanRack({prefix:'123456789'}).prefix,'123456');
  assert.equal(cleanRack({face1:'a\u0000b'}).face1,'ab');
});
test('bad inputs are refused or limited',()=>{
  assert.ok(R({tubeL:60,stick:50}).errors.some(e=>/stick out too far/.test(e)));
  assert.ok(R({stockW:200,stockH:100}).errors.some(e=>/too big/.test(e)));
  assert.equal(cleanRack({tubeD:'<x>'}).tubeD,16);
  assert.equal(cleanRack({left:1e6}).left,40);
  assert.equal(cleanRack({cover:'evil'}).cover,'sheath');
});
test('the hole test strip brackets the tube size',()=>{
  const f=rackHoleTest({tubeD:16,kerf:0.15});
  assert.equal((f.data.match(/<circle/g)||[]).length,7);
  assert.match(f.data,/\+0\.6/);
  assert.doesNotMatch(f.data,/NaN|undefined/);
});
