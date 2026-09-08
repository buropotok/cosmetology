import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const controller=await readFile(new URL('./before-after-controller.js',import.meta.url),'utf8');
const store=await readFile(new URL('./draft-store.js',import.meta.url),'utf8');
const drafts=await readFile(new URL('./drafts.js',import.meta.url),'utf8');
const navigation=await readFile(new URL('./navigation.js',import.meta.url),'utf8');
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

test('Continue restores a Before/After draft into the workspace menu without route coupling',()=>{
  const start=navigation.indexOf('async function resumeDraft()');
  const end=navigation.indexOf("home.querySelector('#flow-new')",start);
  assert.ok(start>=0&&end>start,'resumeDraft should exist before Home handlers');
  const resume=navigation.slice(start,end);
  assert.match(resume,/navigation\.reset\(\[STATES\.HOME,STATES\.MENU\]\)/);
  assert.doesNotMatch(resume,/state\.screen/);
  assert.doesNotMatch(resume,/STATES\.(AI|PUBLISH|BEFORE_AFTER)/);
  assert.doesNotMatch(resume,/CosmoBeforeAfter\?\.open/);
  assert.match(navigation,/continueButton\.addEventListener\('click',\(\)=>\{void resumeDraft\(\)\}\)/);
  assert.doesNotMatch(bootstrap,/draft-resume-router\.js/);
});
