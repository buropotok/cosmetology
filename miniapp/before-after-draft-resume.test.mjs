import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const controller=await readFile(new URL('./before-after-controller.js',import.meta.url),'utf8');
const store=await readFile(new URL('./draft-store.js',import.meta.url),'utf8');
const drafts=await readFile(new URL('./drafts.js',import.meta.url),'utf8');
const resume=await readFile(new URL('./draft-resume-router.js',import.meta.url),'utf8');
const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');
const worker=await readFile(new URL('../worker/src/services/miniapp-drafts.ts',import.meta.url),'utf8');

test('Before/After is a real persisted draft screen mode',()=>{
  assert.match(worker,/requestedScreen === 'beforeafter' \? 'beforeafter'/);
  assert.match(store,/screen:draftScreen/);
  assert.match(store,/function setScreen\(/);
  assert.match(store,/draftScreen=normalizeScreen\(draft\.screen\)/);
  assert.match(drafts,/setScreen:store\.setScreen/);
});

test('opening Before/After marks the draft without clearing it',()=>{
  assert.match(controller,/setScreen\?\.\('beforeafter'\)/);
  assert.doesNotMatch(controller,/function open\(\)[\s\S]*?\.clear\(/);
});

test('Continue routes a Before/After draft back to the module',()=>{
  assert.match(resume,/#flow-continue/);
  assert.match(resume,/state\?\.screen!=='beforeafter'/);
  assert.match(resume,/CosmoBeforeAfter\?\.open/);
  assert.match(resume,/stopImmediatePropagation/);
  assert.match(bootstrap,/import\('\/draft-resume-router\.js'\)/);
});
