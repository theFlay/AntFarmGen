import test from 'node:test';
import assert from 'node:assert/strict';
import {offsetPoly} from '../../src/offset.js';

test('offset grows a square whichever way it winds',()=>{
  assert.deepEqual(offsetPoly([[0,0],[10,0],[10,10],[0,10]],1),[[-1,-1],[11,-1],[11,11],[-1,11]]);
  assert.deepEqual(offsetPoly([[0,0],[0,10],[10,10],[10,0]],1),[[-1,-1],[-1,11],[11,11],[11,-1]]);
});
test('negative offset shrinks',()=>{
  assert.deepEqual(offsetPoly([[0,0],[10,0],[10,10],[0,10]],-1),[[1,1],[9,1],[9,9],[1,9]]);
});
test('concave corners offset correctly',()=>{
  const L=[[0,0],[10,0],[10,5],[5,5],[5,10],[0,10]];
  assert.deepEqual(offsetPoly(L,1),[[-1,-1],[11,-1],[11,6],[6,6],[6,11],[-1,11]]);
});
