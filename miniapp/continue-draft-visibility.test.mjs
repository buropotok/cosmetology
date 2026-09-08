import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const navigation=await readFile(new URL('./navigation.js',import.meta.url),'utf8');

test('Home exposes Continue immediately without waiting for draft readiness',()=>{
  assert.match(navigation,/id="flow-continue" class="cosmo-secondary" type="button">Продолжить<\/button>/);
  assert.doesNotMatch(navigation,/continueButton\.hidden=state\.loadStatus!=='ready'\|\|!state\.hasDraft/);
});

test('Continue performs draft restore on demand',()=>{
  const start=navigation.indexOf('async function resumeDraft()');
  const end=navigation.indexOf("home.querySelector('#flow-new')",start);
  assert.ok(start>=0&&end>start,'resumeDraft should exist before Home handlers');
  const resume=navigation.slice(start,end);
  assert.match(resume,/restored=await draft\.load\(\)/);
  assert.match(resume,/navigation\.reset\(\[STATES\.HOME,STATES\.MENU\]\)/);
});
