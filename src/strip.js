/* ---------------- strip flat outline ---------------- */
export function stripOutline(pc,G,P){
  const len=pc.e-pc.s,dep=G.depth,S=P.S,tl=P.tabL;
  const pts=[[0,0]];
  for(const u of pc.top.slice().sort((a,b)=>a-b)){pts.push([u-tl/2,0],[u-tl/2,-S],[u+tl/2,-S],[u+tl/2,0]);}
  pts.push([len,0],[len,dep]);
  const feats=[];
  for(const u of pc.bot)feats.push({a:u-tl/2,b:u+tl/2,y:dep+S});
  for(const n of pc.notches){const u=n-pc.s;feats.push({a:u-G.tunnelW/2,b:u+G.tunnelW/2,y:dep-G.tunnelH});}
  feats.sort((x,y)=>y.a-x.a);
  for(const f of feats)pts.push([f.b,dep],[f.b,f.y],[f.a,f.y],[f.a,dep]);
  pts.push([0,dep]);
  return pts;
}
