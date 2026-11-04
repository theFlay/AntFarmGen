/* ---------------- layout model ----------------
 H[j][k] (j=1..rows-1, k=0..cols-1): wall between cell(j-1,k) and cell(j,k)
 V[r][i] (r=0..rows-1, i=1..cols-1): wall between cell(r,i-1) and cell(r,i)
 states: 'solid' | 'tunnel' | 'sponge'; merged interiors read as 'none'
*/
export function emptyLayout(cols,rows){
  const L={cols,rows,active:[],merges:[],H:[],V:[]};
  for(let r=0;r<rows;r++) L.active.push(new Array(cols).fill(true));
  for(let j=0;j<=rows;j++) L.H.push(new Array(cols).fill('solid'));
  for(let r=0;r<rows;r++) L.V.push(new Array(cols+1).fill('solid'));
  return L;
}
export const mergeOf=(L,r,c)=>L.merges.findIndex(m=>r>=m.r&&r<=m.r+1&&c>=m.c&&c<=m.c+1);
export const hMerged=(L,j,k)=>L.merges.some(m=>j===m.r+1&&(k===m.c||k===m.c+1));
export const vMerged=(L,r,i)=>L.merges.some(m=>i===m.c+1&&(r===m.r||r===m.r+1));
export const stH=(L,j,k)=>hMerged(L,j,k)?'none':L.H[j][k];
export const stV=(L,r,i)=>vMerged(L,r,i)?'none':L.V[r][i];
export const getEdge=(L,e)=>e.type==='H'?stH(L,e.j,e.k):stV(L,e.r,e.i);
export function setEdge(L,e,s){ if(e.type==='H') L.H[e.j][e.k]=s; else L.V[e.r][e.i]=s; }

export function chambers(L){
  const id=[];let n=0;const list=[];
  for(let r=0;r<L.rows;r++){id.push([]);for(let c=0;c<L.cols;c++)id[r].push(-1);}
  L.merges.forEach(m=>{const ch={id:n,cells:[],merged:true};for(let dr=0;dr<2;dr++)for(let dc=0;dc<2;dc++){id[m.r+dr][m.c+dc]=n;ch.cells.push([m.r+dr,m.c+dc]);}list.push(ch);n++;});
  for(let r=0;r<L.rows;r++)for(let c=0;c<L.cols;c++)if(id[r][c]<0){id[r][c]=n;list.push({id:n,cells:[[r,c]],merged:false});n++;}
  for(const ch of list) ch.active=ch.cells.every(([r,c])=>L.active[r][c]);
  return {id,list};
}
export function interiorEdges(L,ch){
  const out=[];
  for(let j=1;j<L.rows;j++)for(let k=0;k<L.cols;k++){const a=ch.id[j-1][k],b=ch.id[j][k];if(a!==b)out.push({type:'H',j,k,a,b});}
  for(let r=0;r<L.rows;r++)for(let i=1;i<L.cols;i++){const a=ch.id[r][i-1],b=ch.id[r][i];if(a!==b)out.push({type:'V',r,i,a,b});}
  return out;
}
export function adjacency(L,ch){
  const adj=new Map(ch.list.map(c=>[c.id,new Map()]));
  for(const e of interiorEdges(L,ch)){
    for(const [x,y] of [[e.a,e.b],[e.b,e.a]]){const m=adj.get(x);if(!m.has(y))m.set(y,[]);m.get(y).push(e);}
  }
  return adj;
}
export function chamberCenter(G,ch){
  let sx=0,sy=0;for(const [r,c] of ch.cells){sx+=(G.xs[c]+G.xs[c+1])/2;sy+=(G.ys[r]+G.ys[r+1])/2;}
  return [sx/ch.cells.length,sy/ch.cells.length];
}
