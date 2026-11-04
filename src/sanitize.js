// Layout files can come from anyone, so nothing in one is trusted. This rebuilds the layout
// from checked values only: anything unexpected is rejected rather than passed through.
const STATES=new Set(['solid','tunnel','sponge']);
const fail=m=>{throw new Error(m);};

function grid(v,rows,cols,name,check){
  if(!Array.isArray(v)||v.length!==rows)fail(`${name} has the wrong size`);
  return v.map(row=>{
    if(!Array.isArray(row)||row.length!==cols)fail(`${name} has the wrong size`);
    return row.map(check);
  });
}
const bool=v=>typeof v==='boolean'?v:fail('expected true or false');
const state=v=>STATES.has(v)?v:fail('unknown wall state');
const jog=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=50?v:fail('bad jog value');
const diag=v=>v===0||v===1||v===2?v:fail('bad diagonal value');

export function cleanLayout(l,G){
  if(!l||typeof l!=='object')fail('layout data is missing');
  const {cols,rows}=G;
  if(l.cols!==cols||l.rows!==rows)fail(`layout is ${l.cols} x ${l.rows} but these settings give ${cols} x ${rows}`);
  if(!Array.isArray(l.merges)||l.merges.length>cols*rows)fail('layout data is incomplete');
  const cell=u=>{
    if(!Array.isArray(u)||u.length<2||u.length>3)fail('bad cell in a chamber');
    const [r,c,h]=u;
    if(!Number.isInteger(r)||!Number.isInteger(c)||r<0||c<0||r>=rows||c>=cols)fail('cell is outside the grid');
    if(u.length===3&&h!=='a'&&h!=='b')fail('bad half cell');
    return u.length===3?[r,c,h]:[r,c];
  };
  const cellList=(v,name)=>{
    if(!Array.isArray(v)||v.length>cols*rows)fail(`${name} list is bad`);
    return v.map(u=>{if(!Array.isArray(u)||u.length!==2)fail(`bad cell in ${name}`);return cell(u);});
  };
  return {
    cols,rows,
    active:grid(l.active,rows,cols,'active',bool),
    activeB:grid(l.activeB,rows,cols,'activeB',bool),
    H:grid(l.H,rows+1,cols,'H',state),
    V:grid(l.V,rows,cols+1,'V',state),
    diag:grid(l.diag,rows,cols,'diag',diag),
    jogH:grid(l.jogH,rows+1,cols,'jogH',jog),
    jogV:grid(l.jogV,rows,cols+1,'jogV',jog),
    sensors:cellList(l.sensors,'sensors'),
    pillars:cellList(l.pillars,'pillars'),
    merges:l.merges.map(m=>{
      if(!m||!Array.isArray(m.cells)||m.cells.length<2||m.cells.length>cols*rows*2)fail('bad chamber group');
      return {cells:m.cells.map(cell),brood:m.brood===true};
    }),
  };
}

// keeps a setting to a known option, a real colour, or a sane number range
export function cleanParam(f,v){
  if(f.bool)return v===true;
  if(f.opts)return f.opts.some(o=>o[0]===v)?v:f.d;
  if(f.color)return /^#[0-9a-fA-F]{6}$/.test(v)?v:f.d;
  if(v===null)return f.opt?null:f.d;
  if(typeof v!=='number'||!Number.isFinite(v))return f.opt?null:f.d;
  const [lo,hi]=f.range||[-1e6,1e6];
  return Math.min(hi,Math.max(lo,v));
}
export const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
