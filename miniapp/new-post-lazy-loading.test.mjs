import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');
const navigation=await readFile(new URL('./navigation.js',import.meta.url),'utf8');

test('New Post entry is not part of the startup bootstrap path',()=>{
  assert.doesNotMatch(bootstrap,/import\(['"]\/new-post-entry\.js['"]\)/);
});

test('navigation lazy-loads New Post entry only through the New Post lifecycle',()=>{
  assert.match(navigation,/async function loadNewPostEntry\(\)/);
  assert.match(navigation,/import\(['"]\/new-post-entry\.js['"]\)/);
  assert.match(navigation,/const composerView=await loadNewPostEntry\(\)/);
});

test('New Post load failure is contained to the feature',()=>{
  assert.match(navigation,/New Post entry failed to load/);
  assert.match(navigation,/showNewPostLoadError/);
  assert.match(navigation,/router\.show\(['"]home['"],\{notify:false\}\)/);
});
