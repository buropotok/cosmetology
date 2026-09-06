import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const storeSource=await readFile(new URL('./draft-store.js',import.meta.url),'utf8');
const overlaySource=await readFile(new URL('./draft-loading-overlay.js',import.meta.url),'utf8');
const settingsButtonSource=await readFile(new URL('./settings-button.js',import.meta.url),'utf8');
const settingsIconSource=await readFile(new URL('./assets/icons/settings.svg',import.meta.url),'utf8');
const bootstrapSource=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');

function createState(){
  let snapshot={plainText:'',content:'',images:[],platform:'telegram',activePhotoIndex:0};
  return {
    subscribe(){return()=>{}},
    getVersion(){return 0},
    getSnapshot(){return snapshot},
    restore(next){snapshot={...snapshot,...next,plainText:next.content||''}},
    reset(){snapshot={plainText:'',content:'',images:[],platform:'telegram',activePhotoIndex:0}}
  };
}

function createStore(fetchImpl){
  const events=[];
  class TestCustomEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail}}
  const window={fetch:fetchImpl,dispatchEvent:event=>events.push(event)};
  const context={window,CustomEvent:TestCustomEvent,FormData,AbortController,setTimeout,clearTimeout,queueMicrotask,console};
  vm.runInNewContext(storeSource,context,{filename:'draft-store.js'});
  const state=createState();
  const store=window.CosmoDraftStoreFactory.create({state,fetchImpl,authHeaders:()=>({Authorization:'tma test'})});
  return {store,events};
}

test('draft load exposes loading then ready state and restores the continuation flag',async()=>{
  const fetchImpl=async()=>({ok:true,status:200,json:async()=>({draft:{text:'saved',images:[],platform:'telegram',activePhotoIndex:0}})});
  const {store,events}=createStore(fetchImpl);
  await store.load();
  assert.equal(events[0].detail.loadStatus,'loading');
  assert.equal(events.at(-1).detail.loadStatus,'ready');
  assert.equal(store.getState().hasDraft,true);
  assert.equal(store.getState().restoring,false);
});

test('failed draft load becomes retryable error state',async()=>{
  let attempt=0;
  const fetchImpl=async()=>{
    attempt++;
    if(attempt===1)return {ok:false,status:503};
    return {ok:true,status:200,json:async()=>({draft:null})};
  };
  const {store}=createStore(fetchImpl);
  await assert.rejects(store.load(),/Draft load HTTP 503/);
  assert.equal(store.getState().loadStatus,'error');
  assert.equal(store.getState().restoring,false);
  await store.load();
  assert.equal(store.getState().loadStatus,'ready');
  assert.equal(store.getState().hasDraft,false);
});

test('draft loading UI stays independent from Home settings controls',()=>{
  assert.match(overlaySource,/Запрос ваших черновиков/);
  assert.match(overlaySource,/Ошибка загрузки черновиков/);
  assert.match(overlaySource,/Ещё раз/);
  assert.match(overlaySource,/Пропустить/);
  assert.match(overlaySource,/Продолжить работу с черновика/);
  assert.doesNotMatch(overlaySource,/setHomeControlsVisible/);
  assert.doesNotMatch(overlaySource,/open-settings/);
  assert.doesNotMatch(overlaySource,/cosmo-settings/);
  assert.match(settingsButtonSource,/\/assets\/icons\/settings\.svg/);
  assert.doesNotMatch(settingsButtonSource,/<svg/);
  assert.match(settingsIconSource,/<svg/);
  assert.match(storeSource,/const LOAD_TIMEOUT_MS=10000/);
  const overlayImport=bootstrapSource.indexOf("import('/draft-loading-overlay.js')");
  const storeImport=bootstrapSource.indexOf("import('/draft-store.js')");
  assert.ok(overlayImport>=0&&storeImport>=0&&overlayImport<storeImport,'draft modal must exist before draft restore starts');
});
