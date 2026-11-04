import test from 'node:test';
import assert from 'node:assert/strict';
import {run,files} from './helpers.js';
import {offsetPoly} from '../../src/offset.js';
import {polysOverlap} from '../../src/util.js';
import {unitCenter,chamberCenter} from '../../src/layout.js';
import {stripOutline} from '../../src/strip.js';

const ON={angled:true};
const CFGS=[{...ON},{...ON,diagShare:0.4,jogShare:0},{...ON,diagShare:0,jogShare:0.6},{...ON,oddShare:0.4},
  {...ON,orient:'upright',W:300,H:500},{...ON,activeCount:8},{...ON,diagShare:0.3,jogShare:0.5,brood:2,oddShare:0.3}];

test('angled layouts pass every rule, with clean exports',()=>{
  for(const cfg of CFGS)for(let seed=1;seed<=50;seed++){
    const r=run(cfg,seed);
    assert.deepEqual(r.errors,[],JSON.stringify(cfg)+' seed '+seed);
    for(const f of files(r))assert.doesNotMatch(f.data,/NaN|undefined|Infinity/,f.name);
  }
});
test('angled shapes really appear, and the toggle off removes them all',()=>{
  let diag=0,jog=0;
  for(let seed=1;seed<=20;seed++){
    const r=run(ON,seed);
    diag+=r.L.diag.flat().filter(Boolean).length;
    jog+=[...r.L.jogH.flat(),...r.L.jogV.flat()].filter(Boolean).length;
  }
  assert.ok(diag>40,`${diag} diagonals`);assert.ok(jog>60,`${jog} jogs`);
  for(let seed=1;seed<=20;seed++){
    const r=run({},seed);
    assert.equal(r.geo.pieces.filter(p=>p.kind==='angle').length,0);
    assert.ok(!r.rules.msgs.some(m=>/cement/.test(m[1])));
  }
});
test('the app says angled joints need cement',()=>{
  const r=run(ON,3);
  assert.ok(r.geo.pieces.some(p=>p.kind==='angle'));
  assert.ok(r.rules.msgs.some(m=>/acrylic cement/.test(m[1])));
});
test('no chamber is a lone triangle, and the halves of a cell are separate chambers',()=>{
  for(let seed=1;seed<=60;seed++){
    const {geo,L}=run({...ON,diagShare:0.5},seed);
    for(const c of geo.ch.list)if(c.cells.some(u=>u[2]))assert.ok(c.cells.length>=2);
    for(let r=0;r<L.rows;r++)for(let c=0;c<L.cols;c++)if(L.diag[r][c])assert.notEqual(geo.ch.of(r,c,'a'),geo.ch.of(r,c,'b'));
  }
});
// Rasterises every strip, thickened by 0.4mm, then floods the space between them. Each region
// must hold one chamber only, so any gap wider than about 1mm between chambers shows up here.
function regions(r,mm=0.5){
  const {G,P,geo}=r,W=Math.ceil(P.W/mm),H=Math.ceil(P.H/mm),grid=new Uint8Array(W*H),grow=0.4;
  const inPoly=(poly,x,y)=>{
    for(let i=0;i<poly.length;i++){
      const p=poly[i],q=poly[(i+1)%poly.length],l=Math.hypot(q[0]-p[0],q[1]-p[1]);
      const side=((q[0]-p[0])*(y-p[1])-(q[1]-p[1])*(x-p[0]))/l;
      const area=poly.reduce((a,v,k)=>{const w=poly[(k+1)%poly.length];return a+v[0]*w[1]-w[0]*v[1];},0);
      if((area>0?side:-side)<-grow)return false;
    }
    return true;
  };
  for(const pc of geo.pieces){
    const b=pc.rect;
    for(let y=Math.floor((b.y0-1)/mm);y<=(b.y1+1)/mm;y++)for(let x=Math.floor((b.x0-1)/mm);x<=(b.x1+1)/mm;x++)
      if(x>=0&&y>=0&&x<W&&y<H&&inPoly(pc.poly,x*mm,y*mm))grid[y*W+x]=1;
  }
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(x*mm<P.B||y*mm<P.B||x*mm>P.W-P.B||y*mm>P.H-P.B)grid[y*W+x]=1;
  const label=new Int32Array(W*H);let n=0;
  for(let s=0;s<W*H;s++){
    if(grid[s]||label[s])continue;
    n++;const st=[s];label[s]=n;
    while(st.length){const v=st.pop(),x=v%W;
      for(const w of [x>0?v-1:-1,x<W-1?v+1:-1,v-W,v+W])if(w>=0&&w<W*H&&!grid[w]&&!label[w]){label[w]=n;st.push(w);}}
  }
  return (x,y)=>label[Math.round(y/mm)*W+Math.round(x/mm)];
}
test('flood test: no gap joins two chambers once tunnels are ignored',()=>{
  for(const cfg of CFGS)for(let seed=1;seed<=8;seed++){
    const r=run({...cfg,sponges:0},seed),at=regions(r);
    const seen=new Map();
    for(const c of r.geo.ch.list){
      const pts=c.cells.map(u=>unitCenter(r.G,u));
      const ls=new Set(pts.map(p=>at(p[0],p[1])).filter(Boolean));
      for(const l of ls){
        assert.ok(!seen.has(l)||seen.get(l)===c.id,`${JSON.stringify(cfg)} seed ${seed}: chambers ${seen.get(l)} and ${c.id} leak`);
        seen.set(l,c.id);
      }
    }
    assert.ok(seen.size>=r.geo.ch.list.length*0.9,'flood must really find the chambers');
  }
});
test('the flood test can actually see a leak',()=>{
  const r=run({...ON,sponges:0,jogShare:0,diagShare:0.3},2);
  const i=r.geo.pieces.findIndex(p=>p.kind==='angle');
  const pc=r.geo.pieces[i];
  const ch=r.geo.ch.list,before=regions(r);
  const count=()=>{const a=regions(r),s=new Set();for(const c of ch)for(const u of c.cells){const [x,y]=unitCenter(r.G,u);s.add(a(x,y));}return s.size;};
  const n=count();
  r.geo.pieces.splice(i,1);
  assert.ok(count()<n,'removing a diagonal must merge two regions');
  assert.ok(pc&&before);
});
test('angled strips are straight flat strips with tabs, and their slots are rotated to match',()=>{
  for(let seed=1;seed<=10;seed++){
    const r=run({...ON,diagShare:0.4},seed);
    for(const pc of r.geo.pieces.filter(p=>p.kind==='angle')){
      assert.ok(pc.top.length>=1,`${pc.id} needs a tab`);
      const pts=stripOutline(pc,r.G,r.P);
      assert.ok(pts.every((p,i)=>{const q=pts[(i+1)%pts.length];return Math.abs(p[0]-q[0])<1e-9||Math.abs(p[1]-q[1])<1e-9;}),'flat outline stays square');
    }
    const rotated=r.geo.slotsFront.filter(s=>s.poly);
    assert.equal(rotated.length,r.geo.pieces.filter(p=>p.kind==='angle').reduce((a,p)=>a+p.top.length,0));
  }
});
test('jogged walls keep their ends on the grid and split into strips',()=>{
  for(let seed=1;seed<=20;seed++){
    const r=run({...ON,diagShare:0,jogShare:0.6},seed);
    const nH=r.L.jogH.flat().filter(Boolean).length,nV=r.L.jogV.flat().filter(Boolean).length;
    assert.equal(r.geo.pieces.filter(p=>p.kind==='angle').length,2*nH+nV,'2 angled strips per horizontal jog, 1 per vertical');
    assert.deepEqual(r.geo.warnings,[]);
  }
});
test('vents stay inside their chamber with angled walls',()=>{
  for(let seed=1;seed<=30;seed++){
    const {geo}=run({...ON,diagShare:0.5},seed);
    for(const v of geo.vents)for(const p of geo.pieces){
      const box=[[v.x-0.5,v.y-0.5],[v.x+0.5,v.y-0.5],[v.x+0.5,v.y+0.5],[v.x-0.5,v.y+0.5]];
      assert.ok(!polysOverlap(box,p.poly),`vent on ${p.id} seed ${seed}`);
    }
  }
});
test('kerf offset is exact at 45 and 135 degree corners',()=>{
  // a right trapezoid: offsetting by 1 must keep every edge exactly 1 from the original
  const poly=[[0,0],[10,0],[20,10],[0,10]];
  const out=offsetPoly(poly,1);
  for(let i=0;i<4;i++){
    const a=poly[i],b=poly[(i+1)%4],p=out[i],q=out[(i+1)%4];
    const dist=(v)=>Math.abs((b[0]-a[0])*(v[1]-a[1])-(b[1]-a[1])*(v[0]-a[0]))/Math.hypot(b[0]-a[0],b[1]-a[1]);
    assert.ok(Math.abs(dist(p)-1)<1e-9&&Math.abs(dist(q)-1)<1e-9,`edge ${i}`);
  }
});
test('polygon overlap test handles rotated shapes',()=>{
  const sq=[[0,0],[10,0],[10,10],[0,10]];
  assert.ok(polysOverlap(sq,[[9,5],[12,2],[15,5],[12,8]]));
  assert.ok(!polysOverlap(sq,[[10.5,5],[13,2],[16,5],[13,8]]));
  assert.ok(!polysOverlap(sq,[[10,0],[20,0],[20,10],[10,10]]),'touching is not overlapping');
});
test('chamber centres work for half cells',()=>{
  const r=run({...ON,diagShare:0.4},4);
  for(const c of r.geo.ch.list){const [x,y]=chamberCenter(r.G,c);assert.ok(x>0&&y>0&&x<r.P.W&&y<r.P.H);}
});
