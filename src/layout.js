/* ---------------- layout model ----------------
 H[j][k] (j=1..rows-1, k=0..cols-1): wall between cell(j-1,k) and cell(j,k)
 V[r][i] (r=0..rows-1, i=1..cols-1): wall between cell(r,i-1) and cell(r,i)
 states: 'solid' | 'tunnel' | 'sponge'; merged interiors read as 'none'
 diag[r][c]: 0 none, 1 '/', 2 '\'. A split cell has two halves, 'a' (holding the top edge)
 and 'b' (holding the bottom edge). Units are [r,c] or [r,c,'a'|'b'].
 jogH/jogV: sideways step in mm on a solid wall, 0 for none.
*/
export function emptyLayout(cols,rows){
  const L={cols,rows,active:[],activeB:[],merges:[],H:[],V:[],diag:[],jogH:[],jogV:[],sensors:[],pillars:[],frost:[],vials:[],reservoirs:[],portsUsed:[],damp:''};
  for(let r=0;r<rows;r++){
    L.active.push(new Array(cols).fill(true));L.activeB.push(new Array(cols).fill(true));
    L.diag.push(new Array(cols).fill(0));
  }
  for(let j=0;j<=rows;j++){L.H.push(new Array(cols).fill('solid'));L.jogH.push(new Array(cols).fill(0));}
  for(let r=0;r<rows;r++){L.V.push(new Array(cols+1).fill('solid'));L.jogV.push(new Array(cols+1).fill(0));}
  return L;
}
const sameUnit=(x,u)=>x[0]===u[0]&&x[1]===u[1]&&x[2]===u[2];
const inGroup=(m,u)=>m.cells.some(x=>sameUnit(x,u));
export const broodCells=(r,c)=>[[r,c],[r,c+1],[r+1,c],[r+1,c+1]];
export const mergeOf=(L,r,c,h)=>L.merges.findIndex(m=>inGroup(m,[r,c,h]));
// the half of a cell that holds a given edge
export function unitAt(L,r,c,side){
  const d=L.diag[r][c];
  if(!d)return [r,c];
  const h=side==='top'?'a':side==='bottom'?'b':(side==='left')===(d===1)?'a':'b';
  return [r,c,h];
}
export const isActive=(L,[r,c,h])=>h==='b'?L.activeB[r][c]:L.active[r][c];
export function setActive(L,[r,c,h],on){
  if(h==='b')L.activeB[r][c]=on;
  else{L.active[r][c]=on;if(!h)L.activeB[r][c]=on;}
}
// fills in anything older saved layouts do not have
export function normalizeLayout(L){
  L.merges=L.merges.map(m=>m.cells?m:{cells:broodCells(m.r,m.c),brood:true});
  const fresh=emptyLayout(L.cols,L.rows);
  for(const k of ['diag','jogH','jogV','sensors','pillars','frost','vials','reservoirs','portsUsed'])if(!L[k])L[k]=fresh[k];
  if(!L.activeB)L.activeB=L.active.map(row=>row.slice());
  return L;
}
export const hMerged=(L,j,k)=>{const a=unitAt(L,j-1,k,'bottom'),b=unitAt(L,j,k,'top');return L.merges.some(m=>inGroup(m,a)&&inGroup(m,b));};
export const vMerged=(L,r,i)=>{const a=unitAt(L,r,i-1,'right'),b=unitAt(L,r,i,'left');return L.merges.some(m=>inGroup(m,a)&&inGroup(m,b));};
export const stH=(L,j,k)=>hMerged(L,j,k)?'none':L.H[j][k];
export const stV=(L,r,i)=>vMerged(L,r,i)?'none':L.V[r][i];
export const getEdge=(L,e)=>e.type==='H'?stH(L,e.j,e.k):stV(L,e.r,e.i);
export function setEdge(L,e,s){ if(e.type==='H') L.H[e.j][e.k]=s; else L.V[e.r][e.i]=s; }

export function chambers(L){
  const id=[],idB=[];let n=0;const list=[];
  for(let r=0;r<L.rows;r++){id.push(new Array(L.cols).fill(-1));idB.push(new Array(L.cols).fill(-1));}
  const mark=([r,c,h],v)=>{if(h==='b')idB[r][c]=v;else id[r][c]=v;};
  const tag=u=>u[2]?[u[0],u[1],u[2],L.diag[u[0]][u[1]]]:[u[0],u[1]];
  L.merges.forEach(m=>{
    const ch={id:n,cells:m.cells.map(tag),merged:true,brood:!!m.brood};
    for(const u of m.cells)mark(u,n);
    list.push(ch);n++;
  });
  for(let r=0;r<L.rows;r++)for(let c=0;c<L.cols;c++){
    for(const u of L.diag[r][c]?[[r,c,'a'],[r,c,'b']]:[[r,c]]){
      const cur=u[2]==='b'?idB[r][c]:id[r][c];
      if(cur<0){mark(u,n);list.push({id:n,cells:[tag(u)],merged:false});n++;}
    }
  }
  for(const ch of list){
    ch.active=ch.cells.every(u=>isActive(L,u));
    ch.reservoir=ch.cells.some(u=>L.reservoirs.some(([r,c])=>r===u[0]&&c===u[1]));
  }
  const at=(r,c,side)=>{const u=unitAt(L,r,c,side);return u[2]==='b'?idB[r][c]:id[r][c];};
  const of=(r,c,h)=>h==='b'?idB[r][c]:id[r][c];
  return {id,idB,at,of,list};
}
export function interiorEdges(L,ch){
  const out=[];
  for(let j=1;j<L.rows;j++)for(let k=0;k<L.cols;k++){const a=ch.at(j-1,k,'bottom'),b=ch.at(j,k,'top');if(a!==b)out.push({type:'H',j,k,a,b});}
  for(let r=0;r<L.rows;r++)for(let i=1;i<L.cols;i++){const a=ch.at(r,i-1,'right'),b=ch.at(r,i,'left');if(a!==b)out.push({type:'V',r,i,a,b});}
  return out;
}
export function adjacency(L,ch){
  const adj=new Map(ch.list.map(c=>[c.id,new Map()]));
  for(const e of interiorEdges(L,ch)){
    for(const [x,y] of [[e.a,e.b],[e.b,e.a]]){const m=adj.get(x);if(!m.has(y))m.set(y,[]);m.get(y).push(e);}
  }
  return adj;
}
// outline of a cell or half cell; units from chambers() carry their diagonal direction
export function unitPoly(G,[r,c,h,d]){
  const x0=G.xs[c],x1=G.xs[c+1],y0=G.ys[r],y1=G.ys[r+1];
  const TL=[x0,y0],TR=[x1,y0],BR=[x1,y1],BL=[x0,y1];
  if(!h)return [TL,TR,BR,BL];
  if(d===1)return h==='a'?[TL,TR,BL]:[TR,BR,BL];
  return h==='a'?[TL,TR,BR]:[TL,BR,BL];
}
export function unitCenter(G,u){
  const p=unitPoly(G,u);
  return [p.reduce((a,q)=>a+q[0],0)/p.length,p.reduce((a,q)=>a+q[1],0)/p.length];
}
export function chamberCenter(G,ch){
  let sx=0,sy=0;for(const u of ch.cells){const [x,y]=unitCenter(G,u);sx+=x;sy+=y;}
  return [sx/ch.cells.length,sy/ch.cells.length];
}

/* ---------------- diagonals ---------------- */
const SIDE_STEP={top:[-1,0],bottom:[1,0],left:[0,-1],right:[0,1]};
const halfSides=d=>d===1?{a:['top','left'],b:['bottom','right']}:{a:['top','right'],b:['bottom','left']};
function wallAtCorner(L,j,i){
  if(j===0||j===L.rows||i===0||i===L.cols)return true;
  return stH(L,j,i-1)!=='none'||stH(L,j,i)!=='none'||stV(L,j-1,i)!=='none'||stV(L,j,i)!=='none';
}
// Splits a cell corner to corner. Each half joins a whole neighbour, so no chamber is a lone
// triangle, and the two halves always end up in different chambers. Returns false if it cannot.
export function addDiagonal(L,r,c,d,rnd=Math.random){
  if(L.diag[r][c]||mergeOf(L,r,c)>=0)return false;
  const options=h=>halfSides(d)[h].map(side=>{
    const [dr,dc]=SIDE_STEP[side],y=r+dr,x=c+dc;
    if(y<0||x<0||y>=L.rows||x>=L.cols||L.diag[y][x])return null;
    const g=mergeOf(L,y,x);
    if(g>=0&&L.merges[g].brood)return null;
    return {cell:[y,x],g,key:g>=0?'g'+g:`c${y},${x}`};
  }).filter(Boolean);
  const A=options('a'),Bs=options('b');
  const pairs=[];for(const a of A)for(const b of Bs)if(a.key!==b.key)pairs.push([a,b]);
  if(!pairs.length)return false;
  const [a,b]=pairs[Math.floor(rnd()*pairs.length)];
  const before=JSON.stringify(L.merges);
  L.diag[r][c]=d;
  for(const [o,h] of [[a,'a'],[b,'b']]){
    if(o.g>=0)L.merges[o.g].cells.push([r,c,h]);
    else L.merges.push({cells:[o.cell,[r,c,h]],brood:false});
  }
  const ends=d===1?[[r+1,c],[r,c+1]]:[[r,c],[r+1,c+1]];
  if(ends.every(([j,i])=>wallAtCorner(L,j,i)))return true;
  L.diag[r][c]=0;L.merges=JSON.parse(before);
  return false;
}
export function removeDiagonal(L,r,c){
  L.diag[r][c]=0;
  for(const m of L.merges)m.cells=m.cells.filter(u=>!(u[0]===r&&u[1]===c&&u[2]));
  L.merges=L.merges.filter(m=>m.cells.length>1);
}
