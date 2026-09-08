import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const navigation=await readFile(new URL('./navigation.js',import.meta.url),'utf8');
const drafts=await readFile(new URL('./drafts.js',import.meta.url),'utf8');
const overlay=await readFile(new URL('./draft-loading-overlay.js',import.meta.url),'utf8');

test('Home shows New Post and Continue immediately without draft readiness',()=>{
  assert.match(navigation,/id="flow-new"[^>]*>Новый пост<\/button>/);
  assert.match(navigation,/id="flow-continue"[^>]*>Продолжить<\/button>/);
  assert.doesNotMatch(navigation,/id="flow-continue"[^>]*hidden/);
  assert.doesNotMatch(navigation,/continueButton\.hidden=state\.loadStatus/);
});

test('draft runtime does not load or probe the server at startup',()=>{
  assert.match(drafts,/async function load\(\)\{const result=await store\.load\(\);beforeAfterFilesInitialized=false;return result\}/);
  assert.doesNotMatch(drafts,/const initialLoad=load\(\)/);
  assert.doesNotMatch(drafts,/void initialLoad/);
  assert.match(drafts,/async function whenReady\(\)/);
  assert.match(drafts,/if\(current\.loadStatus==='ready'\)return current;await load\(\)/);
});

test('New Post can request draft readiness on demand before destructive confirmation',()=>{
  assert.match(navigation,/state=draft\.whenReady\?await draft\.whenReady\(\):draft\.getState\?\.\(\)/);
  assert.match(navigation,/if\(!state\|\|state\.loadStatus!=='ready'\)\{await showDraftLoadError\(\);return\}/);
  assert.match(navigation,/if\(state\.hasDraft&&!\(await confirmDraftReplacement\(\)\)\)return/);
});

test('existing draft requires explicit destructive confirmation',()=>{
  assert.match(navigation,/message:'Ваш черновик будет удален!'/);
  assert.match(navigation,/id:'cancel',type:'cancel',text:'Отмена'/);
  assert.match(navigation,/id:'continue',type:'destructive',text:'Продолжить'/);
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
});

test('Continue is the explicit full draft load boundary and then opens the menu',()=>{
  const start=navigation.indexOf('async function resumeDraft()');
  const end=navigation.indexOf("home.querySelector('#flow-new')",start);
  assert.ok(start>=0&&end>start,'resumeDraft should exist before Home handlers');
  const resume=navigation.slice(start,end);
  assert.match(resume,/overlay\?\.showLoading\?\.\(\)/);
  assert.match(resume,/restored=await draft\.load\(\)/);
  assert.match(resume,/navigation\.reset\(\[STATES\.HOME,STATES\.MENU\]\)/);
  assert.doesNotMatch(resume,/state\.screen/);
  assert.doesNotMatch(resume,/STATES\.(AI|PUBLISH|BEFORE_AFTER)/);
});

test('missing saved session is acknowledged and Continue is hidden for this frontend session',()=>{
  assert.match(overlay,/Нет сохранённых сессий!/);
  assert.match(overlay,/>Продолжить<\/button>/);
  const start=navigation.indexOf('async function resumeDraft()');
  const end=navigation.indexOf("home.querySelector('#flow-new')",start);
  const resume=navigation.slice(start,end);
  assert.match(resume,/if\(!restored\|\|!state\?\.hasDraft\)/);
  assert.match(resume,/await overlay\.showEmpty\(\)/);
  assert.match(resume,/continueButton\.hidden=true/);
});

test('Continue ignores repeated clicks while restore is in flight',()=>{
  assert.match(navigation,/let resumeInFlight=false/);
  assert.match(navigation,/if\(resumeInFlight\)return/);
  assert.match(navigation,/finally\{resumeInFlight=false;continueButton\.disabled=false\}/);
});

test('draft load errors hide restore modal and do not navigate',()=>{
  const start=navigation.indexOf('async function resumeDraft()');
  const end=navigation.indexOf("home.querySelector('#flow-new')",start);
  const resume=navigation.slice(start,end);
  assert.match(resume,/catch\{overlay\?\.hide\?\.\(\);await showDraftLoadError\(\);return\}/);
  assert.match(navigation,/message:'Не удалось проверить сохранённый черновик\. Попробуйте ещё раз\.'/);
});
