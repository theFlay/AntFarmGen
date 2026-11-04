import {PARAMS,GEN_KEYS,ALL_FIELDS} from './params.js';
import {f1} from './util.js';
import {derive} from './grid.js';
import {chambers,interiorEdges,getEdge,setEdge,mergeOf,broodCells,normalizeLayout,addDiagonal,removeDiagonal,setActive} from './layout.js';
import {generate} from './generate.js';
import {buildGeometry} from './geometry.js';
import {checkRules} from './rules.js';
import {offsetPoly} from './offset.js';
import {stripOutline} from './strip.js';
import {drawTopdown} from './draw.js';
import {exporters,testPiece} from './export.js';
import {portCells} from './generate.js';
import {cleanLayout,cleanParam,escapeHtml} from './sanitize.js';
import JSZip from 'jszip';
function buildForm(){
  const root=document.getElementById('controls');
  let html='';
  for(const [name,open,fields] of PARAMS){
    html+=`<div class="group"><details${open?' open':''}><summary>${name}</summary>`;
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
    else if(f.opts||f.color) P[f.k]=cleanParam(f,el.value);
    else{
      const s=el.value.trim();
      P[f.k]=cleanParam(f,s===''?null:parseFloat(s));
    }
  }
  return P;
}
/* ---------------- app state ---------------- */
let P,G,L,geo,rules,tool='wall',history=[],joinFrom=null;
const TOOLHELP={
  wall:'Tap a wall to cycle solid, tunnel, sponge.',
  cell:'Tap a chamber to add it to, or remove it from, the starting area. Everything is still cut; this only sets which doors start closed.',
  merge:'Tap a cell to make it the top-left of a 2x2 brood chamber. Tap a brood chamber to split it.',
  join:'Tap a cell, then a touching cell, to join their chambers. Tap the same cell twice to split it.',
  diag:'Tap a cell to cycle no diagonal, / and \\. Each half joins a neighbouring chamber. Needs Angled shapes on.',
  jog:'Tap a solid wall to step it sideways one way, then the other, then back. Needs Angled shapes on.',
  sensor:'Tap a cell to add or remove a sensor pocket. It sits in a corner with two solid walls.',
  pillar:'Tap a cell to add or remove a support pillar.',
  frost:'Tap a cell to add or remove frosting. Set a sheet to Chosen cells under Frosting.'
};
function snapshot(p=P){history.push(JSON.stringify({L,P:p}));if(history.length>60)history.shift();}
function regenerate(prev=P){if(L)snapshot(prev);G=derive(P);L=generate(G,P);}
function onParamChange(k){
  const prev=P;
  P=readParams();
  const g=derive(P);
  if(GEN_KEYS.has(k)||!L||g.cols!==L.cols||g.rows!==L.rows){regenerate(prev);}
  render();
}
function render(){
  G=derive(P);
  if(!L||L.cols!==G.cols||L.rows!==G.rows){L=generate(G,P);}
  geo=buildGeometry(G,L,P);
  rules=checkRules(G,L,P,geo);
  document.getElementById('preview').innerHTML=drawTopdown(G,L,P,geo,rules,{interactive:true,tool});
  document.getElementById('toolhelp').textContent=TOOLHELP[tool];
  document.getElementById('checks').innerHTML=rules.msgs.map(([lv,m])=>`<div class="msg ${lv}">${escapeHtml(m)}</div>`).join('');
  const act=geo.ch.list.filter(c=>c.active);
  let tunnels=0,spongesN=0;
  for(const e of interiorEdges(L,geo.ch)){const s=getEdge(L,e);if(s==='tunnel')tunnels++;if(s==='sponge')spongesN++;}
  const ex=exporters(G,L,P,geo);
  const stripLen=geo.pieces.reduce((a,p)=>a+(p.e-p.s),0);
  const st=[
    ['Grid',`${G.cols} x ${G.rows} cells`],['Cell size',`${f1(G.cellW)} x ${f1(G.cellH)} mm`],
    ['Chamber inside',`about ${f1(G.cellW-G.t)} x ${f1(G.cellH-G.t)} mm`],['Depth',`${f1(G.depth)} mm`],
    ['Tunnels',`${f1(G.tunnelW)} wide x ${f1(G.tunnelH)} high`],['Open at start',`${act.length} of ${geo.ch.list.length} chambers`],
    ['Tunnels / sponges',`${tunnels} / ${spongesN}`],['Strip parts',`${geo.pieces.length} (${f1(stripLen/1000)} m)`],
    ['Wall sheets',`${ex.stripSheets} at ${P.stockW} x ${P.stockH}`],['Frame',`${geo.frame.length} pieces x ${P.layers} layers`],
    ['Ports that always line up',lineUp()],['Doors',`${geo.doors.length} (${geo.doors.filter(d=>d.closed).length} start closed)`],['Fasteners',`${geo.fasteners.length} ${P.fastener==='peg'?'pegs and keys':P.fastener==='bolt'?'bolts':''}`],['Ports cut',`${geo.ports.filter(p=>p.cut).length} (${geo.ports.filter(p=>p.cut&&p.active).length} live)`],
  ];
  document.getElementById('stats').innerHTML=st.map(([a,b])=>`<div${a.startsWith('Ports that')?' class="wide"':''}><span>${escapeHtml(a)}:</span> ${escapeHtml(b)}</div>`).join('');
  document.getElementById('derived').textContent=`Pitch target ${f1(G.pitch)}mm, actual cells ${f1(G.cellW)} x ${f1(G.cellH)}mm, tunnels ${f1(G.tunnelW)}mm wide, depth ${f1(G.depth)}mm.${G.adjusted?' Cell count nudged so ports miss the walls.':''}`;
  const exDiv=document.getElementById('exports');
  exDiv.innerHTML=`<button id="zipAll" class="primary"${rules.ok?'':' disabled'}>Download everything (.zip)</button>`+
    ex.files.map((f,i)=>`<button data-file="${i}"${rules.ok?'':' disabled'}>${f.name}</button>`).join('');
  const errs=rules.msgs.filter(m=>m[0]==='error').length,warns=rules.msgs.filter(m=>m[0]==='warn').length;
  const pill=document.getElementById('pill');
  pill.className='pill '+(errs?'bad':warns?'warn':'good');
  pill.textContent=errs?`${errs} problem${errs>1?'s':''} to fix`:warns?`Ready, ${warns} warning${warns>1?'s':''}`:'Ready to export';
  exDiv._files=ex.files;
  if(!rules.ok)setStatus('Fix the errors in Checks to enable export.');
  else setStatus('');
}
// ports that stay cut on any layout with these settings, so two panels can always connect
function lineUp(){
  const by={};for(const p of portCells(G,P))(by[p.side]=by[p.side]||[]).push(p.pos);
  return Object.entries(by).map(([s,v])=>`${s} ${v.join(', ')}`).join('; ')||'none';
}
function setStatus(s){document.getElementById('status').textContent=s;}

/* ---------------- editing ---------------- */
function onPreviewClick(ev){
  const el=ev.target.closest('[data-edge],[data-cell]');if(!el)return;
  if(tool==='wall'&&el.dataset.edge){
    const [type,a,b]=el.dataset.edge.split(',');
    const e=type==='H'?{type,j:+a,k:+b}:{type,r:+a,i:+b};
    const cur=getEdge(L,e);if(cur==='none')return;
    snapshot();if(e.type==='H')L.jogH[e.j][e.k]=0;else L.jogV[e.r][e.i]=0;setEdge(L,e,{solid:'tunnel',tunnel:'sponge',sponge:'solid'}[cur]);render();return;
  }
  if(tool==='jog'&&el.dataset.edge){
    if(!P.angled){setStatus('Turn on Angled shapes first.');return;}
    const [type,a,b]=el.dataset.edge.split(',');
    const e=type==='H'?{type,j:+a,k:+b}:{type,r:+a,i:+b};
    if(getEdge(L,e)!=='solid'){setStatus('Only solid walls can jog.');return;}
    const m=e.type==='H'?L.jogH[e.j]:L.jogV[e.r],k=e.type==='H'?e.k:e.i;
    const size=Math.min(P.jogSize,Math.min(G.cellW,G.cellH)/5);
    if(size<6){setStatus('Jogs need at least 6mm, so these cells or this jog size are too small.');return;}
    snapshot();m[k]=m[k]===0?size:m[k]>0?-size:0;render();return;
  }
  if(!el.dataset.cell)return;
  const parts=el.dataset.cell.split(','),r=+parts[0],c=+parts[1],half=parts[2];
  if(tool==='cell'){
    snapshot();
    const ch=chambers(L),cham=ch.list[ch.of(r,c,half)];
    const on=!cham.active;
    for(const u of cham.cells)setActive(L,u,on);
    render();return;
  }
  if(tool==='sensor'||tool==='pillar'||tool==='frost'){
    const list=tool==='sensor'?L.sensors:tool==='pillar'?L.pillars:L.frost;
    snapshot();
    const i=list.findIndex(u=>u[0]===r&&u[1]===c);
    if(i>=0)list.splice(i,1);else list.push([r,c]);
    render();return;
  }
  if(tool==='diag'){
    if(!P.angled){setStatus('Turn on Angled shapes first.');return;}
    const was=L.diag[r][c];
    const saved=JSON.stringify(L);
    if(was)removeDiagonal(L,r,c);
    const next=(was+1)%3;
    if(next&&!addDiagonal(L,r,c,next)&&!addDiagonal(L,r,c,next===1?2:0)){
      if(!was){L=JSON.parse(saved);setStatus('That cell cannot take a diagonal: it needs a free cell, with a whole neighbour for each half.');return;}
    }
    history.push(JSON.stringify({L:JSON.parse(saved),P}));render();return;
  }
  if(tool==='join'){
    if(L.diag[r][c]){setStatus('Cells with a diagonal cannot be joined by hand.');return;}
    if(!joinFrom){joinFrom=[r,c];setStatus('Now tap a touching cell, or the same cell to split.');return;}
    const [a,b]=joinFrom;joinFrom=null;
    if(a===r&&b===c){
      const mi=mergeOf(L,r,c);
      if(mi>=0){snapshot();L.merges.splice(mi,1);render();}else setStatus('');
      return;
    }
    const ch=chambers(L),ca=ch.list[ch.id[a][b]],cb=ch.list[ch.id[r][c]];
    if(ca.id===cb.id){setStatus('Those cells are already one chamber.');return;}
    const touching=ca.cells.some(([x,y])=>cb.cells.some(([p,q])=>Math.abs(x-p)+Math.abs(y-q)===1));
    if(!touching){setStatus('Those chambers do not touch.');return;}
    snapshot();
    const keep=[...ca.cells,...cb.cells];
    L.merges=L.merges.filter((m,i)=>i!==mergeOf(L,a,b)&&i!==mergeOf(L,r,c));
    L.merges.push({cells:keep,brood:ca.brood||cb.brood});
    const on=ca.active&&cb.active;for(const u of keep)setActive(L,u,on);
    render();return;
  }
  if(tool==='merge'){
    if(L.diag[r][c]){setStatus('That cell has a diagonal.');return;}
    const mi=mergeOf(L,r,c);
    snapshot();
    if(mi>=0){L.merges.splice(mi,1);render();return;}
    if(L.cols<2||L.rows<2){history.pop();return;}
    const r0=Math.min(r,L.rows-2),c0=Math.min(c,L.cols-2);
    if(broodCells(r0,c0).some(([a,b])=>mergeOf(L,a,b)>=0||L.diag[a][b])){history.pop();setStatus('That would overlap another joined chamber.');return;}
    L.merges.push({cells:broodCells(r0,c0),brood:true});
    for(const u of broodCells(r0,c0))setActive(L,u,true);
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
    tool=b.dataset.tool;joinFrom=null;document.querySelectorAll('[data-tool]').forEach(x=>x.classList.toggle('on',x===b));render();
  }));
  document.getElementById('undo').addEventListener('click',()=>{if(!history.length){setStatus('Nothing to undo.');return;}const h=JSON.parse(history.pop());
    L=h.L;P=h.P;for(const f of ALL_FIELDS)setField(f,P[f.k]);render();});
  document.getElementById('regen').addEventListener('click',()=>{P=readParams();regenerate();render();});
  document.getElementById('reseed').addEventListener('click',()=>{
    const f=ALL_FIELDS.find(x=>x.k==='seed');setField(f,Math.floor(Math.random()*100000));P=readParams();regenerate();render();
  });
  document.getElementById('exports').addEventListener('click',async ev=>{
    const div=ev.currentTarget,b=ev.target.closest('button');if(!b||b.disabled)return;
    if(b.id==='zipAll'){
      try{
        const zip=new JSZip();for(const f of div._files)zip.file(f.name,f.data);
        zip.file('layout.json',layoutJSON());
        const blob=await zip.generateAsync({type:'blob'});
        await saveFile(`nest-${P.W}x${P.H}-seed${P.seed}.zip`,blob);
      }catch(e){setStatus('Zip failed: '+e.message);}
      return;
    }
    const f=div._files[+b.dataset.file];if(f)await saveFile(f.name,f.data);
  });
  document.getElementById('testPiece').addEventListener('click',()=>{const f=testPiece(G,P);saveFile(f.name,f.data);});
  document.getElementById('saveLayout').addEventListener('click',()=>saveFile(`nest-layout-${P.W}x${P.H}.json`,layoutJSON()));
  const fi=document.getElementById('loadLayout');
  document.getElementById('loadBtn').addEventListener('click',()=>fi.click());
  fi.addEventListener('change',async()=>{
    const file=fi.files[0];if(!file)return;
    try{
      const j=JSON.parse(await file.text());
      if(!j.layout||!j.params)throw new Error('not a layout file');
      if(typeof j.params!=='object')throw new Error('settings are missing');
      const np=Object.fromEntries(ALL_FIELDS.map(f=>[f.k,f.k in j.params?cleanParam(f,j.params[f.k]):P[f.k]]));
      const clean=cleanLayout(normalizeLayout(j.layout),derive(np));
      snapshot();
      for(const f of ALL_FIELDS)setField(f,np[f.k]);
      P=readParams();L=clean;render();setStatus('Loaded '+file.name+'.');
    }catch(e){setStatus('Could not load: '+e.message);}
    fi.value='';
  });
}
function layoutJSON(){return JSON.stringify({app:'ant-nest-panel-generator',version:2,params:P,layout:L},null,1);}
window.__nest={get state(){return {P,G,L,geo,rules};},derive,generate,buildGeometry,checkRules,exporters,offsetPoly,stripOutline,testPiece};
init();
