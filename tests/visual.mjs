// Renders the preview and every exported SVG to tests/out for a human to look at.
// Cut lines are thickened here only; the exported files keep their hairline strokes.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const out=resolve('tests/out');mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1300,height:900}});
await page.goto(pathToFileURL(resolve(process.argv[2]||'index.html')).href);
await page.waitForFunction(()=>window.__nest);
await (await page.$('#preview')).screenshot({path:resolve(out,'preview.png')});
const files=await page.evaluate(()=>{const s=window.__nest.state;return window.__nest.exporters(s.G,s.L,s.P,s.geo).files;});
for(const f of files){
  if(typeof f.data!=='string')continue;   // STL prints are binary, with nothing to draw
  writeFileSync(resolve(out,f.name),f.data);
  const svg=f.data.replace(/<\?xml[^>]*>/,'').replace(/width="[\d.]+mm" height="[\d.]+mm"/,'style="width:1400px;height:auto"').replace(/stroke-width="0\.01"/g,'stroke-width="0.25"');
  const p=await browser.newPage({viewport:{width:1400,height:900}});
  await p.setContent(`<body style="margin:0;background:#fff">${svg}</body>`);
  await p.screenshot({path:resolve(out,f.name.replace('.svg','.png')),fullPage:true});
  await p.close();
}
console.log(files.map(f=>`${f.name} ${f.data.length}`).join('\n'));
await browser.close();
