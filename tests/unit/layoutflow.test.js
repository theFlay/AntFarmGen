import test from 'node:test';
import assert from 'node:assert/strict';
import {run,files,CONFIGS} from './helpers.js';
import {BOLTS,boltDia} from '../../src/params.js';
import {boltLength,hardwareParts} from '../../src/hardware.js';
import {cleanLayout} from '../../src/sanitize.js';
import {fmt} from '../../src/util.js';
import {buildGeometry} from '../../src/geometry.js';
import {checkRules} from '../../src/rules.js';
import {findRoutes} from '../../src/routes.js';
import {chamberCenter,interiorEdges,getEdge,setEdge} from '../../src/layout.js';

const copy=o=>JSON.parse(JSON.stringify(o));
const SEEDS=40;
const spongeSpots=({L,G,geo})=>interiorEdges(L,geo.ch).filter(e=>getEdge(L,e)==='sponge')
  .map(e=>e.type==='H'?[(G.xs[e.k]+G.xs[e.k+1])/2,G.ys[e.j]]:[G.xs[e.i],(G.ys[e.r]+G.ys[e.r+1])/2]);
function hopsFromBrood({L,geo}){
  const g=new Map(geo.ch.list.map(c=>[c.id,[]]));
  for(const e of interiorEdges(L,geo.ch))if(getEdge(L,e)==='tunnel'){g.get(e.a).push(e.b);g.get(e.b).push(e.a);}
  const from=geo.ch.list.find(c=>c.brood).id,d=new Map([[from,0]]),q=[from];
  while(q.length){const a=q.shift();for(const b of g.get(a))if(!d.has(b)){d.set(b,d.get(a)+1);q.push(b);}}
  return [...d.values()];
}

test('every bolt size cuts its own clearance hole',()=>{
  for(const [size,[hole]] of Object.entries(BOLTS)){
    const r=run({fastener:'bolt',boltSize:size},1);
    assert.deepEqual(r.errors,[],size);
    const radius=fmt(hole/2-r.P.kerf/2);
    const sheet=files(r).find(f=>f.name==='front-sheet.svg').data;
    assert.ok(sheet.includes(`r="${radius}"`),`${size} hole in the sheet`);
  }
  assert.ok(Object.keys(BOLTS).length>=5);
});
test('a custom hole uses the typed size, and M3 matches the old default',()=>{
  assert.equal(boltDia({boltSize:'custom',boltD:7.2}),7.2);
  assert.equal(boltDia({boltSize:'M3',boltD:7.2}),3.4);
});
test('a bolt too big for the border is an error, a tight head is a warning',()=>{
  assert.match(run({fastener:'bolt',boltSize:'M8',B:12},1).errors.join(),/too big/);
  const w=run({fastener:'bolt',boltSize:'M6',B:11.5},1);
  assert.ok(w.rules.msgs.some(m=>m[0]==='warn'&&/tight fit/.test(m[1])));
});
test('bolt length clears the stack and grows with the bolt',()=>{
  const r=run({},1),stack=2*r.P.S+r.G.depth;
  for(const size of Object.keys(BOLTS))assert.ok(boltLength(r.G,{...r.P,boltSize:size})>=stack+1.5*BOLTS[size][0]);
  assert.ok(boltLength(r.G,{...r.P,boltSize:'M8'})>boltLength(r.G,{...r.P,boltSize:'M2'}));
});
test('sponges keep apart and do not always land on one side',()=>{
  const sides=new Set();
  for(let seed=1;seed<=SEEDS;seed++){
    const r=run({},seed),s=spongeSpots(r);
    sides.add(r.L.damp);
    assert.equal(s.length,3);
    for(let a=0;a<s.length;a++)for(let b=a+1;b<s.length;b++)
      assert.ok(Math.hypot(s[a][0]-s[b][0],s[a][1]-s[b][1])>=35,`seed ${seed}`);
  }
  assert.equal(sides.size,4);
});
test('a chosen damp side is still honoured',()=>{
  for(let seed=1;seed<=SEEDS;seed++){
    const r=run({dampSide:'right'},seed),s=spongeSpots(r);
    assert.equal(r.L.damp,'right');
    for(const [x] of s)assert.ok(x>=r.P.W*0.4,`seed ${seed}`);
  }
});
test('sponges still all fit when there is no room to keep them apart',()=>{
  for(let seed=1;seed<=SEEDS;seed++)assert.equal(spongeSpots(run({sponges:8},seed)).length,8);
});
test('the starting area stays on the side it grows from',()=>{
  for(const style of ['branch','maze'])for(let seed=1;seed<=SEEDS;seed++){
    const r=run({activeCount:6,growFrom:'right',tunnelStyle:style},seed);
    const open=r.geo.ch.list.filter(c=>c.active);
    assert.deepEqual(r.errors,[],`seed ${seed}`);
    assert.ok(open.some(c=>c.brood),'holds a brood chamber');
    for(const c of open)assert.ok(chamberCenter(r.G,c)[0]>r.P.W*0.4,`${style} seed ${seed} reaches left`);
  }
});
test('the starting area is the size asked for, and still holds what it must',()=>{
  for(const tunnelStyle of ['branch','maze'])for(const growFrom of ['left','right','top','bottom','center'])
    for(const activeCount of [1,2,3,6])for(let seed=1;seed<=12;seed++){
      const r=run({activeCount,growFrom,tunnelStyle,oddShare:0.1},seed),open=r.geo.ch.list.filter(c=>c.active);
      const tag=JSON.stringify({activeCount,growFrom,tunnelStyle,seed});
      assert.equal(open.length,activeCount,tag);
      assert.ok(open.some(c=>c.brood),tag);
      assert.ok(r.geo.ports.some(p=>p.cut&&p.active),tag);
      assert.deepEqual(r.errors,[],tag);
    }
});
test('the layout from the bug report opens 3 chambers, not 7',()=>{
  const r=run({oddShare:0.1,activeCount:3,growFrom:'top',loops:0.2},83156);
  assert.equal(r.geo.ch.list.filter(c=>c.active).length,3);
});
test('a starting area bigger than asked for says so',()=>{
  const r=run({activeCount:3},1),L=copy(r.L);
  for(let c=0;c<r.G.cols;c++)for(let y=0;y<r.G.rows;y++){L.active[y][c]=true;L.activeB[y][c]=true;}
  const geo=buildGeometry(r.G,L,r.P);
  assert.ok(checkRules(r.G,L,r.P,geo).msgs.some(m=>m[0]==='warn'&&/more than the 3 set/.test(m[1])));
  assert.ok(!r.rules.msgs.some(m=>/more than the/.test(m[1])));
});
test('branching brings chambers closer to the brood than a maze',()=>{
  const mean=style=>{
    let sum=0,n=0;
    for(let seed=1;seed<=SEEDS;seed++)for(const h of hopsFromBrood(run({tunnelStyle:style},seed))){sum+=h;n++;}
    return sum/n;
  };
  assert.ok(mean('branch')<mean('maze'));
});
test('both tunnel layouts pass every rule on every test panel',()=>{
  for(const tunnelStyle of ['branch','maze'])for(const cfg of CONFIGS)for(let seed=1;seed<=12;seed++){
    assert.deepEqual(run({...cfg,tunnelStyle},seed).errors,[],JSON.stringify({...cfg,tunnelStyle,seed}));
  }
});
test('the same seed always gives the same nest',()=>{
  assert.deepEqual(run({},7).L,run({},7).L);
});
test('a nest with no loops has exactly one route between two chambers',()=>{
  const r=run({loops:0},3),list=r.geo.ch.list,from=list[0].id,to=list[list.length-1].id;
  const routes=findRoutes(r.G,r.L,r.geo.ch,from,to);
  assert.equal(routes.length,1);
  assert.equal(routes[0].ids[0],from);
  assert.equal(routes[0].ids.at(-1),to);
  assert.equal(routes[0].pts.length,2*routes[0].ids.length-1);
});
test('routes come shortest first and never visit a chamber twice',()=>{
  const r=run({loops:0.5},3),list=r.geo.ch.list;
  let multi=0;
  for(const to of list){
    const routes=findRoutes(r.G,r.L,r.geo.ch,list[0].id,to.id);
    if(routes.length>1)multi++;
    assert.ok(routes.length<=4);
    routes.forEach((x,i)=>{
      assert.equal(new Set(x.ids).size,x.ids.length);
      if(i)assert.ok(x.mm>=routes[i-1].mm);
    });
  }
  assert.ok(multi>0,'loops give alternatives');
});
test('a route counts the doors that start closed',()=>{
  const r=run({activeCount:5,loops:0},3),list=r.geo.ch.list;
  const shut=list.find(c=>!c.active),open=list.find(c=>c.active);
  assert.ok(findRoutes(r.G,r.L,r.geo.ch,open.id,shut.id)[0].closed>=1);
});
test('no route is found across a wall with no tunnels',()=>{
  const r=run({loops:0},3),L=copy(r.L);
  for(const e of interiorEdges(L,r.geo.ch))if(getEdge(L,e)==='tunnel')setEdge(L,e,'solid');
  assert.deepEqual(findRoutes(r.G,L,r.geo.ch,r.geo.ch.list[0].id,r.geo.ch.list[1].id),[]);
});
test('a huge number of loops cannot run away',()=>{
  const r=run({W:900,H:900,loops:1,brood:0},2),list=r.geo.ch.list;
  const routes=findRoutes(r.G,r.L,r.geo.ch,list[0].id,list[list.length-1].id,4,2000);
  assert.ok(routes.length<=4);
});
test('panel joiners land on the parts sheets with two keys each',()=>{
  const none=hardwareParts(...(({G,L,P,geo})=>[G,L,P,geo])(run({},1)));
  const r=run({joinerQty:3},1),kit=hardwareParts(r.G,r.L,r.P,r.geo);
  assert.equal(kit.find(p=>p.name==='panel joiner').qty,3);
  assert.equal(kit.find(p=>p.name==='key').qty,none.find(p=>p.name==='key').qty+6);
});
test('joiners warn when they have no slots, or a cover sits too low',()=>{
  const warned=(c,re)=>run(c,1).rules.msgs.some(m=>m[0]==='warn'&&re.test(m[1]));
  assert.ok(warned({joinerQty:2,joinSlots:false},/need Slots/));
  assert.ok(warned({coverStand:3},/too low to clear/));
  assert.ok(!warned({},/too low to clear/),'the default cover clears them');
});
test('a saved layout keeps its damp side, and junk is dropped',()=>{
  const r=run({},4);
  assert.equal(cleanLayout(copy(r.L),r.G).damp,r.L.damp);
  assert.equal(cleanLayout({...copy(r.L),damp:'<script>'},r.G).damp,'');
});
