import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const navigation=await readFile(new URL('./navigation.js',import.meta.url),'utf8');
const drafts=await readFile(new URL('./drafts.js',import.meta.url),'utf8');
const store=await readFile(new URL('./draft-store.js',import.meta.url),'utf8');
const overlay=await readFile(new URL('./draft-loading-overlay.js',import.meta.url),'utf8');

test('Home shows New Post and Continue immediately without draft readiness',()=>{
  assert.match(navigation,/id="flow-new"[^>]*>Новый пост<\/button>/);
  assert.match(navigation,/id="flow-continue"[^>]*>Продолжить<\/button>/);
  assert.doesNotMatch(navigation,/id="flow-continue"[^>]*hidden/);
  assert.doesNotMatch(navigation,/continueButton\.hidden=state\.loadStatus/);
});

test('startup and New Post readiness never GET the server draft',()=>{
  assert.doesNotMatch(drafts,/const initialLoad=load\(\)/);
  assert.match(drafts,/function whenReady\(\)\{return Promise\.resolve\(store\.getState\(\)\)\}/);
  assert.doesNotMatch(drafts,/whenReady[^\n]*load\(\)/);
  assert.match(store,/loadStatus='ready'/);
});

test('New Post always requires explicit destructive confirmation before inspecting local draft state',()=>{
  const start=navigation.indexOf('async function openNewPost()');
  const end=navigation.indexOf('let resumeInFlight=false',start);
  const flow=navigation.slice(start,end);
  assert.match(flow,/if\(!\(await confirmDraftReplacement\(\)\)\)return/);
  assert.doesNotMatch(flow,/state\.hasDraft&&!\(await confirmDraftReplacement\(\)\)/);
  const confirm=flow.indexOf('await confirmDraftReplacement()');
  const stateRead=flow.indexOf('draft.whenReady?await draft.whenReady():draft.getState?.()');
  assert.ok(confirm>=0&&stateRead>confirm,'confirmation must happen before local draft state is inspected');
  assert.doesNotMatch(flow,/draft\.load\(/);
});

test('New Post does not wait for server draft deletion before entering the menu',()=>{
  assert.match(drafts,/const persistence=store\.clear\(\)/);
  assert.match(drafts,/void persistence/);
  assert.match(drafts,/return Promise\.resolve\(true\)/);
  const committed=navigation.slice(navigation.indexOf('async function commitNewPost'),navigation.indexOf('let newPostInFlight'));
  assert.match(committed,/await draft\.clear\(\)/);
  assert.match(committed,/cosmo-new-post/);
  assert.match(committed,/cosmo-ai-wizard-reset/);
  assert.match(committed,/navigation\.reset\(\[STATES\.HOME,STATES\.MENU\]\)/);
});

test('New Post warning offers Cancel and Continue and cancel commits nothing',()=>{
  assert.match(navigation,/message:'Ваш черновик будет удален!'/);
  assert.match(navigation,/id:'cancel',type:'cancel',text:'Отмена'/);
  assert.match(navigation,/id:'continue',type:'destructive',text:'Продолжить'/);
  const cancelGuard=navigation.indexOf("if(!(await confirmDraftReplacement()))return;");
  const commit=navigation.indexOf('await commitNewPost(draft);',cancelGuard);
  assert.ok(cancelGuard>=0&&commit>cancelGuard);
});

test('first Continue is the explicit server restore boundary and opens the menu',()=>{
  assert.match(drafts,/const result=await store\.load\(\)/);
  const start=navigation.indexOf('async function resumeDraft()');
  const end=navigation.indexOf("home.querySelector('#flow-new')",start);
  assert.ok(start>=0&&end>start,'resumeDraft should exist before Home handlers');
  const resume=navigation.slice(start,end);
  assert.match(resume,/overlay\?\.showLoading\?\.\(cancelRestore\)/);
  assert.match(resume,/restored=await draft\.load\(\)/);
  assert.match(resume,/navigation\.reset\(\[STATES\.HOME,STATES\.MENU\]\)/);
  assert.doesNotMatch(resume,/state\.screen/);
  assert.doesNotMatch(resume,/STATES\.(AI|PUBLISH|BEFORE_AFTER)/);
});

test('restore overlay exposes Cancel and cancellation aborts restore, releases retry guard, and returns Home',()=>{
  assert.match(overlay,/cosmo-draft-load-action[^>]*>Отмена<\/button>/);
  assert.match(overlay,/function showLoading\(cancel\)/);
  assert.match(overlay,/onCancel=typeof cancel==='function'\?cancel:null/);
  const start=navigation.indexOf('async function resumeDraft()');
  const end=navigation.indexOf("home.querySelector('#flow-new')",start);
  const resume=navigation.slice(start,end);
  assert.match(resume,/const operation=\+\+resumeOperation/);
  assert.match(resume,/resumeOperation\+\+;\s*resumeInFlight=false;\s*continueButton\.disabled=false/);
  assert.match(resume,/draft\.cancelRestore\?\.\(\)/);
  assert.match(resume,/navigation\.reset\(\[STATES\.HOME\]\)/);
  assert.match(resume,/operation!==resumeOperation/);
});

test('restored live session makes later Continue network-free',()=>{
  assert.match(drafts,/if\(liveSessionActive\)return \{liveSession:true\}/);
  assert.match(drafts,/if\(result\)liveSessionActive=true/);
  assert.match(drafts,/return liveSessionActive\?\{\.\.\.current,hasDraft:true\}:current/);
});

test('New Post creates a live empty frontend session without waiting for persistence',()=>{
  assert.match(drafts,/function clear\(\)\{\s*liveSessionActive=true/);
  assert.match(drafts,/const persistence=store\.clear\(\)/);
  assert.match(drafts,/return Promise\.resolve\(true\)/);
});

test('missing saved session is acknowledged and Continue is hidden for this frontend session',()=>{
  assert.match(overlay,/Нет сохранённых сессий!/);
  assert.match(overlay,/>Отмена<\/button>/);
  const start=navigation.indexOf('async function resumeDraft()');
  const end=navigation.indexOf("home.querySelector('#flow-new')",start);
  const resume=navigation.slice(start,end);
  assert.match(resume,/if\(!restored\|\|!state\?\.hasDraft\)/);
  assert.match(resume,/await overlay\.showEmpty\(\)/);
  assert.match(resume,/continueButton\.hidden=true/);
});

test('Continue ignores repeated clicks while an active restore is in flight',()=>{
  assert.match(navigation,/let resumeInFlight=false,resumeOperation=0/);
  assert.match(navigation,/if\(resumeInFlight\)return/);
  assert.match(navigation,/if\(operation===resumeOperation\)\{resumeInFlight=false;continueButton\.disabled=false\}/);
});

test('draft load errors hide restore modal and do not navigate',()=>{
  const start=navigation.indexOf('async function resumeDraft()');
  const end=navigation.indexOf("home.querySelector('#flow-new')",start);
  const resume=navigation.slice(start,end);
  assert.match(resume,/catch\{if\(cancelled\)return;overlay\?\.hide\?\.\(\);await showDraftLoadError\(\);return\}/);
  assert.match(navigation,/message:'Не удалось проверить сохранённый черновик\. Попробуйте ещё раз\.'/);
});
