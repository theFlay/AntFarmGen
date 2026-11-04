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
  for(let r=0;r<L.rows-1;r++)for(let c=0;c<L.cols-1;c++)if(!L.merges.some(m=>Math.abs(m.r-r)<2&&Math.abs(m.c-c)<2))return [r,c];return null;});

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
  const m=await p.evaluate(()=>window.__nest.state.L.merges[0]);
  await p.click('[data-tool="merge"]');
  await clickSvg(p,`[data-cell="${m.r},${m.c}"]`);
  assert.equal(await p.evaluate(()=>window.__nest.state.L.merges.length),0);
});
await check('export buttons are enabled when rules pass, disabled on an error',async p=>{
  assert.equal(await p.evaluate(()=>window.__nest.state.rules.ok),true);
  assert.equal(await p.$eval('#exports button[data-file="0"]',b=>b.disabled),false);
  await setField(p,'p_boltD',20);
  assert.equal(await p.evaluate(()=>window.__nest.state.rules.ok),false);
  assert.equal(await p.$eval('#exports button[data-file="0"]',b=>b.disabled),true);
});
await browser.close();
if(failed){console.log(failed,'browser test(s) failed');process.exit(1);}
console.log('all browser tests passed');
