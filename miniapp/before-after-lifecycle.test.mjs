import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const controller=await readFile(new URL('./before-after-controller.js',import.meta.url),'utf8');
const bridge=await readFile(new URL('./before-after-bridge.js',import.meta.url),'utf8');
const lifecycle=await readFile(new URL('./new-post-lifecycle.js',import.meta.url),'utf8');
const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');

test('Before/After workspace is cleared only by explicit new-post lifecycle',()=>{
  assert.match(controller,/addEventListener\('cosmo-new-post',clear\)/);
  assert.match(controller,/Object\.freeze\(\{open,close,clear,save\}\)/);
  assert.doesNotMatch(controller,/cosmo-before-after-close[^\n]+clear/);
  assert.match(lifecycle,/#flow-new,#flow-manual/);
  assert.match(lifecycle,/cosmo-new-post/);
});

test('save and close keep the Before/After iframe draft alive',()=>{
  assert.match(controller,/async function save[\s\S]+?close\(\);window\.dispatchEvent/);
  assert.match(controller,/function close\(\)[\s\S]+?overlay\.hidden=true/);
  assert.doesNotMatch(controller,/function close\(\)[\s\S]+?overlay\.remove\(\)/);
});

test('loader is transient and reset on reopen',()=>{
  assert.match(bridge,/function resetTransient\(\)/);
  assert.match(controller,/function open\(\)[\s\S]+?resetTransient/);
  assert.match(controller,/function close\(\)[\s\S]+?resetTransient/);
  assert.doesNotMatch(bridge,/localStorage|sessionStorage/);
});

test('Before/After identifies its draft mode explicitly',()=>{
  assert.match(controller,/body\.set\('screen','beforeafter'\)/);
  assert.match(bootstrap,/import\('\/new-post-lifecycle\.js'\)/);
});
