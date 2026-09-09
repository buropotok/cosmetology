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
  assert.match(navigation,/import\(['"]\/composer-editor-runtime\.js['"]\)/);
  assert.match(editorRuntime,/export function loadComposerEditorRuntime\(\)/);
  assert.match(navigation,/function getPreparationOverlay\(\)/);
  assert.match(navigation,/Подготовка…/);

  const prepare=navigation.slice(navigation.indexOf('function prepareNewPostRuntime()'),navigation.indexOf('function settlePreparation()'));
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

test('editor preparation is cached and retryable after a load failure',()=>{
  assert.match(navigation,/let editorPreparationPromise,editorPrepared=false/);
  assert.match(navigation,/if\(editorPrepared\)return Promise\.resolve\(true\)/);
  assert.match(navigation,/editorPreparationPromise=undefined;throw error/);
  assert.match(editorRuntime,/let runtimePromise,runtimeReady=false/);
  assert.match(editorRuntime,/if\(runtimeReady\)return Promise\.resolve\(window\.CosmoRichEditor\)/);
  assert.match(editorRuntime,/runtimePromise=undefined/);
  assert.match(editorRuntime,/runtimeReady=false/);
});

test('New Post load failure is contained and retryable',()=>{
  assert.match(navigation,/New Post entry failed to load/);
  assert.match(navigation,/showNewPostLoadError/);
  assert.match(navigation,/newPostEntryPromise=undefined/);
  assert.match(navigation,/router\.show\(['"]home['"],\{notify:false\}\)/);
});
