// Checks the published site in a real browser. Waits for GitHub Pages to finish building.
import {chromium} from 'playwright';
const url='https://theflay.github.io/AntFarmGen/';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let res;
for(let i=0;i<40;i++){
  res=await fetch(url+'?check='+Date.now(),{cache:'no-store'}).catch(()=>null);
  if(res&&res.ok&&(await res.clone().text()).includes('Suggest an idea'))break;
  res=null;await wait(8000);
}
if(!res){console.log('site never came up');process.exit(1);}
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1300,height:900}});
const errs=[],external=[];
p.on('pageerror',e=>errs.push(e.message));
p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
p.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
await p.goto(url);await p.waitForFunction(()=>window.__nest);
const checks=await p.$eval('#checks',e=>e.innerText.split('\n')[0]);
const links=await p.$$eval('footer a',a=>a.map(x=>x.href));
const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#zipAll')]);
console.log(JSON.stringify({status:res.status,checks,links,zip:dl.suggestedFilename(),errors:errs,externalRequests:external,csp:!!(await p.$('meta[http-equiv="Content-Security-Policy"]'))},null,1));
await b.close();
process.exit(errs.length||external.length?1:0);
