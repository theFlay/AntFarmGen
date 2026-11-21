import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStarter,starterFiles,starterPreview,starterDefaults} from '../../src/starter.js';
import {RAIL,LUG,CAP_W} from '../../src/starterrow.js';

const B=c=>buildStarter({...starterDefaults(),layout:'row',...c});
function closed(tris){
  const key=v=>v.map(x=>x.toFixed(3)).join(','),m=new Map();let vol=0;
  for(const [a,b,c] of tris){
    for(const [p,q] of [[a,b],[b,c],[c,a]]){const e=key(p)+'>'+key(q);m.set(e,(m.get(e)||0)+1);}
    vol+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  }
  for(const [e,n] of m){const [p,q]=e.split('>');if((m.get(q+'>'+p)||0)!==n)return false;}
  return vol>0;
}
const CFGS=[{},{rows:3},{rows:2,spareOn:'back'},{countBy:'space',space:600},{chambers:2,towers:0},{chambers:1},
  {chambers:4,Wd:130},{feet:false,plugs:false},{lidOw:'glass',lidNest:'glass'},{rows:6,rowGap:60},{count:1}];

test('every row style builds cleanly, with closed prints and good files',()=>{
  for(const c of CFGS){
    const st=B(c);
    assert.deepEqual(st.errors,[],JSON.stringify(c));
    for(const it of st.prints)if(it.tris)assert.ok(closed(it.tris),it.name+' '+JSON.stringify(c));
    for(const f of starterFiles(st))if(!f.name.endsWith('.stl'))assert.doesNotMatch(f.data,/NaN|undefined|Infinity/,f.name);
    assert.doesNotMatch(starterPreview(st),/NaN|undefined|Infinity/);
  }
});
test('a row puts the outworld across the front, the ports in front and the tower on the back',()=>{
  const st=B({});
  assert.ok(st.ch.every(c=>c.y1<st.dy0));
  assert.deepEqual(st.sockets.map(s=>s.wall),['front','front']);
  assert.ok(st.towers[0].y1<=0);
  // the tower's grille faces the back chamber, the last door is away from the tower
  const back=st.ch[st.ch.length-1],t=st.towers[0];
  for(const x of t.slits)assert.ok(x>=back.x0&&x+st.S.grille<=back.x1);
  const last=st.doors[st.doors.length-1];
  assert.ok(last.x0>t.x1);
  // the spare port moves to the back when asked
  assert.deepEqual(B({spareOn:'back'}).sockets.map(s=>s.wall),['front','back']);
  assert.ok(B({cellW:50}).errors.some(e=>/side by side/.test(e)));
});
test('how many nests: a set number, or as many as fit',()=>{
  assert.equal(B({count:7}).row.n,7);
  const st=B({countBy:'space',space:600});
  assert.equal(st.row.n,Math.floor((600-2*CAP_W)/64));
  assert.ok(st.row.len<=600);
  assert.ok(B({countBy:'space',space:70}).errors.some(e=>/no room/.test(e)));
});
test('every nest has its own lids, and the counts follow the rows',()=>{
  const st=B({count:5,rows:3}),q=n=>st.prints.find(p=>p.name===n)?.qty;
  assert.ok(st.lids.every(l=>l.qty===15));
  assert.equal(q('starter row nest'),10);
  assert.equal(q('starter row nest mirrored'),5);
  assert.equal(q('starter row end with rails'),2);
  assert.equal(q('starter row end with slots mirrored'),1);
  assert.equal(q('starter row foot'),12);
  assert.equal(q('starter row leg'),24);
  assert.ok(starterFiles(st).some(f=>f.name==='starter-outworld-lid-x15.svg'));
  const one=B({});
  assert.ok(!one.prints.some(p=>/mirrored|leg/.test(p.name)));
  assert.ok(!B({feet:false}).prints.some(p=>/foot/.test(p.name)));
});
test('the rail fits its slot with clearance, inside the side wall',()=>{
  const st=B({}),{s,h,c}=RAIL;
  assert.ok(s+h+c<st.row.sw-1);
  for(const [,zt] of st.row.rails){
    assert.ok(zt>5);
    assert.ok(zt+c<st.row.capH);
  }
  // rails stay below the lid recesses
  assert.ok(st.row.rails[0][1]<st.owH-st.S.lidT);
  assert.ok(st.row.rails[1][1]<st.F+st.S.chH);
});
test('legs set the gap between rows, and the pins share each joint hole',()=>{
  const st=B({rows:2,rowGap:45});
  assert.equal(st.row.pitch,st.owH+45);
  assert.equal(st.row.legL,st.row.pitch-st.row.lugH);
  assert.ok(2*st.row.pinL<st.row.lugH);
  assert.ok(LUG.pin<LUG.pin+LUG.fit);
  assert.ok(B({rows:2,rowGap:15}).errors.some(e=>/lift the outworld lid/.test(e)));
});
test('a mirrored row above keeps the water towers clear',()=>{
  assert.equal(B({rows:2}).row.tubeMax,Infinity);
  const three=B({rows:3});
  assert.equal(three.row.tubeMax,2*three.row.pitch-three.F);
  const back=B({rows:2,spareOn:'back'});
  assert.equal(back.row.tubeMax,back.row.pitch-back.F);
  assert.ok(back.warnings.some(w=>/at most/.test(w)));
  // the mirrored nest is the same tray flipped
  const st=B({rows:2}),a=st.prints.find(p=>p.name==='starter row nest'),b=st.prints.find(p=>p.name==='starter row nest mirrored');
  assert.equal(a.tris.length,b.tris.length);
});
test('one tower at most in a row',()=>{
  assert.ok(B({towers:2}).errors.some(e=>/one water tower/.test(e)));
});
