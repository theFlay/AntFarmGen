import test from 'node:test';
import assert from 'node:assert/strict';
import {run} from './helpers.js';
import {buildOutworld,outworldFiles} from '../../src/outworld.js';

const nest=run({});
const OW=(c,P=nest.P)=>buildOutworld({build:'printed',...c},P,nest.geo);
function closed(tris){
  const key=v=>v.map(x=>x.toFixed(3)).join(','),m=new Map();let vol=0;
  for(const [a,b,c] of tris){
    for(const [p,q] of [[a,b],[b,c],[c,a]]){const e=key(p)+'>'+key(q);m.set(e,(m.get(e)||0)+1);}
    vol+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  }
  for(const [e,n] of m){const [p,q]=e.split('>');if((m.get(q+'>'+p)||0)!==n)return false;}
  return vol>0;
}
const CFGS=[{},{pClips:true},{pRim:false},{lid:'open'},{lid:'slide',pClips:true},{owL:150,owW:120},{owL:400,owW:180,pClips:true},{tubesBack:0,tubesFront:0,tubesSide1:0,tubesSide2:0}];

test('every printed base style builds, with closed prints',()=>{
  for(const c of CFGS){
    const ow=OW(c);
    assert.deepEqual(ow.errors,[],JSON.stringify(c));
    for(const it of ow.prints.filter(p=>p.tris))assert.ok(closed(it.tris),it.name+' '+JSON.stringify(c));
    for(const f of outworldFiles(ow,{cutColor:'#f00',engraveColor:'#000'}))if(!f.name.endsWith('.stl'))assert.doesNotMatch(f.data,/NaN|undefined|Infinity/,f.name);
  }
});
test('walls in a printed base have no tabs, and there is no acrylic floor',()=>{
  const ow=OW({});
  assert.equal(ow.parts.some(p=>p.name==='floor'),false);
  for(const p of ow.parts){assert.equal(p.poly.length,4,p.name);assert.equal(p.holes.length,0,p.name);}
  // without a rim the walls keep their top tabs, which hold the lid
  for(const p of OW({pRim:false}).parts)assert.ok(p.poly.length>4,p.name);
  // the walls are shorter by the floor under the grooves, so their tops stay where they were
  const acr=buildOutworld({},nest.P,nest.geo),side=ow=>ow.parts.find(p=>p.name==='side wall 1');
  assert.ok(Math.abs(side(ow).h-(acr.Hl-2))<1e-9);
});
test('a rim lid is a plain sheet that drops into the recess, and an open top needs no lip ring',()=>{
  const ow=OW({}),lid=ow.lidParts[0];
  assert.equal(lid.holes.length,0);
  assert.ok(Math.abs(lid.w-(ow.outL-0.4))<1e-9&&Math.abs(lid.h-(ow.Wt-0.4))<1e-9);
  assert.ok(lid.circles.length>0);
  assert.equal(OW({lid:'open'}).lidParts.length,0);
  assert.equal(OW({lid:'slide'}).rim,false);
});
test('a base too big for the printer is split, and one too wide is an error',()=>{
  const big=OW({owL:400,owW:150});
  const pieces=big.prints.filter(p=>/^base piece/.test(p.name));
  assert.ok(pieces.length>=2);
  assert.ok(big.notes.some(n=>/split into/.test(n)));
  const small=OW({owL:150,owW:100});
  assert.ok(small.prints.some(p=>p.name==='base'));
  assert.ok(OW({owW:300}).errors.some(e=>/too big for the print area/.test(e)));
});
test('corner clips are four of one shape, and a hole up in the rim is caught',()=>{
  const ow=OW({pClips:true}),clip=ow.prints.find(p=>p.name==='corner clip');
  assert.equal(clip.qty,4);
  assert.ok(OW({owH:15,tubeOD:16}).errors.length>0);
});
