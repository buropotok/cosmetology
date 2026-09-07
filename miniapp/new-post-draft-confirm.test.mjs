import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const guard=fs.readFileSync(new URL('./new-post-draft-confirm.js',import.meta.url),'utf8');
const bootstrap=fs.readFileSync(new URL('./bootstrap.js',import.meta.url),'utf8');

test('new post guard only intercepts when a draft exists',()=>{
  assert.match(guard,/CosmoSofaDraft\?\.getState\?\.\(\)\?\.hasDraft/);
  assert.match(guard,/if\(!hasDraft\(\)\)return/);
  assert.match(guard,/stopImmediatePropagation\(\)/);
});

test('draft warning uses requested copy and actions',()=>{
  assert.match(guard,/title:'Ваш черновик будет удален!'/);
  assert.match(guard,/text:'Продолжить'/);
  assert.match(guard,/text:'Отмена'/);
  assert.match(guard,/id==='continue'/);
});

test('confirmation guard loads after draft runtime',()=>{
  assert.ok(bootstrap.indexOf("import('/drafts.js')")<bootstrap.indexOf("import('/new-post-draft-confirm.js')"));
});
