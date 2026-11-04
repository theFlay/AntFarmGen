import test from 'node:test';
import assert from 'node:assert/strict';
import {run,files} from './helpers.js';
import {labelX} from '../../src/export.js';

test('strips with a tunnel have a tab each side of it on both edges',()=>{
  for(const cfg of [{},{W:300,H:500},{queenWidth:8}])for(let seed=1;seed<=40;seed++){
    const {geo}=run(cfg,seed);
    for(const pc of geo.pieces)for(const n of pc.notches){
      const u=n-pc.s;
      for(const edge of [pc.top,pc.bot]){
        assert.ok(edge.some(x=>x<u),`${pc.id} seed ${seed}: no tab before tunnel`);
        assert.ok(edge.some(x=>x>u),`${pc.id} seed ${seed}: no tab after tunnel`);
      }
    }
  }
});
test('tabs keep at least 3mm from the tunnel edge',()=>{
  for(let seed=1;seed<=40;seed++){
    const {geo,G,P}=run({},seed);
    for(const pc of geo.pieces)for(const n of pc.notches)for(const u of pc.top)
      assert.ok(Math.abs(u-(n-pc.s))-G.tunnelW/2-P.tabL/2>=3-1e-9);
  }
});
test('sponge parts are one size across horizontal and vertical walls',()=>{
  for(let seed=1;seed<=40;seed++){
    const {geo}=run({sponges:6},seed);
    assert.ok(new Set(geo.sponges.map(s=>s.Ls.toFixed(6))).size<=1,`seed ${seed}`);
  }
});
test('strips longer than the stock width are an error',()=>{
  const r=run({stockW:300,stockH:600});
  assert.ok(r.errors.some(e=>/too long for 300mm/.test(e)));
});
test('engraved IDs never land on a tunnel notch',()=>{
  const x=labelX(294.3,[68.2,109.3,150.4,191.5,232.6,273.7],7,'H1-2');
  assert.notEqual(x,null);
  for(const n of [68.2,109.3,150.4,191.5,232.6,273.7])assert.ok(Math.abs(n-x)>=3.5+'H1-2'.length*0.9);
});
test('sheet outlines stay inside the viewBox',()=>{
  for(const f of files(run()).filter(f=>/sheet/.test(f.name))){
    const m=f.data.match(/viewBox="(-?[\d.]+) (-?[\d.]+)/);
    assert.ok(+m[1]<=-0.5&&+m[2]<=-0.5,f.name);
  }
});
