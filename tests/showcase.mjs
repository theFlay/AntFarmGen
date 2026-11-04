// Renders a few settings to tests/out for checking by eye.
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
mkdirSync('tests/out',{recursive:true});
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1300,height:1000},deviceScaleFactor:2});
await page.goto(pathToFileURL(resolve('index.html')).href);await page.waitForFunction(()=>window.__nest);
const set=(id,v)=>page.$eval('#'+id,(e,v)=>{e.value=v;e.dispatchEvent(new Event('change'));},String(v));
await page.$eval('#p_angled',e=>{e.checked=true;e.dispatchEvent(new Event('change'));});
await set('p_oddShare',0.3);await set('p_activeCount',10);
await (await page.$('#preview')).screenshot({path:'tests/out/showcase-angled.png'});
console.log(await page.$eval('#checks',e=>e.innerText));
// close-up of one diagonal and one jog, strips only, at high zoom
const close=await page.evaluate(()=>{
  const s=window.__nest.state,ps=s.geo.pieces;
  const rect=p=>`<path d="M${p.poly.map(v=>v.join(' ')).join(' L')} Z" fill="${p.kind==='angle'?'#e5484d':'#5b4fc4'}"/>`;
  const a=ps.filter(p=>p.kind==='angle');
  const pick=[a.find(p=>p.e>30),a.find(p=>p.e<12)];
  return pick.map(p=>{const cx=(p.rect.x0+p.rect.x1)/2,cy=(p.rect.y0+p.rect.y1)/2,h=p.e>30?34:14;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cx-h} ${cy-h} ${2*h} ${2*h}" width="640" height="640" style="background:#fff">${ps.map(rect).join('')}</svg>`;}).join('');
});
const p=await browser.newPage({viewport:{width:1300,height:650}});
await p.setContent('<body style="margin:0;display:flex;gap:8px;background:#ddd">'+close+'</body>');
await p.screenshot({path:'tests/out/showcase-joints.png'});
await browser.close();
