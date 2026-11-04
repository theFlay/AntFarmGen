import test from 'node:test';
import assert from 'node:assert/strict';
import {run,files} from './helpers.js';
import {borderHeat,heatEdges,minHeatBorder,heatFrameLayers} from '../../src/heat.js';
import {buildGeometry} from '../../src/geometry.js';
import {checkRules} from '../../src/rules.js';
import {hardwareParts,plugPinPart} from '../../src/hardware.js';
import {cleanLayout} from '../../src/sanitize.js';
import {svgToDxf} from '../../src/dxf.js';
import {polysOverlap,rectPts} from '../../src/util.js';
import {getEdge,chambers,interiorEdges} from '../../src/layout.js';

const copy=o=>JSON.parse(JSON.stringify(o));
const area=p=>Math.abs(p.reduce((a,v,i)=>{const w=p[(i+1)%p.length];return a+v[0]*w[1]-w[0]*v[1];},0))/2;
const len=p=>p.slice(1).reduce((a,v,i)=>a+Math.hypot(v[0]-p[i][0],v[1]-p[i][1]),0);
const WIDE={B:21};
const SETS=[{heatTop:true},{heatRight:true},{heatBottom:true},{heatLeft:true},{heatTop:true,heatRight:true},{heatRight:true,heatBottom:true},
  {heatBottom:true,heatLeft:true},{heatLeft:true,heatTop:true},{heatTop:true,heatBottom:true},{heatLeft:true,heatRight:true},
  {heatTop:true,heatRight:true,heatBottom:true},{heatRight:true,heatBottom:true,heatLeft:true},{heatBottom:true,heatLeft:true,heatTop:true},
  {heatLeft:true,heatTop:true,heatRight:true},{heatTop:true,heatRight:true,heatBottom:true,heatLeft:true}];

test('every mix of heated borders passes the rules on flat and upright nests',()=>{
  for(const s of SETS)for(const orient of ['flat','upright'])for(let seed=1;seed<=6;seed++){
    const r=run({...WIDE,...s,orient},seed);
    assert.deepEqual(r.errors,[],JSON.stringify(s)+' seed '+seed);
    for(const f of files(r))assert.doesNotMatch(f.data,/NaN|undefined|Infinity/,f.name);
  }
});
test('heat layer pieces plus groove exactly fill the frame ring',()=>{
  for(const s of SETS){
    const {P}=run({...WIDE,...s},1),h=borderHeat(P);
    let sum=0;for(const p of h.pieces){sum+=area(p.poly);if(p.hole)sum-=area(p.hole);}
    for(const p of h.paths)sum+=len(p)*P.heatEdgeW;
    const ring=P.W*P.H-(P.W-2*P.B)*(P.H-2*P.B);
    assert.ok(Math.abs(sum-ring)<1e-6,`${JSON.stringify(s)}: ${sum} vs ${ring}`);
  }
});
test('every groove starts and ends on the panel edge, clear of the nest opening',()=>{
  for(const s of SETS){
    const {P}=run({...WIDE,...s},1),h=borderHeat(P);
    const onEdge=([x,y])=>x===0||y===0||x===P.W||y===P.H;
    for(const p of h.paths){
      assert.ok(onEdge(p[0])&&onEdge(p[p.length-1]));
      for(const [x,y] of p)assert.ok(x<=P.B||y<=P.B||x>=P.W-P.B||y>=P.H-P.B,'stays in the border');
    }
  }
});
test('grooves miss every peg, joiner slot and cover socket',()=>{
  for(const s of SETS)for(const c of [{},{W:300,H:500}]){
    const {geo,G,P}=run({...WIDE,...s,...c},2);
    const hw=P.heatEdgeW/2;
    const seg=geo.edgeHeat.paths.flatMap(p=>p.slice(1).map((v,i)=>rectPts(Math.min(v[0],p[i][0])-hw,Math.min(v[1],p[i][1])-hw,Math.max(v[0],p[i][0])+hw,Math.max(v[1],p[i][1])+hw)));
    const slot=(o,l)=>o.along==='x'?rectPts(o.x-l/2,o.y-G.t/2,o.x+l/2,o.y+G.t/2):rectPts(o.x-G.t/2,o.y-l/2,o.x+G.t/2,o.y+l/2);
    for(const f of [...geo.fasteners.map(o=>slot(o,P.pegW)),...geo.joints.map(o=>slot(o,8)),...geo.sockets.map(o=>slot(o,geo.socketL-4))])
      for(const l of seg)assert.ok(!polysOverlap(f,l),`${JSON.stringify(s)}`);
  }
});
test('a wider border keeps a tab each side of every tunnel, by shortening them if it must',()=>{
  for(let seed=1;seed<=20;seed++){
    const r=run({...WIDE,heatBottom:true},seed);
    assert.ok(!r.rules.msgs.some(m=>/too short for tabs/.test(m[1])),'seed '+seed);
    for(const pc of r.geo.pieces)for(const n of pc.notches){
      const u=n-pc.s;
      assert.ok(pc.top.some(x=>x<u)&&pc.top.some(x=>x>u),`${pc.id} seed ${seed}`);
    }
  }
});
test('the ring inside the groove is at least 3mm wide, so it survives handling',()=>{
  for(const s of SETS){
    const {P}=run({...WIDE,...s},1),h=borderHeat(P);
    for(const p of h.paths)for(const [x,y] of p.slice(1,-1)){
      const fromOpening=Math.min(Math.abs(x-P.B),Math.abs(y-P.B),Math.abs(x-(P.W-P.B)),Math.abs(y-(P.H-P.B)));
      assert.ok(fromOpening-P.heatEdgeW/2>=3-1e-9);
    }
  }
});
test('a narrow border is refused, with the size it needs',()=>{
  const r=run({heatBottom:true},1);
  assert.ok(r.errors.some(e=>e.includes(`${minHeatBorder(r.P)}mm`)));
});
test('the heat layer replaces one frame layer, and ports lose that height',()=>{
  const r=run({...WIDE,heatBottom:true},1),n=files(r).map(f=>f.name);
  assert.ok(n.includes('frame-layer-cut-x3.svg')&&n.includes('frame-heat-layer-cut-x1.svg'));
  assert.equal(plugPinPart(r.G,r.P).w,9);
  assert.equal(hardwareParts(r.G,r.L,r.P,r.geo).find(p=>p.name==='plug').qty,r.geo.ports.filter(p=>p.cut).length*3);
  assert.ok(!r.rules.msgs.some(m=>m[0]==='warn'&&/lower than/.test(m[1])),'9mm ports match 9mm tunnels');
  const low=run({...WIDE,heatBottom:true,heatEdgeLayers:2},1);
  assert.ok(low.rules.msgs.some(m=>m[0]==='warn'&&/lower than/.test(m[1])));
  assert.equal(heatFrameLayers(run({},1).P),0);
  assert.deepEqual(heatEdges(r.P),['bottom']);
});
test('the old layout is unchanged when border heat is off',()=>{
  const r=run({},1);
  assert.equal(r.geo.edgeHeat,null);
  assert.ok(r.geo.fasteners.some(f=>f.y===r.P.B/2));
});
test('a water vial holder fits a sponge, with blind slots over the wall',()=>{
  const r=run({},1),L=copy(r.L);
  const ch=chambers(L),e=interiorEdges(L,ch).find(x=>getEdge(L,x)==='sponge');
  L.vials.push(e.type==='H'?{type:'H',j:e.j,k:e.k}:{type:'V',r:e.r,i:e.i});
  const geo=buildGeometry(r.G,L,r.P),rules=checkRules(r.G,L,r.P,geo);
  assert.deepEqual(rules.msgs.filter(m=>m[0]==='error'),[]);
  assert.equal(geo.vials.length,1);assert.equal(geo.vialSlots.length,2);
  for(const s of geo.vialSlots){
    const poly=rectPts(s.x0,s.y0,s.x1,s.y1);
    const over=geo.pieces.filter(p=>p.kind==='wall'&&polysOverlap(poly,p.poly,0.5));
    assert.ok(over.length>=1,'each slot must end on a wall strip, never open into a chamber');
    const inChamber=(x,y)=>!geo.pieces.some(p=>{const q=p.rect;return x>=q.x0-.01&&x<=q.x1+.01&&y>=q.y0-.01&&y<=q.y1+.01;});
    const cx=(s.x0+s.x1)/2,cy=(s.y0+s.y1)/2;
    assert.ok(!inChamber(cx,cy));
  }
  const kit=hardwareParts(r.G,L,r.P,geo);
  assert.equal(kit.find(p=>p.name==='vial ring').qty,3);
  assert.equal(kit.find(p=>p.name==='vial post').qty,2);
  const big=run({vialD:40},1);
  assert.ok(buildGeometry(big.G,L,big.P).errors.some(x=>/too wide/.test(x)));
});
test('a water chamber needs an upright nest, a sponge below, no tunnels and a seal warning',()=>{
  const r=run({orient:'upright',brood:0,sponges:0,loops:0},3),L=copy(r.L);
  const msgs=l=>checkRules(r.G,l,r.P,buildGeometry(r.G,l,r.P)).msgs;
  L.reservoirs.push([1,4]);
  assert.ok(msgs(L).some(m=>/sponge in the wall directly below/.test(m[1])));
  L.H[2][4]='sponge';
  for(const [e,v] of [[L.H[1],4],[L.V[1],4],[L.V[1],5]])if(e[v]==='tunnel')e[v]='solid';
  const m=msgs(L);
  assert.ok(m.some(x=>x[0]==='warn'&&/acrylic cement/.test(x[1])));
  assert.ok(!m.some(x=>/water chamber must not/.test(x[1])));
  const g=buildGeometry(r.G,L,r.P);
  assert.ok(g.fills.some(f=>f.id==='W'),'gets a fill hole');
  assert.ok(g.vents.length<r.geo.vents.length,'no air vents over water');
  const flat=run({},1),F=copy(flat.L);F.reservoirs.push([1,1]);
  assert.match(checkRules(flat.G,F,flat.P,buildGeometry(flat.G,F,flat.P)).msgs.map(x=>x[1]).join(),/upright nests/);
});
test('ports marked in use drop out of the plug count',()=>{
  const r=run({},1),L=copy(r.L),keys=r.geo.ports.filter(p=>p.cut).map(p=>p.key);
  L.portsUsed.push(keys[0],keys[1]);
  const g=buildGeometry(r.G,L,r.P);
  assert.equal(hardwareParts(r.G,L,r.P,g).find(p=>p.name==='plug pin').qty,keys.length-2);
  assert.match(checkRules(r.G,L,r.P,g).msgs.map(m=>m[1]).join(),/2 marked in use/);
});
test('chamfers add short strips, pass every rule and stay on the diagonal corners',()=>{
  let n=0;
  for(let seed=1;seed<=30;seed++){
    const plain=run({angled:true,jogShare:0,diagShare:0.3},seed),r=run({angled:true,jogShare:0,diagShare:0.3,chamfer:14},seed);
    assert.deepEqual(r.errors,[],'seed '+seed);
    n+=r.geo.pieces.filter(p=>p.kind==='angle').length-plain.geo.pieces.filter(p=>p.kind==='angle').length;
  }
  assert.ok(n>50,`${n} chamfers`);
});
test('DXF carries every cut and is flipped to match',()=>{
  const r=run({exportDxf:true},1),f=files(r);
  for(const svg of f.filter(x=>x.name.endsWith('.svg')&&!/assembly/.test(x.name))){
    const d=f.find(x=>x.name===svg.name.replace('.svg','.dxf'));
    assert.ok(d,svg.name);
    const paths=(svg.data.match(/<path d="[^"]+" fill="none"/g)||[]).length,circles=(svg.data.match(/<circle/g)||[]).length;
    assert.equal((d.data.match(/POLYLINE/g)||[]).length,paths,svg.name);
    assert.equal((d.data.match(/\bCIRCLE\b/g)||[]).length,circles);
    assert.match(d.data,/EOF\r\n$/);
  }
  const small='<svg viewBox="-1 -1 12 12"><path d="M0 0 L10 0 L10 10 Z" fill="none" stroke="#f00"/></svg>';
  const lines=svgToDxf(small).split('\r\n');
  const ys=lines.filter((l,i)=>lines[i-1]==='20').map(Number);
  assert.deepEqual(ys,[10,10,0],'y is flipped');
  assert.ok(!f.some(x=>/assembly.*dxf/.test(x.name)));
});
test('the bed check catches parts too big for the laser',()=>{
  assert.deepEqual(run({bed:'speedy300'},1).errors,[]);
  assert.ok(run({W:800,H:500,bed:'speedy300'},1).errors.some(e=>/too big for the Speedy 300/.test(e)));
  assert.ok(!run({W:800,H:500,bed:'speedy360',stockW:800,stockH:500},1).errors.some(e=>/too big/.test(e)));
  assert.ok(run({bed:'speedy300',stockW:800,stockH:500},1).errors.some(e=>/stock/.test(e)));
  assert.ok(!run({W:300,H:500,bed:'speedy300'},1).errors.some(e=>/too big/.test(e)),'rotating a panel to fit is fine');
});
test('new lists survive load, hostile entries do not',()=>{
  const r=run({},1),L=copy(r.L);
  L.vials.push({type:'H',j:1,k:1});L.reservoirs.push([1,1]);L.portsUsed.push('top:50');
  assert.deepEqual(cleanLayout(copy(L),r.G),L);
  for(const edit of [x=>{x.portsUsed.push('"><b>');},x=>{x.vials.push({type:'<',j:1,k:1});},x=>{x.reservoirs.push(['a',1]);}]){
    const b=copy(L);edit(b);assert.throws(()=>cleanLayout(b,r.G));
  }
});
