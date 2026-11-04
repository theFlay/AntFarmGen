// Small laser-cut parts that make the nest an all-acrylic kit.
// Every part is {name,w,h,poly,holes,qty}, drawn with its top-left at 0,0.
import {rectPts} from './util.js';
import {doorType} from './doors.js';

export const PEG_FIT=0.1;

// Peg: head on the back, shank through everything, key slot just past the front sheet.
export function pegPart(G,P){
  const pw=P.pegW,head=pw+6,headH=3,shank=2*P.S+G.depth,keyH=2.7,rim=2;
  const e=(head-pw)/2,total=headH+shank+keyH+rim;
  const hw=G.t+0.2,cx=head/2,y=headH+shank;
  return {name:'peg',w:head,h:total,
    poly:[[0,0],[head,0],[head,headH],[head-e,headH],[head-e,total],[e,total],[e,headH],[0,headH]],
    holes:[rectPts(cx-hw/2,y,cx+hw/2,y+keyH)]};
}
// Key: a shallow wedge, so tapping it in pulls the panel tight.
export function keyPart(){
  const L=16;
  return {name:'key',w:L,h:2.6,poly:[[0,0],[L,0],[L,2.6],[0,1.6]],holes:[]};
}
// Port plug: a stack of T-shaped layers tied by one pin.
export function plugPart(G,P){
  const fit=0.1,w=G.tunnelW-2*fit,head=G.tunnelW+6,headH=3,L=headH+P.B;
  const e=(head-w)/2,cx=head/2,cy=headH+P.B/2,pw=G.t+0.2,ph=2.2;
  return {name:'plug',w:head,h:L,
    poly:[[0,0],[head,0],[head,headH],[head-e,headH],[head-e,L],[e,L],[e,headH],[0,headH]],
    holes:[rectPts(cx-pw/2,cy-ph/2,cx+pw/2,cy+ph/2)]};
}
export function plugPinPart(G){return {name:'plug pin',w:G.depth,h:2,poly:rectPts(0,0,G.depth,2),holes:[]};}

// Cover leg: tab up into the cover, tab down into a border socket.
export function coverLeg(G,P,geo){
  const L=geo.socketL,stand=coverStand(G,P),tabH=P.S+3,inset=2;
  const a=inset,b=L-inset,top=P.S,h=top+stand+tabH;
  return {name:'cover leg',w:L,h,
    poly:[[a,0],[b,0],[b,top],[L,top],[L,top+stand],[b,top+stand],[b,h],[a,h],[a,top+stand],[0,top+stand],[0,top],[a,top]],
    holes:[]};
}
export function coverStand(G,P){
  if(P.coverStand!=null)return P.coverStand;
  const z=doorType(P).sizes(G,P);
  return (z?z.stickOpen:6)+2;
}
// Upright foot: the bottom edge of the panel drops into its notch.
export function footPart(G,P){
  const thick=2*P.S+G.depth+0.2,L=Math.max(90,Math.round(P.H*0.45)),h=20,d=5;
  const a=(L-thick)/2,b=a+thick;
  return {name:'foot',w:L,h,poly:[[0,0],[a,0],[a,d],[b,d],[b,0],[L,0],[L,h],[0,h]],holes:[]};
}

export function hardwareParts(G,L,P,geo){
  const out=[];
  out.push(...doorType(P).parts(G,P,geo.doors.length));
  const nf=geo.fasteners.length;
  if(P.fastener==='peg'&&nf){out.push(Object.assign(pegPart(G,P),{qty:nf}),Object.assign(keyPart(),{qty:nf}));}
  const nPorts=geo.ports.filter(p=>p.cut).length;
  if(nPorts){out.push(Object.assign(plugPart(G,P),{qty:nPorts*P.layers}),Object.assign(plugPinPart(G),{qty:nPorts}));}
  if(P.coverType==='whole'&&geo.sockets.length)out.push(Object.assign(coverLeg(G,P,geo),{qty:geo.sockets.length}));
  if(P.orient==='upright')out.push(Object.assign(footPart(G,P),{qty:2}));
  return out;
}
