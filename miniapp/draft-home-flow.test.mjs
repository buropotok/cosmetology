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
});

test('startup and New Post readiness never GET the server draft',()=>{
  assert.doesNotMatch(drafts,/const initialLoad=load\(\)/);
  assert.match(drafts,/function whenReady\(\)\{return Promise\.resolve\(store\.getState\(\)\)\}/);
  assert.doesNotMatch(drafts,/whenReady[^\n]*load\(\)/);
  assert.match(store,/loadStatus='ready'/);
});

test('New Post uses only live local state before destructive confirmation',()=>{
  const start=navigation.indexOf('async function openNewPost()');
  const end=navigation.indexOf('let resumeInFlight=false',start);
  const flow=navigation.slice(start,end);
  assert.match(flow,/draft\.whenReady\?await draft\.whenReady\(\):draft\.getState\?\.\(\)/);
  assert.doesNotMatch(flow,/draft\.load\(/);
  assert.match(flow,/if\(state\.hasDraft&&!\(await confirmDraftReplacement\(\)\)\)return/);
});

test('New Post does not wait for server draft deletion before entering the menu',()=>{
  assert.match(drafts,/const persistence=store\.clear\(\)/);
  assert.match(drafts,/void persistence/);
  assert.match(drafts,/return Promise\.resolve\(true\)/);
  const committed=navigation.slice(navigation.indexOf('async function commitNewPost'),navigation.indexOf('let newPostInFlight'));
  assert.match(committed,/navigation\.reset\(\[STATES\.HOME,STATES\.MENU\]\)/);
});

test('existing live draft requires explicit destructive confirmation',()=>{
  assert.match(navigation,/message:'Ваш черновик будет удален!'/);
  assert.match(navigation,/id:'cancel',type:'cancel',text:'Отмена'/);
  assert.match(navigation,/id:'continue',type:'destructive',text:'Продолжить'/);
});

test('first Continue is the explicit server restore boundary and opens the menu',()=>{
  assert.match(drafts,/const result=await store\.load\(\)/);
  const start=navigation.indexOf('async function resumeDraft()');
  const end=navigation.indexOf("home.querySelector('#flow-new')",start);
  const resume=navigation.slice(start,end);
  assert.match(resume,/restored=await draft\.load\(\)/);
  assert.match(resume,/navigation\.reset\(\[STATES\.HOME,STATES\.MENU\]\)/);
  assert.doesNotMatch(resume,/state\.screen/);
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
  assert.match(overlay,/>Продолжить<\/button>/);
  assert.match(navigation,/continueButton\.hidden=true/);
});

test('Continue ignores repeated clicks while restore is in flight',()=>{
  assert.match(navigation,/let resumeInFlight=false/);
  assert.match(navigation,/if\(resumeInFlight\)return/);
});

test('draft load errors hide restore modal and do not navigate',()=>{
  const start=navigation.indexOf('async function resumeDraft()');
  const end=navigation.indexOf("home.querySelector('#flow-new')",start);
  const resume=navigation.slice(start,end);
  assert.match(resume,/catch\{overlay\?\.hide\?\.\(\);await showDraftLoadError\(\);return\}/);
});
