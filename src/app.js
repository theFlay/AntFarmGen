import {PARAMS,GEN_KEYS,ALL_FIELDS} from './params.js';
import {f1} from './util.js';
import {derive} from './grid.js';
import {chambers,interiorEdges,getEdge,setEdge,mergeOf} from './layout.js';
import {generate} from './generate.js';
import {buildGeometry} from './geometry.js';
import {checkRules} from './rules.js';
import {offsetPoly} from './offset.js';
import {stripOutline} from './strip.js';
import {drawTopdown} from './draw.js';
import {exporters} from './export.js';
function buildForm(){
  const root=document.getElementById('controls');
  let html='';
  for(const [name,open,fields] of PARAMS){
    html+=`<div class="card"><details${open?' open':''}><summary>${name}</summary>`;
    for(const f of fields){
      let input;
      if(f.opts) input=`<select id="p_${f.k}">${f.opts.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select>`;
      else if(f.bool) input=`<input type="checkbox" id="p_${f.k}">`;
      else if(f.color) input=`<input type="color" id="p_${f.k}">`;
      else input=`<input type="number" inputmode="decimal" id="p_${f.k}" step="${f.step||1}"${f.opt?' placeholder="auto"':''}>`;
      html+=`<div class="field"><label for="p_${f.k}">${f.l}</label>${input}${f.h?`<small>${f.h}</small>`:''}</div>`;
    }
    if(name==='Ants') html+=`<div class="derived" id="derived"></div>`;
    html+=`</details></div>`;
  }
  root.innerHTML=html;
  for(const f of ALL_FIELDS){
    const el=document.getElementById('p_'+f.k);
    setField(f,f.d);
    el.addEventListener('change',()=>onParamChange(f.k));
  }
}
function setField(f,v){
  const el=document.getElementById('p_'+f.k);
  if(f.bool) el.checked=!!v; else el.value=(v===null||v===undefined)?'':v;
}
function readParams(){
  const P={};
  for(const f of ALL_FIELDS){
    const el=document.getElementById('p_'+f.k);
    if(f.bool) P[f.k]=el.checked;
    else if(f.opts||f.color) P[f.k]=el.value;
    else{
      const s=el.value.trim();
      if(s===''){ P[f.k]=f.opt?null:f.d; }
      else{ const n=parseFloat(s); P[f.k]=isFinite(n)?n:(f.opt?null:f.d); }
    }
  }
  return P;
}
/* ---------------- app state ---------------- */
let P,G,L,geo,rules,tool='wall',history=[];
const TOOLHELP={
  wall:'Tap a wall to cycle solid, tunnel, sponge.',
  cell:'Tap a chamber to switch it on or off. Off chambers are sealed and their tunnels close.',
  merge:'Tap a cell to make it the top-left of a 2x2 brood chamber. Tap a brood chamber to split it.'
};
function snapshot(){history.push(JSON.stringify(L));if(history.length>60)history.shift();}
function regenerate(){if(L)snapshot();G=derive(P);L=generate(G,P);}
function onParamChange(k){
  P=readParams();
  const g=derive(P);
  if(GEN_KEYS.has(k)||!L||g.cols!==L.cols||g.rows!==L.rows){regenerate();}
  render();
}
function render(){
  G=derive(P);
  if(!L||L.cols!==G.cols||L.rows!==G.rows){L=generate(G,P);}
  geo=buildGeometry(G,L,P);
  rules=checkRules(G,L,P,geo);
  document.getElementById('preview').innerHTML=drawTopdown(G,L,P,geo,rules,{interactive:true,tool});
  document.getElementById('toolhelp').textContent=TOOLHELP[tool];
  document.getElementById('checks').innerHTML=rules.msgs.map(([lv,m])=>`<div class="msg ${lv}">${m}</div>`).join('');
  const act=geo.ch.list.filter(c=>c.active);
  let tunnels=0,spongesN=0;
  for(const e of interiorEdges(L,geo.ch)){const s=getEdge(L,e);if(s==='tunnel')tunnels++;if(s==='sponge')spongesN++;}
  const ex=exporters(G,L,P,geo);
  const stripLen=geo.pieces.reduce((a,p)=>a+(p.e-p.s),0);
  const st=[
    ['Grid',`${G.cols} x ${G.rows} cells`],['Cell size',`${f1(G.cellW)} x ${f1(G.cellH)} mm`],
    ['Chamber inside',`about ${f1(G.cellW-G.t)} x ${f1(G.cellH-G.t)} mm`],['Depth',`${f1(G.depth)} mm`],
    ['Tunnels',`${f1(G.tunnelW)} wide x ${f1(G.tunnelH)} high`],['Chambers active',`${act.length} of ${geo.ch.list.length}`],
    ['Tunnels / sponges',`${tunnels} / ${spongesN}`],['Strip parts',`${geo.pieces.length} (${f1(stripLen/1000)} m)`],
    ['Strip stock sheets',`${ex.stripSheets} at ${P.stockW} x ${P.stockH}`],['Frame',`${geo.frame.length} pieces x ${P.layers} layers`],
    ['Bolts',`${geo.bolts.length}`],['Ports cut',`${geo.ports.filter(p=>p.cut).length} (${geo.ports.filter(p=>p.cut&&p.active).length} live)`],
  ];
  document.getElementById('stats').innerHTML=st.map(([a,b])=>`<div><span>${a}:</span> ${b}</div>`).join('');
  document.getElementById('derived').textContent=`Pitch target ${f1(G.pitch)}mm, actual cells ${f1(G.cellW)} x ${f1(G.cellH)}mm, tunnels ${f1(G.tunnelW)}mm wide, depth ${f1(G.depth)}mm.${G.adjusted?' Cell count nudged so ports miss the walls.':''}`;
  const exDiv=document.getElementById('exports');
  exDiv.innerHTML=ex.files.map((f,i)=>`<button data-file="${i}"${rules.ok?'':' disabled'}>${f.name}</button>`).join('')+
    `<button id="zipAll" class="primary"${rules.ok&&window.JSZip?'':' disabled'}>All as .zip</button>`;
  exDiv._files=ex.files;
  if(!rules.ok)setStatus('Fix the errors in Checks to enable export.');
  else if(!window.JSZip)setStatus('Files can be saved one at a time (zip support did not load).');
  else setStatus('');
}
function setStatus(s){document.getElementById('status').textContent=s;}

/* ---------------- editing ---------------- */
function onPreviewClick(ev){
  const el=ev.target.closest('[data-edge],[data-cell]');if(!el)return;
  if(tool==='wall'&&el.dataset.edge){
    const [type,a,b]=el.dataset.edge.split(',');
    const e=type==='H'?{type,j:+a,k:+b}:{type,r:+a,i:+b};
    const cur=getEdge(L,e);if(cur==='none')return;
    snapshot();setEdge(L,e,{solid:'tunnel',tunnel:'sponge',sponge:'solid'}[cur]);render();return;
  }
  if(!el.dataset.cell)return;
  const [r,c]=el.dataset.cell.split(',').map(Number);
  if(tool==='cell'){
    snapshot();
    const ch=chambers(L),id=ch.id[r][c],cham=ch.list[id];
    const on=!cham.active;
    for(const [rr,cc] of cham.cells)L.active[rr][cc]=on;
    if(!on)for(const e of interiorEdges(L,ch))if((e.a===id||e.b===id)&&getEdge(L,e)!=='solid')setEdge(L,e,'solid');
    render();return;
  }
  if(tool==='merge'){
    const mi=mergeOf(L,r,c);
    snapshot();
    if(mi>=0){L.merges.splice(mi,1);render();return;}
    if(L.cols<2||L.rows<2){history.pop();return;}
    const r0=Math.min(r,L.rows-2),c0=Math.min(c,L.cols-2);
    if(L.merges.some(m=>Math.abs(m.r-r0)<2&&Math.abs(m.c-c0)<2)){history.pop();setStatus('That would overlap another brood chamber.');return;}
    L.merges.push({r:r0,c:c0});
    for(let dr=0;dr<2;dr++)for(let dc=0;dc<2;dc++)L.active[r0+dr][c0+dc]=true;
    render();
  }
}

/* ---------------- saving ---------------- */
let dlNS;
async function getDl(){
  if(dlNS!==undefined)return dlNS;
  try{dlNS=(window.claude&&typeof window.claude.use==='function')?await window.claude.use('downloads'):null;}catch(e){dlNS=null;}
  return dlNS;
}
async function saveFile(name,data){
  const d=await getDl();
  if(d){
    try{await d.save({filename:name,data});setStatus('Saved '+name+'.');}
    catch(e){setStatus(e&&e.code==='declined'?'Save cancelled.':'Could not save '+name+': '+((e&&(e.message||e.code))||'unknown error'));}
    return;
  }
  const blob=data instanceof Blob?data:new Blob([data],{type:name.endsWith('.json')?'application/json':'image/svg+xml'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
  setStatus('Downloaded '+name+'.');
}

/* ---------------- wiring ---------------- */
function init(){
  buildForm();
  P=readParams();
  render();
  document.getElementById('preview').addEventListener('click',onPreviewClick);
  document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{
    tool=b.dataset.tool;document.querySelectorAll('[data-tool]').forEach(x=>x.classList.toggle('on',x===b));render();
  }));
  document.getElementById('undo').addEventListener('click',()=>{if(!history.length){setStatus('Nothing to undo.');return;}L=JSON.parse(history.pop());render();});
  document.getElementById('regen').addEventListener('click',()=>{P=readParams();regenerate();render();});
  document.getElementById('reseed').addEventListener('click',()=>{
    const f=ALL_FIELDS.find(x=>x.k==='seed');setField(f,Math.floor(Math.random()*100000));P=readParams();regenerate();render();
  });
  document.getElementById('exports').addEventListener('click',async ev=>{
    const div=ev.currentTarget,b=ev.target.closest('button');if(!b||b.disabled)return;
    if(b.id==='zipAll'){
      try{
        const zip=new window.JSZip();for(const f of div._files)zip.file(f.name,f.data);
        zip.file('layout.json',layoutJSON());
        const blob=await zip.generateAsync({type:'blob'});
        await saveFile(`nest-${P.W}x${P.H}-seed${P.seed}.zip`,blob);
      }catch(e){setStatus('Zip failed: '+e.message);}
      return;
    }
    const f=div._files[+b.dataset.file];if(f)await saveFile(f.name,f.data);
  });
  document.getElementById('saveLayout').addEventListener('click',()=>saveFile(`nest-layout-${P.W}x${P.H}.json`,layoutJSON()));
  const fi=document.getElementById('loadLayout');
  document.getElementById('loadBtn').addEventListener('click',()=>fi.click());
  fi.addEventListener('change',async()=>{
    const file=fi.files[0];if(!file)return;
    try{
      const j=JSON.parse(await file.text());
      if(!j.layout||!j.params)throw new Error('not a layout file');
      for(const f of ALL_FIELDS)if(f.k in j.params)setField(f,j.params[f.k]);
      P=readParams();snapshot();L=j.layout;render();setStatus('Loaded '+file.name+'.');
    }catch(e){setStatus('Could not load: '+e.message);}
    fi.value='';
  });
  const s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  s.onload=()=>render();s.onerror=()=>{};
  document.head.appendChild(s);
}
function layoutJSON(){return JSON.stringify({app:'ant-nest-panel-generator',version:1,params:P,layout:L},null,1);}
window.__nest={get state(){return {P,G,L,geo,rules};},derive,generate,buildGeometry,checkRules,exporters,offsetPoly,stripOutline};
init();
