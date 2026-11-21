import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStarter,starterFiles,starterPreview,tubeGauge,starterDefaults,GAUGE} from '../../src/starter.js';
import {meshBoxes} from '../../src/stl.js';

const B=c=>buildStarter({...starterDefaults(),...c});
const CFGS=[{},{tubeOn:'nest'},{towers:0},{towers:2},{chambers:1,towers:1},{chambers:2,towers:2},{chambers:4,L:150,Wd:120},
  {lidNest:'glass',lidOw:'glass'},{ventD:0},{plugs:false},{tubeOD:20,tubeID:17},{chH:12,owH:40},{L:80,Wd:70,owLen:28,chambers:2,hatch:false}];
function parse(u8){
  const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength),n=dv.getUint32(80,true),tris=[];
  assert.equal(u8.byteLength,84+50*n);
  for(let i=0;i<n;i++){const o=84+50*i+12,v=k=>[0,1,2].map(j=>dv.getFloat32(o+12*k+4*j,true));tris.push([v(0),v(1),v(2)]);}
  return tris;
}
// every edge is met by an edge running the other way as often, and the volume is positive
function closed(tris){
  const key=v=>v.map(x=>x.toFixed(3)).join(','),m=new Map();let vol=0;
  for(const [a,b,c] of tris){
    for(const [p,q] of [[a,b],[b,c],[c,a]]){const e=key(p)+'>'+key(q);m.set(e,(m.get(e)||0)+1);}
    vol+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  }
  for(const [e,n] of m){const [p,q]=e.split('>');if((m.get(q+'>'+p)||0)!==n)return {ok:false,vol};}
  return {ok:true,vol};
}

test('every starter nest style builds cleanly, with closed prints and good files',()=>{
  for(const c of CFGS){
    const st=B(c);
    assert.deepEqual(st.errors,[],JSON.stringify(c));
    const files=starterFiles(st);
    for(const f of files){
      if(f.name.endsWith('.stl')){const r=closed(parse(f.data));assert.ok(r.ok&&r.vol>0,f.name+' '+JSON.stringify(c));}
      else assert.doesNotMatch(f.data,/NaN|undefined|Infinity/,f.name);
    }
    assert.doesNotMatch(starterPreview(st),/NaN|undefined/);
  }
});
test('a box mesh is closed and has the right volume',()=>{
  const r=closed(meshBoxes([[0,0,0,10,10,10]],[[2,2,2,8,8,11],[4,-1,4,6,3,6]]));
  assert.ok(r.ok);
  assert.ok(Math.abs(r.vol-(1000-6*6*8-2*2*2))<1e-6);
});
test('the default tray is 100 x 100, with 3 chambers, one tower and two sockets',()=>{
  const st=B({});
  assert.equal(st.Lx,100);assert.equal(st.Ly,100);
  assert.equal(st.ch.length,3);assert.equal(st.towers.length,1);
  assert.deepEqual(st.sockets.map(s=>s.name),['test tube','spare port']);
  // the outworld door and one door between each pair of chambers
  assert.equal(st.doors.length,3);
  assert.equal(st.nestH,st.S.floor+st.S.chH+2*st.S.lidT);
});
test('doorways stay inside the tube opening and above the floor',()=>{
  for(const c of CFGS){
    const st=B(c);
    for(const s of st.sockets){
      const r=s.id/2+0.5;
      for(const [u0,z0,u1,z1] of s.steps){
        assert.ok(z0>=st.F-1e-9);
        for(const [u,z] of [[u0,z0],[u1,z0],[u0,z1],[u1,z1]])assert.ok(Math.hypot(u-s.uc,z-s.zc)<=r+1e-6,JSON.stringify(c));
      }
      // the bore keeps a wall under it
      assert.ok(s.zc-s.D/2>=1-1e-9);
    }
  }
});
test('the grille slits are the set width and face the damp chamber',()=>{
  const st=B({grille:0.6,towers:2});
  assert.equal(st.towers.length,2);
  st.towers.forEach((t,i)=>{
    const c=st.ch[st.ch.length-1-i];
    assert.ok(t.slits.length>=3);
    for(const y of t.slits){assert.ok(y>=c.y0&&y+0.6<=c.y1);assert.ok(y>=t.y0&&y+0.6<=t.y1);}
  });
});
test('lids drop into their recesses with the clearance',()=>{
  const st=B({lidClear:0.5,vents:'holes'}),{w,ledge,dx0,dx1,Lx,Ly}=st;
  const [ow,nest]=st.lids;
  assert.ok(Math.abs(ow.w-(dx0-w+2*ledge-0.5))<1e-9);
  assert.ok(Math.abs(nest.w-(Lx-w+ledge-dx1-0.5))<1e-9);
  assert.ok(Math.abs(ow.h-(Ly-2*w+2*ledge-0.5))<1e-9);
  assert.ok(ow.circles.length>0);
  assert.equal(nest.circles.length,0);
});
test('glass lids have no cut file, and plugs can be left out',()=>{
  const names=starterFiles(B({lidNest:'glass',lidOw:'glass',plugs:false})).map(f=>f.name);
  assert.deepEqual(names,['starter-nest-red-sheet.svg','print-starter-nest-tray.stl']);
  const all=starterFiles(B({})).map(f=>f.name);
  assert.ok(all.includes('starter-nest-lid.svg')&&all.includes('starter-outworld-lid.svg'));
  assert.ok(all.some(n=>/plug-16-4mm/.test(n))&&all.some(n=>/plug-12-4mm/.test(n)));
});
test('bad starter settings are caught',()=>{
  assert.ok(B({owH:10}).errors.some(e=>/at least as tall/.test(e)));
  assert.ok(B({chambers:4,Wd:50}).errors.length);
  assert.ok(B({towers:2,chambers:1}).errors.some(e=>/need at least/.test(e)));
  assert.ok(B({tubeID:17,tubeOD:16}).errors.some(e=>/inside diameter/.test(e)));
  assert.ok(B({owLen:150}).errors.some(e=>/nest is only/.test(e)));
  assert.ok(buildStarter({L:300,Wd:300},{printW:200,printD:200,printH:200}).errors.some(e=>/too big/.test(e)));
  assert.ok(B({grille:1.5}).warnings.some(w=>/grille/.test(w)));
});
test('the tube gauge is one closed plate with a hole for every size',()=>{
  const f=tubeGauge(),r=closed(parse(f.data));
  assert.equal(f.name,'print-tube-gauge.stl');
  assert.ok(r.ok&&r.vol>0);
  assert.equal(GAUGE.length,15);
});
test('the outworld lid has slits along its long sides and a feeding hatch with a window',()=>{
  const st=B({}),[ow]=st.lids;
  assert.equal(ow.holes.length,7);
  assert.equal(ow.circles.length,0);
  const names=starterFiles(st).map(f=>f.name);
  assert.ok(names.includes('starter-hatch-window.svg')&&names.includes('print-starter-feeding-hatch.stl'));
  const h=st.hatch;
  // the plug fits the hole, the window sits on a ledge over the view hole
  assert.ok(h.plug<h.hs&&h.view<h.plug&&h.win>h.view&&h.win<h.flange);
  assert.ok(closed(parse(starterFiles(st).find(f=>/hatch\.stl/.test(f.name)).data)).ok);
  // slits run along the long sides, clear of the hatch
  for(const p of ow.holes.slice(0,6)){const X=p.map(v=>v[0]);assert.ok(Math.max(...X)<ow.w/2-h.hs/2||Math.min(...X)>ow.w/2+h.hs/2);}
  assert.equal(B({vents:'holes'}).lids[0].holes.length,1);
  assert.ok(B({vents:'holes'}).lids[0].circles.length>0);
  assert.ok(B({hatchSize:40}).errors.some(e=>/feeding hatch/.test(e)));
  assert.ok(!starterFiles(B({lidOw:'glass'})).some(f=>/hatch|outworld-lid/.test(f.name)));
});
test('the nest recess holds a clear lid and a red sheet over it',()=>{
  const two=B({}),one=B({redSheet:false});
  assert.equal(two.nestH-one.nestH,two.S.lidT);
  assert.ok(two.lids.some(l=>l.name==='nest red sheet'));
  assert.ok(!one.lids.some(l=>l.name==='nest red sheet'));
});
