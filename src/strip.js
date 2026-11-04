// Flat outline of a wall strip. y=0 is the front edge, y=depth the back edge.
// Tabs stick out of both edges; tunnel notches open toward the service side.
export function stripOutline(pc,G,P){
  const len=pc.e-pc.s,dep=G.depth,S=P.S,tl=pc.tabL||P.tabL;
  const fromFront=G.service==='front';
  const tab=(u,y)=>({a:u-tl/2,b:u+tl/2,y});
  const notch=(n,y)=>({a:n-pc.s-G.tunnelW/2,b:n-pc.s+G.tunnelW/2,y});
  const front=pc.top.map(u=>tab(u,-S)),back=pc.bot.map(u=>tab(u,dep+S));
  if(fromFront)for(const n of pc.notches)front.push(notch(n,G.tunnelH));
  else for(const n of pc.notches)back.push(notch(n,dep-G.tunnelH));
  const pts=[[0,0]];
  for(const f of front.sort((x,y)=>x.a-y.a))pts.push([f.a,0],[f.a,f.y],[f.b,f.y],[f.b,0]);
  pts.push([len,0],[len,dep]);
  for(const f of back.sort((x,y)=>y.a-x.a))pts.push([f.b,dep],[f.b,f.y],[f.a,f.y],[f.a,dep]);
  pts.push([0,dep]);
  return pts;
}
