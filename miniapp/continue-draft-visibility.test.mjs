import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');
const navigation=await readFile(new URL('./navigation.js',import.meta.url),'utf8');

test('Continue draft is hidden by CSS before draft readiness JavaScript runs',()=>{
  assert.match(bootstrap,/#flow-continue\[hidden\]\{display:none!important\}/);
  assert.match(navigation,/id="flow-continue" class="cosmo-secondary" type="button" hidden/);
});

test('Continue draft becomes visible only for a ready loaded draft',()=>{
  assert.match(navigation,/continueButton\.hidden=state\.loadStatus!=='ready'\|\|!state\.hasDraft/);
});
