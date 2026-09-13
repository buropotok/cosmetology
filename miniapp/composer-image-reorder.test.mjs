import test from 'node:test';
import assert from 'node:assert/strict';
import {moveItem,translatedActiveIndex} from './composer-image-order.js';

test('moveItem reorders without mutating the source array',()=>{
  const source=['a','b','c','d'];
  assert.deepEqual(moveItem(source,1,3),['a','c','d','b']);
  assert.deepEqual(source,['a','b','c','d']);
  assert.deepEqual(moveItem(source,3,0),['d','a','b','c']);
});

test('moveItem rejects invalid and no-op destinations',()=>{
  const source=['a','b'];
  assert.equal(moveItem(source,0,0),null);
  assert.equal(moveItem(source,-1,1),null);
  assert.equal(moveItem(source,0,2),null);
});

test('active photo follows the same image through a reorder',()=>{
  assert.equal(translatedActiveIndex(1,1,3),3);
  assert.equal(translatedActiveIndex(2,0,3),1);
  assert.equal(translatedActiveIndex(1,3,0),2);
  assert.equal(translatedActiveIndex(0,2,3),0);
});
