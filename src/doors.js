// Door types. Each type says what it cuts in the service sheet and which loose parts it adds.
// To add a type later, add an entry here and it appears in the settings.

// Sliding door A: a T-headed strip fills the tunnel notch. Pulled up, its bottom sits flush
// with the inside of the sheet, so the slot stays filled. A saddle slides on over the head
// and holds it there. Everything below the sheet is solid, so a closed door has no window.
function slideSizes(G,P){
  const fit=P.doorFit,w=G.tunnelW,t=G.t,S=P.S;
  const ear=2,headH=Math.max(3,P.doorGrip),wall=2.5,bar=2;
  const bodyW=w-2*fit,bodyH=G.tunnelH+S;
  const headW=bodyW+2*ear;
  const pullW=t+0.2,pullH=2.1;
  const saddleW=headW+2*fit+2*wall;
  const saddleH=G.tunnelH+headH+0.2+bar;
  return {fit,bodyW,bodyH,headW,headH,pullW,pullH,saddleW,saddleH,bar,wall,
          stickClosed:headH,stickOpen:saddleH};
}
function doorPart(z){
  const {bodyW,bodyH,headW,headH,pullW,pullH}=z;
  const e=(headW-bodyW)/2,cx=headW/2,hy=(headH-pullH)/2;
  return {name:'door',w:headW,h:headH+bodyH,
    poly:[[0,0],[headW,0],[headW,headH],[headW-e,headH],[headW-e,headH+bodyH],[e,headH+bodyH],[e,headH],[0,headH]],
    holes:[[[cx-pullW/2,hy],[cx+pullW/2,hy],[cx+pullW/2,hy+pullH],[cx-pullW/2,hy+pullH]]]};
}
function saddlePart(z,G){
  const {saddleW:W,saddleH:H,wall,bar,headW,headH,bodyW,fit}=z;
  const hw=headW/2+fit,bw=bodyW/2+fit,c=W/2,ledge=bar+headH+0.2;
  return {name:'saddle',w:W,h:H,
    poly:[[0,0],[W,0],[W,H],[c+bw,H],[c+bw,ledge],[c+hw,ledge],[c+hw,bar],[c-hw,bar],[c-hw,ledge],[c-bw,ledge],[c-bw,H],[0,H]],
    holes:[]};
}

export const DOOR_TYPES={
  none:{label:'None (open tunnels)',sizes:()=>null,slot:()=>null,parts:()=>[]},
  slide:{
    label:'A: sliding door and saddle',
    sizes:slideSizes,
    // the slot runs along the wall directly over the notch
    slot(d,G,P){
      const hl=G.tunnelW/2,ht=G.t/2+P.doorFit;
      return d.orient==='H'?{x0:d.x-hl,x1:d.x+hl,y0:d.y-ht,y1:d.y+ht}:{x0:d.x-ht,x1:d.x+ht,y0:d.y-hl,y1:d.y+hl};
    },
    parts(G,P,n){
      const z=slideSizes(G,P);
      return [Object.assign(doorPart(z),{qty:n}),Object.assign(saddlePart(z,G),{qty:n})];
    },
  },
};
export const doorType=P=>DOOR_TYPES[P.doorType]||DOOR_TYPES.none;
