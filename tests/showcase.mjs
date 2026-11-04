// Renders a few settings to tests/out for checking by eye.
import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1300,height:1000}});
await page.goto(pathToFileURL(resolve('index.html')).href);await page.waitForFunction(()=>window.__nest);
const set=(id,v)=>page.$eval('#'+id,(e,v)=>{e.value=v;e.dispatchEvent(new Event('change'));},String(v));
await set('p_oddShare',0.6);await set('p_orient','upright');await set('p_activeCount',10);
await (await page.$('#preview')).screenshot({path:'tests/out/showcase-odd-upright.png'});
console.log(await page.$eval('#checks',e=>e.innerText));
const svg=await page.evaluate(()=>{const s=window.__nest.state;return window.__nest.testPiece(s.G,s.P).data;});
const p=await browser.newPage({viewport:{width:1400,height:1000}});
await p.setContent('<body style="margin:0;background:#fff">'+svg.replace(/<\?xml[^>]*>/,'').replace(/width="[\d.]+mm" height="[\d.]+mm"/,'style="width:1400px;height:auto"').replace(/stroke-width="0\.01"/g,'stroke-width="0.2"')+'</body>');
await p.screenshot({path:'tests/out/test-piece.png'});
await browser.close();
