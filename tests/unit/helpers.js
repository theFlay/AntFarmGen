import {ALL_FIELDS} from '../../src/params.js';
import {derive} from '../../src/grid.js';
import {generate} from '../../src/generate.js';
import {buildGeometry} from '../../src/geometry.js';
import {checkRules} from '../../src/rules.js';
import {exporters} from '../../src/export.js';

export const defaults=()=>Object.fromEntries(ALL_FIELDS.map(f=>[f.k,f.d]));

export function run(cfg={},seed=1){
  const P=Object.assign(defaults(),cfg,{seed});
  const G=derive(P),L=generate(G,P),geo=buildGeometry(G,L,P),rules=checkRules(G,L,P,geo);
  return {P,G,L,geo,rules,errors:rules.msgs.filter(m=>m[0]==='error').map(m=>m[1])};
}
export function files(r){return exporters(r.G,r.L,r.P,r.geo).files;}

export const CONFIGS=[
  {},{W:300,H:500},{W:200,H:500},{brood:3},{activeCount:8,growFrom:'center'},
  {sponges:8,dampSide:'none'},{W:500,H:300,loops:0.5},{workerLen:6,W:200,H:200,spongeLen:14},
  {brood:0,sponges:0},{fillSide:'both'},{activeCount:5,brood:2},{activeCount:3,growFrom:'top'},
  {activeCount:12,growFrom:'center',brood:2,W:300,H:500},{workerLen:20,pitchFactor:2.5},
];
export const SEEDS=40;
