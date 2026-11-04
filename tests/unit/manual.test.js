import test from 'node:test';
import assert from 'node:assert/strict';
import {run} from './helpers.js';
import {buildGeometry} from '../../src/geometry.js';
import {checkRules} from '../../src/rules.js';
import {emptyLayout,addDiagonal,removeDiagonal,chambers,stH,stV} from '../../src/layout.js';

const first=()=>0;

test('a diagonal is refused if both halves would join the same chamber',()=>{
  const L=emptyLayout(5,5);
  // one group wraps the top and left of cell 2,2, and those are the only free neighbours
  L.merges.push({cells:[[1,2],[1,1],[2,1]],brood:false});
  L.diag[2][3]=1;L.diag[3][2]=1;
  assert.equal(addDiagonal(L,2,2,2,first),false,'/ blocked: a must use 1,2 and b must use 2,1');
  assert.equal(L.diag[2][2],0);
});
test('a diagonal cannot go in a brood chamber, or take a half from one',()=>{
  const L=emptyLayout(5,5);
  L.merges.push({cells:[[1,1],[1,2],[2,1],[2,2]],brood:true});
  assert.equal(addDiagonal(L,1,1,1,first),false);
  L.merges.push({cells:[[3,3],[3,4],[4,3],[4,4]],brood:true});
  assert.equal(addDiagonal(L,0,1,1,first),true,'its right neighbour is free');
  assert.equal(L.merges[0].cells.length,4,'the brood chamber must stay a clean 2x2');
});
test('removing a diagonal puts the walls and chambers back',()=>{
  const L=emptyLayout(5,5),n=chambers(L).list.length;
  assert.ok(addDiagonal(L,2,2,1,first));
  assert.equal(chambers(L).list.length,n-1,'two halves join two neighbours: one more unit, two fewer chambers');
  removeDiagonal(L,2,2);
  assert.equal(chambers(L).list.length,n);
  assert.equal(L.merges.length,0);
  for(let j=1;j<5;j++)for(let k=0;k<5;k++)assert.equal(stH(L,j,k),'solid');
  for(let r=0;r<5;r++)for(let i=1;i<5;i++)assert.equal(stV(L,r,i),'solid');
});
test('a vertical jog with no wall to land on is skipped with a warning, not left floating',()=>{
  const r=run({angled:true,diagShare:0,jogShare:0,brood:0,sponges:0},3);
  const L=JSON.parse(JSON.stringify(r.L));
  L.V[0][3]='solid';L.V[1][3]='solid';
  L.jogV[0][3]=8;                    // top row: its upper end meets the frame
  const geo=buildGeometry(r.G,L,r.P);
  assert.equal(geo.pieces.filter(p=>p.kind==='angle').length,0);
  assert.ok(geo.warnings.some(w=>/jog on wall V3/.test(w)));
  L.jogV[0][3]=0;
  L.merges.push({cells:[[1,3],[2,3]],brood:false});
  L.jogV[1][3]=8;                    // its end would land where a joined chamber has no wall
  const g2=buildGeometry(r.G,L,r.P);
  assert.ok(g2.warnings.some(w=>/jog on wall/.test(w)));
});
test('a jog on a tunnel wall is ignored, so the tunnel stays straight',()=>{
  const r=run({angled:true,diagShare:0,jogShare:0,sponges:0},3);
  const L=JSON.parse(JSON.stringify(r.L));
  let done=0;
  for(let j=1;j<L.rows&&!done;j++)for(let k=0;k<L.cols&&!done;k++)if(stH(L,j,k)==='tunnel'){L.jogH[j][k]=8;done=1;}
  assert.equal(done,1);
  assert.equal(buildGeometry(r.G,L,r.P).pieces.filter(p=>p.kind==='angle').length,0);
});
test('a short jog warns that its strip has no tab',()=>{
  const r=run({angled:true,diagShare:0,jogShare:1,jogSize:6,sponges:0},2);
  assert.ok(r.geo.pieces.some(p=>p.kind==='angle'));
  assert.ok(r.rules.msgs.some(m=>m[0]==='warn'&&/too short for tabs/.test(m[1])));
});
test('jogs too small to cut are not generated',()=>{
  for(let seed=1;seed<=20;seed++){
    const r=run({angled:true,diagShare:0,jogShare:1,jogSize:4},seed);
    assert.equal(r.geo.pieces.filter(p=>p.kind==='angle').length,0);
    assert.deepEqual(r.errors,[]);
  }
});
test('a lone triangle chamber is an error',()=>{
  const r=run({brood:0,sponges:0},3);
  const L=JSON.parse(JSON.stringify(r.L));
  L.diag[1][2]=1;
  assert.match(checkRules(r.G,L,r.P,buildGeometry(r.G,L,r.P)).msgs.map(m=>m[1]).join('|'),/lone triangle/);
});
