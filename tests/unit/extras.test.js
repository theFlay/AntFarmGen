import test from 'node:test';
import assert from 'node:assert/strict';
import {run,files} from './helpers.js';
import {buildGeometry} from '../../src/geometry.js';
import {checkRules} from '../../src/rules.js';
import {hardwareParts} from '../../src/hardware.js';
import {cleanLayout} from '../../src/sanitize.js';
import {stH,stV} from '../../src/layout.js';

const copy=o=>JSON.parse(JSON.stringify(o));
// the maze layout, as sensorCell only looks for a solid top left corner
const CLEAR={brood:0,sponges:0,loops:0,tunnelStyle:'maze'};
// finds a cell with two solid walls meeting at a corner
function sensorCell(r){
  const {L,G}=r;
  for(let y=1;y<G.rows-1;y++)for(let x=1;x<G.cols-1;x++)
    if(stH(L,y,x)==='solid'&&stV(L,y,x)==='solid')return [y,x];
}
test('a sensor pocket is a sealed vented box opening through the service sheet',()=>{
  for(const orient of ['flat','upright']){
    const r=run({...CLEAR,orient},4),L=copy(r.L);
    L.sensors.push(sensorCell(r));
    const geo=buildGeometry(r.G,L,r.P),rules=checkRules(r.G,L,r.P,geo);
    assert.deepEqual(rules.msgs.filter(m=>m[0]==='error'),[]);
    assert.equal(geo.sensorBoxes.length,1);
    const strips=geo.pieces.filter(p=>/^N1/.test(p.id));
    assert.equal(strips.length,2);
    for(const s of strips){assert.ok(s.windows.length>0,'vent slots face the chamber');assert.ok(s.top.length>=1,'tabs');}
    const count=(g,n)=>(files({...r,L,geo:g}).find(f=>f.name===n).data.match(/<path/g)||[]).length;
    const base=buildGeometry(r.G,r.L,r.P);
    const side=orient==='flat'?'front-sheet.svg':'back-sheet.svg',other=orient==='flat'?'back-sheet.svg':'front-sheet.svg';
    const added=strips.reduce((a,p)=>a+p.top.length,0);
    assert.equal(count(geo,side)-count(base,side),added+1,'opening plus tab slots');
    assert.equal(count(geo,other)-count(base,other),added,'other sheet only gets tab slots');
    assert.ok(hardwareParts(r.G,L,r.P,geo).some(p=>p.name==='sensor plug'));
  }
});
test('vents stay out of sensor pockets and away from pillars',()=>{
  const r=run(CLEAR,4),L=copy(r.L);
  const cell=sensorCell(r);L.sensors.push(cell);
  const geo=buildGeometry(r.G,L,r.P),b=geo.sensorBoxes[0].outer;
  assert.ok(geo.vents.length<r.geo.vents.length);
  for(const v of geo.vents)assert.ok(!(v.x>b.x0&&v.x<b.x1&&v.y>b.y0&&v.y<b.y1));
});
test('a sensor needs a solid corner, and must fit',()=>{
  const r=run(CLEAR,4),L=copy(r.L);
  const [y,x]=sensorCell(r);
  L.H[y][x]='tunnel';L.H[y+1][x]='tunnel';
  L.sensors.push([y,x]);
  assert.match(buildGeometry(r.G,L,r.P).errors.join(),/two solid walls/);
  const big=run({...CLEAR,sensorW:50},4),M=copy(big.L);M.sensors.push(sensorCell(big));
  assert.match(buildGeometry(big.G,M,big.P).errors.join(),/too big/);
});
test('pillars are short tabbed posts, and brood pillars sit in the middle',()=>{
  const r=run({broodPillar:true,sponges:0},4);
  const posts=r.geo.pieces.filter(p=>p.kind==='pillar');
  assert.equal(posts.length,1);
  assert.deepEqual(r.errors,[]);
  assert.ok(posts[0].top.length===1&&posts[0].bot.length===1,'tabs into both sheets');
  const c=r.geo.ch.list.find(x=>x.brood);
  const ys=c.cells.map(u=>r.G.ys[u[0]+1]);
  assert.ok(ys.includes(posts[0].c),'on the line through the middle of the brood chamber');
  assert.equal(run({sponges:0},4).geo.pieces.filter(p=>p.kind==='pillar').length,0);
});
test('a pillar cannot sit on a diagonal',()=>{
  const r=run({angled:true,diagShare:0.5,sponges:0},4),L=copy(r.L);
  for(let y=0;y<L.rows;y++)for(let x=0;x<L.cols;x++)if(L.diag[y][x]&&!L.pillars.length)L.pillars.push([y,x]);
  assert.match(buildGeometry(r.G,L,r.P).errors.join(),/pillar/);
});
test('sensors and pillars survive save and load, hostile ones do not',()=>{
  const r=run({},3),L=copy(r.L);L.sensors.push([1,1]);L.pillars.push([2,2]);
  assert.deepEqual(cleanLayout(copy(L),r.G),L);
  const bad=copy(L);bad.sensors.push(['<x>',1]);
  assert.throws(()=>cleanLayout(bad,r.G));
  const far=copy(L);far.pillars.push([99,1]);
  assert.throws(()=>cleanLayout(far,r.G));
});
