import test from 'node:test';
import assert from 'node:assert/strict';
import {run,files} from './helpers.js';
import {normalizeLayout} from '../../src/layout.js';

const CFGS=[{oddShare:0.5},{oddShare:1,oddMax:3},{oddShare:0.7,oddMax:6,brood:2},{oddShare:0.6,W:300,H:500,orient:'upright'},{oddShare:0.5,activeCount:8}];

test('odd chambers pass every rule and the overlap check',()=>{
  for(const cfg of CFGS)for(let seed=1;seed<=60;seed++){
    const r=run(cfg,seed);
    assert.deepEqual(r.errors,[],JSON.stringify(cfg)+' seed '+seed);
    assert.deepEqual(r.geo.warnings,[],JSON.stringify(cfg)+' seed '+seed);
    for(const f of files(r))assert.doesNotMatch(f.data,/NaN|undefined|Infinity/);
  }
});
test('odd chambers are connected shapes within the size limit',()=>{
  for(let seed=1;seed<=60;seed++){
    const {L}=run({oddShare:0.8,oddMax:5},seed);
    const odd=L.merges.filter(m=>!m.brood);
    assert.ok(odd.length>0);
    for(const m of odd){
      assert.ok(m.cells.length>=2&&m.cells.length<=5);
      const seen=new Set([m.cells[0].join()]),st=[m.cells[0]];
      while(st.length){const [a,b]=st.pop();for(const c of m.cells)if(Math.abs(c[0]-a)+Math.abs(c[1]-b)===1&&!seen.has(c.join())){seen.add(c.join());st.push(c);}}
      assert.equal(seen.size,m.cells.length,'cells must touch');
    }
  }
});
test('no chamber leaks: every wall between two chambers is covered by strip or pocket',()=>{
  for(const cfg of CFGS)for(let seed=1;seed<=30;seed++){
    const {geo,G,P}=run(Object.assign({},cfg,{sponges:0}),seed);
    const cov=(x,y)=>geo.pieces.some(p=>{const r=p.rect;return x>=r.x0-1e-6&&x<=r.x1+1e-6&&y>=r.y0-1e-6&&y<=r.y1+1e-6;});
    const id=geo.ch.id;
    for(let r=0;r<G.rows;r++)for(let c=0;c<G.cols;c++){
      if(c+1<G.cols&&id[r][c]!==id[r][c+1]){
        // sample along the shared wall, including right at both junctions
        for(const f of [0,0.25,0.75,1]){
          const y=G.ys[r]+(G.ys[r+1]-G.ys[r])*f;
          assert.ok(cov(G.xs[c+1],y),`gap on V wall ${r},${c+1} seed ${seed}`);
        }
      }
    }
    // every junction where two or more walls meet must be filled
    for(let j=1;j<G.rows;j++)for(let i=1;i<G.cols;i++){
      const s=new Set([id[j-1][i-1],id[j-1][i],id[j][i-1],id[j][i]]);
      if(s.size>1)assert.ok(cov(G.xs[i],G.ys[j]),`open junction ${j},${i} seed ${seed}`);
    }
    assert.ok(P.W>0);
  }
});
test('vents never land on a wall in an odd chamber',()=>{
  for(let seed=1;seed<=40;seed++){
    const {geo}=run({oddShare:1,oddMax:6},seed);
    for(const v of geo.vents)for(const p of geo.pieces){
      const r=p.rect;assert.ok(!(v.x>r.x0&&v.x<r.x1&&v.y>r.y0&&v.y<r.y1),`vent on ${p.id} seed ${seed}`);
    }
  }
});
test('v1 layouts convert to cell groups',()=>{
  const L=normalizeLayout({merges:[{r:1,c:2}]});
  assert.deepEqual(L.merges[0],{cells:[[1,2],[1,3],[2,2],[2,3]],brood:true});
});
