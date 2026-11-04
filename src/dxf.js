// Converts a cut file to DXF (R12, the most widely read version). Only cut lines are carried
// over: engraved text and frosting stay in the SVG files.
export function svgToDxf(svg){
  const vb=svg.match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/);
  const pad=+vb[2],h=+vb[4];
  const Y=y=>(h+2*pad-y).toFixed(3); // DXF y runs upward, and the panel keeps its origin
  const out=['0','SECTION','2','ENTITIES'];
  for(const m of svg.matchAll(/<path d="([^"]+)" fill="none"/g)){
    for(const part of m[1].split('M').filter(s=>s.trim())){
      const closed=/Z\s*$/.test(part);
      const pts=[...part.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(q=>[+q[1],+q[2]]);
      out.push('0','POLYLINE','8','CUT','66','1','70',closed?'1':'0');
      for(const [x,y] of pts)out.push('0','VERTEX','8','CUT','10',x.toFixed(3),'20',Y(y));
      out.push('0','SEQEND');
    }
  }
  for(const m of svg.matchAll(/<circle cx="(-?[\d.]+)" cy="(-?[\d.]+)" r="([\d.]+)"/g))
    out.push('0','CIRCLE','8','CUT','10',(+m[1]).toFixed(3),'20',Y(+m[2]),'40',(+m[3]).toFixed(3));
  out.push('0','ENDSEC','0','EOF');
  return out.join('\r\n')+'\r\n';
}
