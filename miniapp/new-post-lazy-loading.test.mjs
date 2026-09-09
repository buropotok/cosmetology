import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');
const navigation=await readFile(new URL('./navigation.js',import.meta.url),'utf8');
const editorRuntime=await readFile(new URL('./composer-editor-runtime.js',import.meta.url),'utf8');

test('New Post entry is not part of the startup bootstrap path',()=>{
  assert.doesNotMatch(bootstrap,/import\(['"]\/new-post-entry\.js['"]\)/);
});

test('navigation lazy-loads New Post entry through the New Post lifecycle',()=>{
  assert.match(navigation,/async function loadNewPostEntry\(\)/);
  assert.match(navigation,/import\(['"]\/new-post-entry\.js['"]\)/);
  assert.match(navigation,/const composerView=await getNewPostEntryOrReport\(\)/);
});

test('Tiptap is prepared from the first New Post or Continue interaction instead of cold start',()=>{
  assert.doesNotMatch(bootstrap,/import\(['"]\/composer-editor-runtime\.js['"]\)/);
  assert.match(navigation,/function prepareNewPostRuntime\(\)/);
  assert.match(navigation,/function settlePreparation\(\)\{return prepareNewPostRuntime\(\)/);
  assert.match(navigation,/import\(['"]\/runtime-diagnostics\.js['"]\)/);
  assert.match(navigation,/module:'composer-editor-runtime',load:\(\)=>import\(['"]\/composer-editor-runtime\.js['"]\)/);
  assert.match(editorRuntime,/export function loadComposerEditorRuntime\(\)/);
  assert.match(navigation,/function getPreparationOverlay\(\)/);
  assert.match(navigation,/Подготовка…/);

  const prepare=navigation.slice(navigation.indexOf('function prepareNewPostRuntime()'),navigation.indexOf('function settlePreparation()'));
  assert.ok(prepare.indexOf('window.CosmoMiniAppReady')>=0);
  assert.ok(prepare.indexOf('window.CosmoMiniAppReady')<prepare.indexOf("import('/composer-editor-runtime.js')"));

  const newPost=navigation.slice(navigation.indexOf('async function openNewPost()'),navigation.indexOf('let resumeInFlight=false'));
  assert.ok(newPost.indexOf('const preparation=settlePreparation()')<newPost.indexOf('const draft=window.CosmoSofaDraft'));
  assert.match(newPost,/await prepareNewPostOrReport\(preparation\)/);
  assert.ok(newPost.indexOf('await prepareNewPostOrReport(preparation)')<newPost.lastIndexOf('await commitNewPost(draft)'));

  const resumeStart=navigation.indexOf('async function resumeDraft()');
  const resumeEnd=navigation.indexOf("home.querySelector('#flow-new')",resumeStart);
  assert.ok(resumeStart>=0&&resumeEnd>resumeStart,'resumeDraft should exist before Home handlers');
  const resume=navigation.slice(resumeStart,resumeEnd);
  assert.ok(resume.indexOf('const preparation=settlePreparation()')<resume.indexOf('restored=await draft.load()'));
  assert.ok(resume.indexOf('const prepared=await preparation')<resume.indexOf('navigation.reset([STATES.HOME,STATES.MENU])'));
});

test('editor module failures are logged, skipped where dependent, and do not block New Post',()=>{
  assert.match(navigation,/let diagnosticsPromise,editorPreparationPromise,editorPrepared=false/);
  assert.match(navigation,/if\(editorPrepared\)return Promise\.resolve\(\{ok:true,cached:true\}\)/);
  assert.match(navigation,/if\(!editorPrepared\)editorPreparationPromise=undefined/);
  assert.match(navigation,/return\{ok:false,error\}/);

  assert.match(editorRuntime,/loadRuntimeModule/);
  assert.match(editorRuntime,/skipRuntimeModule/);
  assert.match(editorRuntime,/const bridge=tiptap\.ok/);
  assert.match(editorRuntime,/const fixes=tiptap\.ok/);
  assert.match(editorRuntime,/dependency:'composer-tiptap'/);
  assert.match(editorRuntime,/const ok=tiptap\.ok&&bridge\.ok/);
  assert.match(editorRuntime,/if\(!ok\)runtimePromise=undefined/);

  const prepareUi=navigation.slice(navigation.indexOf('async function prepareNewPostOrReport'),navigation.indexOf('let newPostEntryPromise'));
  assert.match(prepareUi,/completed with module failures/);
  assert.doesNotMatch(prepareUi,/showNewPostLoadError/);
  assert.match(prepareUi,/return true/);

  const resumeStart=navigation.indexOf('async function resumeDraft()');
  const resumeEnd=navigation.indexOf("home.querySelector('#flow-new')",resumeStart);
  assert.ok(resumeStart>=0&&resumeEnd>resumeStart,'resumeDraft should exist before Home handlers');
  const resume=navigation.slice(resumeStart,resumeEnd);
  assert.match(resume,/completed with module failures/);
  assert.doesNotMatch(resume,/prepared.*showNewPostLoadError/);
});

test('New Post entry load failure remains contained and retryable',()=>{
  assert.match(navigation,/New Post entry failed to load/);
  assert.match(navigation,/showNewPostLoadError/);
  assert.match(navigation,/newPostEntryPromise=undefined/);
  assert.match(navigation,/router\.show\(['"]home['"],\{notify:false\}\)/);
});
