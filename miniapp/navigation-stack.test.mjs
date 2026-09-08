import test from 'node:test';
import assert from 'node:assert/strict';
import {createNavigationStack,NAVIGATION_STATES as S} from './navigation-stack.js';

test('navigation stack pushes screens and Back pops through the parent chain',async()=>{
  const rendered=[];
  const navigation=createNavigationStack({render:async state=>{rendered.push(state);return true}});
  await navigation.push(S.MENU);
  await navigation.push(S.PUBLISH);
  await navigation.push(S.BEFORE_AFTER);
  assert.deepEqual(navigation.stack,[S.HOME,S.MENU,S.PUBLISH,S.BEFORE_AFTER]);
  assert.equal(await navigation.back(),S.PUBLISH);
  assert.equal(await navigation.back(),S.MENU);
  assert.equal(await navigation.back(),S.HOME);
  assert.deepEqual(navigation.stack,[S.HOME]);
  assert.deepEqual(rendered,[S.MENU,S.PUBLISH,S.BEFORE_AFTER,S.PUBLISH,S.MENU,S.HOME]);
});

test('Before/After returns to the screen that opened it',async()=>{
  const navigation=createNavigationStack({render:async()=>true});
  await navigation.reset([S.HOME,S.MENU]);
  await navigation.push(S.BEFORE_AFTER);
  assert.equal(await navigation.back(),S.MENU);
  await navigation.push(S.PUBLISH);
  await navigation.push(S.BEFORE_AFTER);
  assert.equal(await navigation.back(),S.PUBLISH);
  assert.deepEqual(navigation.stack,[S.HOME,S.MENU,S.PUBLISH]);
});

test('replace removes a completed tool from Back history',async()=>{
  const navigation=createNavigationStack({render:async()=>true});
  await navigation.reset([S.HOME,S.MENU,S.BEFORE_AFTER]);
  await navigation.replace(S.PUBLISH);
  assert.deepEqual(navigation.stack,[S.HOME,S.MENU,S.PUBLISH]);
  assert.equal(await navigation.back(),S.MENU);
});

test('replace collapses Before/After back into an existing Publisher parent',async()=>{
  const navigation=createNavigationStack({render:async()=>true});
  await navigation.reset([S.HOME,S.MENU,S.PUBLISH,S.BEFORE_AFTER]);
  await navigation.replace(S.PUBLISH);
  assert.deepEqual(navigation.stack,[S.HOME,S.MENU,S.PUBLISH]);
  assert.equal(await navigation.back(),S.MENU);
});

test('failed rendering does not corrupt navigation state',async()=>{
  const navigation=createNavigationStack({render:async state=>state!==S.BEFORE_AFTER});
  await navigation.push(S.MENU);
  assert.equal(await navigation.push(S.BEFORE_AFTER),null);
  assert.deepEqual(navigation.stack,[S.HOME,S.MENU]);
});

test('async transitions are serialized in request order',async()=>{
  const releases=[];
  const navigation=createNavigationStack({render:()=>new Promise(resolve=>releases.push(()=>resolve(true)))});
  const menu=navigation.push(S.MENU);
  const publish=navigation.push(S.PUBLISH);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(releases.length,1);
  releases.shift()();
  await menu;
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(releases.length,1);
  releases.shift()();
  await publish;
  assert.deepEqual(navigation.stack,[S.HOME,S.MENU,S.PUBLISH]);
});
