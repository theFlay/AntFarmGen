import test from 'node:test';
import assert from 'node:assert/strict';
import {run} from './helpers.js';
import {buildGeometry} from '../../src/geometry.js';
import {checkRules} from '../../src/rules.js';
import {chambers,interiorEdges,getEdge,setEdge} from '../../src/layout.js';

// runs the rules on a hand-edited copy of a layout, as the manual tools would
function edited(cfg,edit){
  const r=run(cfg,7),L=JSON.parse(JSON.stringify(r.L));
  edit(L,r);
  const geo=buildGeometry(r.G,L,r.P);
  return checkRules(r.G,L,r.P,geo).msgs.filter(m=>m[0]==='error').map(m=>m[1]).join(' | ');
}
test('more than 3 tunnels in a chamber is an error',()=>{
  const e=edited({brood:0,sponges:0},L=>{
    L.H[1][2]='tunnel';L.H[2][2]='tunnel';L.V[1][2]='tunnel';L.V[1][3]='tunnel';
  });
  assert.match(e,/more than 3 tunnels/);
});
test('a chamber with no tunnel is an error',()=>{
  const e=edited({brood:0,sponges:0},L=>{
    L.H[1][0]='solid';L.V[0][1]='solid';
  });
  assert.match(e,/no tunnel/);
});
test('a disconnected nest is an error',()=>{
  const e=edited({brood:0,sponges:0},(L,r)=>{
    const ch=chambers(L);
    for(const x of interiorEdges(L,ch))if((x.type==='V'&&x.i===4)&&getEdge(L,x)==='tunnel')setEdge(L,x,'solid');
  });
  assert.match(e,/cannot be reached/);
});
test('more than 2 sponges in a chamber is an error',()=>{
  const e=edited({brood:0,sponges:0},L=>{L.H[1][2]='sponge';L.H[2][2]='sponge';L.V[1][2]='sponge';});
  assert.match(e,/more than 2 sponges/);
});
test('a starting area with no brood chamber is an error',()=>{
  const e=edited({activeCount:8,brood:1},(L,r)=>{
    for(const m of L.merges)for(const [a,b] of m.cells)L.active[a][b]=false;
  });
  assert.match(e,/no brood chamber/);
});
test('a starting area with no sponge is an error',()=>{
  const e=edited({activeCount:8},L=>{
    for(const row of L.H)row.forEach((s,i)=>{if(s==='sponge')row[i]='solid';});
    for(const row of L.V)row.forEach((s,i)=>{if(s==='sponge')row[i]='solid';});
  });
  assert.match(e,/no water/);
});
test('an empty starting area is an error',()=>{
  const e=edited({},L=>{for(const row of L.active)row.fill(false);});
  assert.match(e,/No chambers in the starting area/);
});
test('a starting area split in two is an error',()=>{
  const e=edited({brood:0,sponges:0},(L,r)=>{
    const ch=chambers(L),all=ch.list;
    for(const row of L.active)row.fill(false);
    // two far corners, not joined by open chambers
    L.active[0][0]=true;L.active[r.G.rows-1][r.G.cols-1]=true;
  });
  assert.match(e,/cut off/);
});
test('a sloppy starting area with no port is an error',()=>{
  const e=edited({brood:0,sponges:0,portOffset:50,portPitch:4},()=>{});
  assert.match(e,/no entrance/);
});
