import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const navigation=await readFile(new URL('./navigation.js',import.meta.url),'utf8');
const drafts=await readFile(new URL('./drafts.js',import.meta.url),'utf8');

test('Continue stays hidden until draft state is ready and present',()=>{
  assert.match(navigation,/id="flow-continue"[^>]*hidden/);
  assert.match(navigation,/if\(!state\)\{continueButton\.hidden=true;return\}/);
  assert.match(navigation,/continueButton\.hidden=state\.loadStatus!=='ready'\|\|!state\.hasDraft/);
});

test('draft API exposes one shared initial readiness promise',()=>{
  assert.match(drafts,/async function load\(\)\{const result=await store\.load\(\);beforeAfterFilesInitialized=false;return result\}/);
  assert.match(drafts,/const initialLoad=load\(\)/);
  assert.match(drafts,/const whenReady=\(\)=>initialLoad\.then\(\(\)=>store\.getState\(\)\)/);
  assert.match(drafts,/Object\.freeze\(\{load,whenReady,/);
  assert.doesNotMatch(drafts,/whenReady[^\n]*store\.load\(\)/);
});

test('New Post waits for readiness before inspecting or clearing a draft',()=>{
  assert.match(navigation,/state=draft\.whenReady\?await draft\.whenReady\(\):draft\.getState\?\.\(\)/);
  assert.match(navigation,/if\(!state\|\|state\.loadStatus!=='ready'\)\{await showDraftLoadError\(\);return\}/);
  const ready=navigation.indexOf('await draft.whenReady()');
  const clear=navigation.indexOf('if(draft?.clear)await draft.clear()');
  assert.ok(ready>=0&&clear>=0&&ready>clear,'readiness is checked by openNewPost before commitNewPost can clear');
});

test('existing draft requires explicit destructive confirmation',()=>{
  assert.match(navigation,/message:'Ваш черновик будет удален!'/);
  assert.match(navigation,/id:'cancel',type:'cancel',text:'Отмена'/);
  assert.match(navigation,/id:'continue',type:'destructive',text:'Продолжить'/);
  assert.match(navigation,/if\(state\.hasDraft&&!\(await confirmDraftReplacement\(\)\)\)return/);
});

test('cancel has no committed new-post side effects',()=>{
  const cancelGuard=navigation.indexOf("if(state.hasDraft&&!(await confirmDraftReplacement()))return;");
  const commit=navigation.indexOf('await commitNewPost(draft);',cancelGuard);
  assert.ok(cancelGuard>=0&&commit>cancelGuard);
  const committed=navigation.slice(navigation.indexOf('async function commitNewPost'),navigation.indexOf('let newPostInFlight'));
  assert.match(committed,/await draft\.clear\(\)/);
  assert.match(committed,/cosmo-new-post/);
  assert.match(committed,/cosmo-ai-wizard-reset/);
  assert.match(committed,/navigation\.reset\(\[STATES\.HOME,STATES\.MENU\]\)/);
  assert.doesNotMatch(committed,/router\.show\('composer'\)/);
});

test('New Post ignores repeated clicks while a transition is in flight',()=>{
  assert.match(navigation,/let newPostInFlight=false/);
  assert.match(navigation,/if\(newPostInFlight\)return;\s*newPostInFlight=true/);
  assert.match(navigation,/finally\{newPostInFlight=false;button\.disabled=false\}/);
});

test('draft load errors do not clear or navigate',()=>{
  assert.match(navigation,/catch\{await showDraftLoadError\(\);return\}/);
  assert.match(navigation,/message:'Не удалось проверить сохранённый черновик\. Попробуйте ещё раз\.'/);
});
