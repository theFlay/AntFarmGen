// Drives the built index.html in headless Chromium. Exits non-zero on any failure.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const url=pathToFileURL(resolve(process.argv[2]||'index.html')).href;
const browser=await chromium.launch();
let failed=0;
async function check(name,fn){
  const page=await browser.newPage({viewport:{width:1300,height:900}});
  const errs=[];
  page.on('pageerror',e=>errs.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>window.__nest);
  try{await fn(page);assert.deepEqual(errs,[]);console.log('ok  ',name);}
  catch(e){failed++;console.log('FAIL',name,'\n    ',e.message);}
  await page.close();
}
const Ljson=p=>p.evaluate(()=>JSON.stringify(window.__nest.state.L));
const clickSvg=async(p,sel)=>{const b=await (await p.$(sel)).boundingBox();await p.mouse.click(b.x+b.width/2,b.y+b.height/2);};
const setField=(p,id,v)=>p.$eval('#'+id,(e,v)=>{e.value=v;e.dispatchEvent(new Event('change'));},String(v));
// finds a cell that is outside every brood chamber and has room to merge
const freeCell=p=>p.evaluate(()=>{const L=window.__nest.state.L;
  const used=(r,c)=>L.merges.some(m=>m.cells.some(([a,b])=>a===r&&b===c));
  for(let r=0;r<L.rows-1;r++)for(let c=0;c<L.cols-1;c++)if(![[r,c],[r,c+1],[r+1,c],[r+1,c+1]].some(([a,b])=>used(a,b)))return [r,c];return null;});

await check('wall tool cycles an edge and undo restores it',async p=>{
  const before=await Ljson(p);
  await clickSvg(p,'[data-edge="H,1,0"]');
  assert.notEqual(await Ljson(p),before);
  await p.click('#undo');
  assert.equal(await Ljson(p),before);
});
await check('merge tool adds a brood chamber on a free cell',async p=>{
  const n=await p.evaluate(()=>window.__nest.state.L.merges.length);
  const [r,c]=await freeCell(p);
  await p.click('[data-tool="merge"]');
  await clickSvg(p,`[data-cell="${r},${c}"]`);
  assert.equal(await p.evaluate(()=>window.__nest.state.L.merges.length),n+1);
});
await check('merge tool splits an existing brood chamber',async p=>{
  const [r,c]=await p.evaluate(()=>window.__nest.state.L.merges[0].cells[0]);
  await p.click('[data-tool="merge"]');
  await clickSvg(p,`[data-cell="${r},${c}"]`);
  assert.equal(await p.evaluate(()=>window.__nest.state.L.merges.length),0);
});
await check('join tool joins two cells and splits them again',async p=>{
  const [r,c]=await freeCell(p);
  const n=await p.evaluate(()=>window.__nest.state.L.merges.length);
  await p.click('[data-tool="join"]');
  await clickSvg(p,`[data-cell="${r},${c}"]`);
  await clickSvg(p,`[data-cell="${r},${c+1}"]`);
  assert.equal(await p.evaluate(()=>window.__nest.state.L.merges.length),n+1);
  await clickSvg(p,`[data-cell="${r},${c}"]`);
  await clickSvg(p,`[data-cell="${r},${c}"]`);
  assert.equal(await p.evaluate(()=>window.__nest.state.L.merges.length),n);
});
await check('diagonal and jog tools need the toggle, then work, and undo restores them',async p=>{
  await p.click('[data-tool="diag"]');
  const [r,c]=await p.evaluate(()=>{const s=window.__nest.state,L=s.L;
    for(let r=1;r<L.rows-1;r++)for(let c=1;c<L.cols-1;c++)if(!L.merges.some(m=>m.cells.some(u=>u[0]===r&&u[1]===c)))return [r,c];});
  await clickSvg(p,`[data-cell="${r},${c}"]`);
  assert.equal(await p.evaluate(([r,c])=>window.__nest.state.L.diag[r][c],[r,c]),0);
  await p.$eval('#p_angled',e=>{e.checked=true;e.dispatchEvent(new Event('change'));});
  const cell=await p.evaluate(()=>{const L=window.__nest.state.L;
    for(let r=1;r<L.rows-1;r++)for(let c=1;c<L.cols-1;c++)if(!L.diag[r][c]&&!L.merges.some(m=>m.cells.some(u=>u[0]===r&&u[1]===c))&&!L.diag[r-1][c]&&!L.diag[r+1][c]&&!L.diag[r][c-1]&&!L.diag[r][c+1])return [r,c];});
  const before=await Ljson(p);
  await clickSvg(p,`[data-cell="${cell[0]},${cell[1]}"]`);
  assert.notEqual(await p.evaluate(([r,c])=>window.__nest.state.L.diag[r][c],cell),0);
  await p.click('#undo');
  assert.equal(await Ljson(p),before);
  await p.click('[data-tool="jog"]');
  const edge=await p.evaluate(()=>{const s=window.__nest.state,L=s.L;
    for(let j=1;j<L.rows;j++)for(let k=1;k<L.cols-1;k++)if(L.H[j][k]==='solid'&&!L.jogH[j][k]&&document.querySelector(`[data-edge="H,${j},${k}"]`))return [j,k];});
  const n=await p.evaluate(()=>window.__nest.state.geo.pieces.filter(q=>q.kind==='angle').length);
  await clickSvg(p,`[data-edge="H,${edge[0]},${edge[1]}"]`);
  assert.equal(await p.evaluate(()=>window.__nest.state.geo.pieces.filter(q=>q.kind==='angle').length),n+2);
});
await check('export buttons are enabled when rules pass, disabled on an error',async p=>{
  assert.equal(await p.evaluate(()=>window.__nest.state.rules.ok),true);
  assert.equal(await p.$eval('#exports button[data-file="0"]',b=>b.disabled),false);
  await setField(p,'p_tunnelH',11.5);
  assert.equal(await p.evaluate(()=>window.__nest.state.rules.ok),false);
  assert.equal(await p.$eval('#exports button[data-file="0"]',b=>b.disabled),true);
});
await check('undo restores the layout and settings after a grid change',async p=>{
  await clickSvg(p,'[data-edge="H,1,0"]');
  const edited=await Ljson(p);
  await setField(p,'p_W',500);
  assert.notEqual(await p.evaluate(()=>window.__nest.state.L.cols),JSON.parse(edited).cols);
  await p.click('#undo');
  assert.equal(await Ljson(p),edited);
  assert.equal(await p.$eval('#p_W',e=>e.value),'400');
});
await check('starting area tool changes door states but not the cut files',async p=>{
  const front=()=>p.evaluate(()=>{const s=window.__nest.state;return window.__nest.exporters(s.G,s.L,s.P,s.geo).files.find(f=>f.name==='front-sheet.svg').data;});
  const before=await front();
  await p.click('[data-tool="cell"]');
  await clickSvg(p,'[data-cell="3,0"]');
  assert.ok(await p.evaluate(()=>window.__nest.state.geo.doors.some(d=>d.closed)));
  assert.equal(await front(),before);
});
await check('test piece button works even with an error showing',async p=>{
  await setField(p,'p_tunnelH',11.5);
  const name=await p.evaluate(()=>{const s=window.__nest.state;return window.__nest.testPiece(s.G,s.P).name;});
  assert.equal(name,'test-piece.svg');
  assert.equal(await p.$eval('#testPiece',b=>b.disabled),false);
});
await browser.close();
if(failed){console.log(failed,'browser test(s) failed');process.exit(1);}
console.log('all browser tests passed');
