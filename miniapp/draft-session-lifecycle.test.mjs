import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const draftsSource=await readFile(new URL('./drafts.js',import.meta.url),'utf8');

function deferred(){
  let resolve;
  const promise=new Promise(done=>{resolve=done});
  return {promise,resolve};
}

function createHarness({loadResult={text:'saved'}}={}){
  const pendingClear=deferred();
  const calls={load:0,clear:0};
  let storeState={hasDraft:Boolean(loadResult),loadStatus:'ready',restoring:false,beforeAfterState:{before:{imageIndex:0}},beforeAfterImages:[]};
  const store={
    async load(){calls.load++;return loadResult},
    clear(){calls.clear++;storeState={...storeState,hasDraft:false,beforeAfterState:null,beforeAfterImages:[]};return pendingClear.promise},
    getState(){return storeState},
    scheduleSave(){},flush(){return Promise.resolve(true)},cancelRestore(){},setScreen(){return Promise.resolve(true)},setBeforeAfterState(){return Promise.resolve(true)},
  };
  const window={
    Telegram:{WebApp:{initData:'test'}},
    CosmoComposerState:{},CosmoAiWizardState:{},
    CosmoDiagnosticsFetch:{create:({fetchImpl})=>fetchImpl},
    CosmoDraftStoreFactory:{create:()=>store},
    fetch:async()=>({ok:true}),
    addEventListener(){},
  };
  const document={addEventListener(){}};
  vm.runInNewContext(draftsSource,{window,document,Map,Promise},{filename:'drafts.js'});
  return {draft:window.CosmoSofaDraft,calls,pendingClear};
}

test('restored frontend session makes later Continue reuse live state without another server load',async()=>{
  const {draft,calls}=createHarness();
  const restored=await draft.load();
  assert.equal(restored.text,'saved');
  assert.equal(calls.load,1);

  const resumedAgain=await draft.load();
  assert.deepEqual(resumedAgain,{liveSession:true});
  assert.equal(calls.load,1,'active frontend session must not reload the server draft');
});

test('New Post resets the session immediately without waiting for server persistence',async()=>{
  const {draft,calls,pendingClear}=createHarness();
  await draft.load();
  const oldBeforeFile={name:'old-before.jpg'};
  draft.setBeforeAfterImage('before',oldBeforeFile);
  assert.equal(draft.getBeforeAfterDraft().images[0],oldBeforeFile);

  const clearResult=draft.clear();
  assert.equal(calls.clear,1);
  assert.equal(draft.getState().hasDraft,true,'a new empty frontend session is active immediately');
  assert.deepEqual(draft.getBeforeAfterDraft().images,[],'Before/After files from the previous session are unavailable immediately');

  assert.equal(await clearResult,true,'New Post must not await server draft persistence');
  assert.equal(calls.load,1);

  await draft.load();
  assert.equal(calls.load,1,'Continue in the new live session must remain network-free');
  pendingClear.resolve(true);
});
