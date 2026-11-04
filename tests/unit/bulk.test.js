import test from 'node:test';
import assert from 'node:assert/strict';
import {run,files,CONFIGS,SEEDS} from './helpers.js';

for(const cfg of CONFIGS){
  test(`bulk ${JSON.stringify(cfg)}`,()=>{
    for(let seed=1;seed<=SEEDS;seed++){
      const r=run(cfg,seed);
      assert.deepEqual(r.errors,[],`seed ${seed}`);
      for(const f of files(r))assert.doesNotMatch(f.data,/NaN|undefined|Infinity/,`${f.name} seed ${seed}`);
    }
  });
}

test('every tab slot sits where its strip tab lands',()=>{
  for(const cfg of CONFIGS)for(let seed=1;seed<=10;seed++){
    const {geo,P}=run(cfg,seed);
    for(const [sheet,key] of [[geo.slotsFront,'top'],[geo.slotsBack,'bot']]){
      const want=[];
      for(const pc of geo.pieces)for(const u of pc[key]){
        const g=pc.s+u;
        want.push(pc.orient==='H'?[g,pc.c]:[pc.c,g]);
      }
      assert.equal(want.length,sheet.length);
      for(const [x,y] of want)assert.ok(sheet.some(s=>Math.abs((s.x0+s.x1)/2-x)<1e-6&&Math.abs((s.y0+s.y1)/2-y)<1e-6),`no slot at ${x},${y}`);
    }
    assert.ok(P.W>0);
  }
});
