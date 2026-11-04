import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {run} from './helpers.js';
import {cleanLayout,cleanParam,escapeHtml} from '../../src/sanitize.js';
import {ALL_FIELDS} from '../../src/params.js';

const copy=o=>JSON.parse(JSON.stringify(o));
const field=k=>ALL_FIELDS.find(f=>f.k===k);

test('a real layout survives cleaning unchanged',()=>{
  for(const cfg of [{},{angled:true,oddShare:0.4}]){
    const r=run(cfg,3),c=cleanLayout(copy(r.L),r.G);
    assert.deepEqual(c,copy(r.L));
  }
});
test('hostile layouts are rejected',()=>{
  const r=run({},3),bad=[
    L=>{L.merges.push({cells:[[0,0,'"><img src=x>'],[0,1]]});},
    L=>{L.merges.push({cells:[['<b>',0],[0,1]]});},
    L=>{L.merges.push({cells:[[99,0],[0,1]]});},
    L=>{L.H[1][0]='<script>';},
    L=>{L.diag[0][0]='x';},
    L=>{L.jogV[1][1]='1;alert(1)';},
    L=>{L.jogH[1][1]=1e9;},
    L=>{L.active[0][0]='yes';},
    L=>{L.cols=99;},
    L=>{L.H=null;},
    L=>{L.merges='no';},
  ];
  for(const edit of bad){const L=copy(r.L);edit(L);assert.throws(()=>cleanLayout(L,r.G));}
  assert.throws(()=>cleanLayout(null,r.G));
});
test('settings are limited to safe values',()=>{
  assert.equal(cleanParam(field('sizeFor'),'<script>'),'both');
  assert.equal(cleanParam(field('cutColor'),'red" onload="x'),'#ff0000');
  assert.equal(cleanParam(field('cutColor'),'#00ff00'),'#00ff00');
  assert.equal(cleanParam(field('ventGrid'),1e9),8);
  assert.equal(cleanParam(field('slotW'),-3),0.1,'a negative slot width used to freeze the page');
  assert.equal(cleanParam(field('W'),NaN),400);
  assert.equal(cleanParam(field('queenLen'),'x'),null);
  for(const f of ALL_FIELDS)if(!f.bool&&!f.opts&&!f.color)assert.ok(f.range,`${f.k} has no limits`);
});
test('text shown in the page is escaped',()=>{
  assert.equal(escapeHtml('<img src="x">'),'&lt;img src=&quot;x&quot;&gt;');
});
test('the built page loads nothing from other sites and has a strict policy',()=>{
  const html=readFileSync('index.html','utf8');
  assert.match(html,/Content-Security-Policy/);
  assert.match(html,/script-src 'sha256-/);
  assert.doesNotMatch(html,/script-src[^;"]*unsafe/);
  assert.doesNotMatch(html,/<script[^>]+src=/);
  assert.doesNotMatch(html,/cdnjs|cloudflare\.com|fetch\(/);
  assert.doesNotMatch(html,/(gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|sk-ant-|BEGIN [A-Z ]*PRIVATE KEY)/);
});
