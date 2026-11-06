import test from 'node:test';
import assert from 'node:assert/strict';
import {run} from './helpers.js';
import {buildOutworld,outworldFiles,outworldPreview,tubeHoleTest,dockablePorts,nestHeights,cleanOut} from '../../src/outworld.js';
import {borderRow} from '../../src/heat.js';
import {spread} from '../../src/rack.js';
import {FOOT_LIFT} from '../../src/hardware.js';

const nest=run({},1);
const OW=(c={},r=nest)=>buildOutworld(c,r.P,r.geo);
const CFGS=[{},{lid:'slide'},{lid:'open'},{connect:'direct'},{connect:'direct',lid:'slide'},{connect:'direct',lid:'open'},
  {connect:'none'},{tubes:3,bulkheads:2},{nestDock:false},{owL:120,owW:120,owH:40},{owL:400,owW:250,owH:150},{ventCols:0}];
// height above the bench of the bottom of a cut in a wall
const b2z=(wall,b)=>wall.H-(b[3]-wall.oy);
const part=(ow,n)=>[...ow.parts,...ow.lidParts,...ow.conn].filter(p=>p.name===n);
const bounds=pts=>{const X=pts.map(p=>p[0]),Y=pts.map(p=>p[1]);return [Math.min(...X),Math.min(...Y),Math.max(...X),Math.max(...Y)];};
test('every outworld style builds cleanly and exports good files',()=>{
  for(const c of CFGS){
    const ow=OW(c);
    assert.deepEqual(ow.errors,[],JSON.stringify(c));
    const f=outworldFiles(ow,{cutColor:'#ff0000',engraveColor:'#000000'});
    assert.ok(f.some(x=>/^outworld-box(-1)?.svg$/.test(x.name)));
    for(const x of f)assert.doesNotMatch(x.data,/NaN|undefined|Infinity/,x.name);
    assert.doesNotMatch(outworldPreview(ow),/NaN|undefined/);
  }
  assert.doesNotMatch(tubeHoleTest({},nest.P).data,/NaN|undefined/);
});
test('the box has two side walls, two end walls and a floor, with a lid to suit',()=>{
  assert.equal(OW().parts.length,5);
  assert.equal(part(OW(),'lid').length,1);
  assert.equal(part(OW({lid:'open'}),'lip ring').length,1);
  assert.equal(part(OW({lid:'slide'}),'sliding lid').length,1);
  assert.equal(part(OW({lid:'slide'}),'front wall with lid slot').length,1);
});
test('the floor and a lift-off lid have a tab or slot for every joint',()=>{
  for(const lid of ['lift','open']){
    const ow=OW({lid}),floor=part(ow,'floor')[0];
    const joints=2*spread(ow.L,10).length+2*spread(ow.W,10).length;
    assert.equal((floor.poly.length-4)/4,joints,'floor tabs');
    assert.equal(ow.lidParts[0].holes.length,joints+(lid==='open'?1:0),lid);
  }
});
test('tube holes are the tube size plus clearance, just above the floor',()=>{
  const ow=OW({tubes:3,tubeOD:10,tubeClear:-0.2});
  const wall=part(ow,'port wall')[0];
  assert.equal(wall.circles.length,3);
  for(const c of wall.circles)assert.equal(c[2],9.8);
  for(const [,z,d] of ow.portHoles)assert.ok(z-d/2>=ow.floorTop);
});
test('a dock window lines up with the nest port, and bars reach its joining slots',()=>{
  const ow=OW({connect:'direct'}),NH=nestHeights(nest.P);
  const wall=part(ow,'port wall')[0];
  const win=wall.holes.map(bounds).find(b=>Math.abs(b[2]-b[0]-nest.G.tunnelW)<1e-6);
  assert.ok(win,'window as wide as the tunnel');
  assert.ok(Math.abs((win[3]-win[1])-(NH.portTop-Math.max(NH.portBot,ow.floorTop)))<1e-6);
  const slits=wall.holes.map(bounds).filter(b=>Math.abs(b[3]-b[1]-(nest.P.t+0.2))<1e-6&&b[2]-b[0]>10);
  assert.equal(slits.length,2);
  assert.ok(Math.abs((slits[1][0]+slits[1][2])/2-(slits[0][0]+slits[0][2])/2-nest.P.portPitch)<1e-6);
  // the pin hole sits as far in from the wall's outer face as the nest's joining slots sit from its edge
  const bar=part(ow,'dock bar')[0],[pin,key]=bar.holes.map(bounds);
  assert.ok(Math.abs(key[0]-(pin[0]+pin[2])/2-(borderRow(nest.P)+nest.P.t))<1e-6);
  assert.equal(part(ow,'dock pin').length,2);
  assert.equal(part(ow,'dock key').length,2);
});
test('a tube dock is cut for each tube, holding the tube level with the port',()=>{
  const ow=OW({tubes:2}),NH=nestHeights(nest.P),docks=part(ow,'tube dock');
  assert.equal(docks.length,2);
  const [cx,cy,d]=docks[0].circles[0];
  assert.ok(Math.abs(docks[0].h-cy-(NH.portBot+NH.portTop)/2)<1e-6);
  assert.equal(d,12);
  assert.equal(part(OW({nestDock:false}),'tube dock').length,0);
});
const up=run({orient:'upright'},1);
test('an upright nest docks at its lowest side port by default, with edge clips',()=>{
  const ow=OW({connect:'direct'},up),NH=nestHeights(up.P);
  assert.deepEqual(ow.errors,[]);
  const low=up.geo.ports.filter(p=>p.cut&&(p.side==='left'||p.side==='right')).sort((a,b)=>b.pos-a.pos)[0];
  assert.equal(ow.dock.port.id,low.id);
  assert.equal(ow.dock.zc,FOOT_LIFT+up.P.H-low.pos);
  assert.equal(part(ow,'edge clip').length,2);
  assert.equal(part(ow,'dock bar').length,0);
  // the window is the port seen end on: the nest depth wide and a tunnel tall
  const wall=part(ow,'port wall')[0],holes=wall.holes.map(bounds);
  const win=holes.find(b=>Math.abs(b[2]-b[0]-up.G.depth)<1e-6);
  assert.ok(win);
  assert.ok(Math.abs(b2z(wall,win)-(ow.dock.zc-up.G.tunnelW/2))<1e-6,'window bottom at the port');
  // four arm slits, two per clip, and the clip gap is the nest thickness less the grip
  const slits=holes.filter(b=>Math.abs(b[3]-b[1]-(up.P.t+0.2))<1e-6&&b[2]-b[0]<6);
  assert.equal(slits.length,4);
  const clip=part(ow,'edge clip')[0],ys=clip.poly.map(p=>p[1]);
  assert.ok(Math.abs(clip.h-(NH.stack-0.2+8))<1e-6);
  assert.ok(ys.includes(4)&&ys.some(y=>Math.abs(y-(4+NH.stack-0.2))<1e-6));
});
test('an upright nest can dock at a chosen port, and a high port needs a taller box',()=>{
  const side=up.geo.ports.filter(p=>p.cut&&(p.side==='left'||p.side==='right')).sort((a,b)=>a.pos-b.pos);
  const n=+side[0].id.slice(1),ow=OW({connect:'direct',dockPort:n},up);
  assert.equal(ow.dock.port.id,side[0].id);
  assert.match(ow.errors.join(),/at least \d+mm tall/);
  assert.deepEqual(OW({connect:'direct',dockPort:n,owH:250},up).errors,[]);
  const top=up.geo.ports.find(p=>p.side==='top'&&p.cut);
  assert.match(OW({connect:'direct',dockPort:+top.id.slice(1)},up).errors.join(),/not a port on the left or right/);
});
test('an upright tube dock uses edge clips, so it needs no joining slots',()=>{
  const ow=OW({},run({orient:'upright',joinSlots:false},1));
  assert.deepEqual(ow.errors,[]);
  assert.equal(part(ow,'tube dock').length,1);
  assert.equal(part(ow,'edge clip').length,2);
  assert.equal(part(ow,'dock pin').length,0);
});
test('docking is refused where it cannot work',()=>{
  assert.match(OW({connect:'direct',owW:60}).errors.join(),/at least/);
  assert.match(OW({connect:'direct',owW:40},run({orient:'upright',layers:10},1)).errors.join(),/at least/);
  assert.match(OW({connect:'direct'},run({joinSlots:false},1)).errors.join(),/joining slots/);
  assert.match(OW({tubeOD:20}).errors.join(),/too big for the nest dock/);
  assert.match(OW({owL:700}).errors.join(),/too big for the/);
  assert.match(OW({tubes:4,owW:40}).errors.join(),/do not fit/);
});
test('docks only offer ports with a joining slot each side',()=>{
  const ok=dockablePorts(nest.P,nest.geo),h=nest.P.portPitch/2;
  assert.ok(ok.length>0);
  for(const p of ok)for(const q of [p.pos-h,p.pos+h])assert.ok(nest.geo.joints.some(j=>j.side===p.side&&Math.abs(j.pos-q)<1e-3));
});
test('warnings for an open top, big vents and a thin tube',()=>{
  const w=c=>OW(c).warnings.join(' ');
  assert.match(w({lid:'open'}),/Fluon/);
  assert.match(w({ventD:3}),/2mm/);
  assert.match(w({tubeID:4,tubeOD:6}),/narrower/);
});
test('junk outworld settings fall back to safe values',()=>{
  const O=cleanOut({owL:'<b>',lid:'roof',tubes:99,nestDock:'yes'});
  assert.equal(O.owL,250);assert.equal(O.lid,'lift');assert.equal(O.tubes,4);assert.equal(O.nestDock,false);
});
