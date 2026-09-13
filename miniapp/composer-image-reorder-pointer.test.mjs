import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {moveItem} from './composer-image-order.js';

const source=await readFile(new URL('./composer-image-manager.js',import.meta.url),'utf8');

test('cancelled drag has a distinct non-committing path and foreign pointer endings are ignored before cleanup',()=>{
  assert.match(source,/onUp=endEvent=>\{if\(!dragState\|\|endEvent\.pointerId!==dragState\.pointerId\)return;cleanup\(\);endDrag\(endEvent,true\)\}/);
  assert.match(source,/onCancel=endEvent=>\{if\(!dragState\|\|endEvent\.pointerId!==dragState\.pointerId\)return;cleanup\(\);endDrag\(endEvent,false\)\}/);
  const files=['first','second','third'];
  assert.deepEqual(files,['first','second','third']);
  assert.deepEqual(moveItem(files,0,2),['second','third','first']);
});

test('drag destination lookup is scoped to the owned preview strip',()=>{
  assert.match(source,/document\.elementFromPoint\?\.\(x,y\)/);
  assert.match(source,/!target\|\|!previews\.contains\(target\)/);
});

test('file order has a DataTransfer-independent fallback and releases it before trusted input changes',()=>{
  assert.match(source,/Object\.defineProperty\(input,'files',\{configurable:true,get:\(\)=>files\}\)/);
  assert.match(source,/if\(event\.isTrusted\)clearInputFilesShadow\(\)/);
  assert.match(source,/return shadowInputFiles\(\)/);
});
