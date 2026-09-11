import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const controller=await readFile(new URL('./before-after-controller.js',import.meta.url),'utf8');
const bridge=await readFile(new URL('./before-after-bridge.js',import.meta.url),'utf8');
const navigation=await readFile(new URL('./navigation.js',import.meta.url),'utf8');
const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');

function functionBody(source,name,nextName){
  const start=source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`${name} should exist`);
  const end=nextName?source.indexOf(`function ${nextName}(`,start):source.length;
  assert.ok(end>start,`${name} boundary should exist`);
  return source.slice(start,end);
}

test('Before/After workspace is cleared only by committed New Post flow',()=>{
  assert.match(controller,/addEventListener\('cosmo-new-post',clear\)/);
  assert.match(controller,/Object\.freeze\(\{open,close,clear,save,saveDraft,saveAsset,removeAsset,swapAssets\}\)/);
  assert.match(navigation,/async function openNewPost\(\)/);
  assert.match(navigation,/cosmo-new-post/);
  assert.match(navigation,/source:'flow-new'/);
  assert.doesNotMatch(bootstrap,/new-post-lifecycle\.js/);
});

test('save and navigation close keep the Before/After iframe draft alive',()=>{
  const saveStart=controller.indexOf('async function save(');
  const messageStart=controller.indexOf("window.addEventListener('message'",saveStart);
  assert.ok(saveStart>=0&&messageStart>saveStart);
  const saveBody=controller.slice(saveStart,messageStart);
  assert.match(saveBody,/navigation\.replace\(navigation\.STATES\.PUBLISH,\{focus:false\}\)/);
  assert.doesNotMatch(saveBody,/clear\(\)/);
  const closeBody=functionBody(controller,'close','clear');
  assert.match(closeBody,/overlay\.hidden=true/);
  assert.doesNotMatch(closeBody,/overlay\.remove\(\)/);
});

test('loader is transient and reset on reopen',()=>{
  assert.match(bridge,/function resetTransient\(\)/);
  assert.match(controller,/function open\(\)[\s\S]+?resetTransient/);
  assert.match(controller,/function close\(\)[\s\S]+?resetTransient/);
  assert.doesNotMatch(bridge,/localStorage|sessionStorage/);
});

test('Before/After identifies its draft mode explicitly without making it a resume route',()=>{
  const openBody=functionBody(controller,'open','destroySolo');
  assert.match(openBody,/CosmoSofaDraft\?\.setScreen\?\.\('beforeafter'\)/);
  const saveDraftBody=functionBody(controller,'saveDraft','saveAsset');
  assert.doesNotMatch(saveDraftBody,/setScreen/);
  const start=navigation.indexOf('async function resumeDraft()');
  const end=navigation.indexOf("home.querySelector('#flow-new')",start);
  assert.ok(start>=0&&end>start,'resumeDraft should exist before Home handlers');
  const resume=navigation.slice(start,end);
  assert.doesNotMatch(resume,/state\.screen/);
  assert.match(resume,/navigation\.reset\(\[STATES\.HOME,STATES\.MENU\]\)/);
});
