import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const tiptap=await readFile(new URL('./composer-tiptap.js',import.meta.url),'utf8');
const state=await readFile(new URL('./composer-state.js',import.meta.url),'utf8');
const mockup=await readFile(new URL('./composer-mockup.js',import.meta.url),'utf8');
const app=await readFile(new URL('./app.js',import.meta.url),'utf8');

test('rich editor exposes one explicit content API without textarea synchronization or global fetch interception',()=>{
  for(const method of ['toPostDocument','getPlainText','getSubmissionValue','setDocument','subscribe','draftValue','restoreDraft','restorePlain','clear'])assert.match(tiptap,new RegExp(`\\b${method}\\b`));
  assert.match(tiptap,/document\.querySelector\('#composer-editor-host'\)/);
  assert.match(tiptap,/window\.CosmoRichEditor=\{[^}]*getPlainText[^}]*getSubmissionValue[^}]*setDocument[^}]*subscribe/);
  assert.doesNotMatch(tiptap,/#text|HTMLTextAreaElement|syncTextarea|text\.value/);
  assert.doesNotMatch(tiptap,/window\.fetch\s*=|nativeFetch/);
});

test('ComposerState owns pending restore until the rich editor lifecycle is ready',()=>{
  assert.match(state,/pendingEditorContent/);
  assert.match(state,/function onRichReady\(\)\{bindRichEditor\(\)\}/);
  assert.match(state,/editor\?\.subscribe\?\.\(\(\)=>onContent\(\)\)/);
  assert.match(state,/restoreEditorContent\(editor,pending\)/);
  assert.doesNotMatch(state,/#text|text\.value|HTMLTextAreaElement|consumePendingEditorContent/);
});

test('Clear, count, Preview and Publish use the rich editor API without textarea fallback',()=>{
  assert.match(mockup,/currentPlainText=.*getPlainText/);
  assert.match(mockup,/currentSubmissionText=.*getSubmissionValue/);
  assert.match(mockup,/richEditor\(\)\?\.clear\?\.\(\)/);
  assert.match(mockup,/count\.textContent=`\$\{currentPlainText\(\)\.length\} символов`/);
  assert.match(mockup,/body\.set\('text',currentSubmissionText\(\)\)/);
  assert.doesNotMatch(mockup,/text\.value/);

  assert.match(app,/function currentPlainText\(\).*getPlainText/s);
  assert.match(app,/function currentSubmissionText\(\).*getSubmissionValue/s);
  assert.match(app,/navigator\.clipboard\.writeText\(plainText\)/);
  assert.match(app,/body\.set\('text',currentSubmissionText\(\)\)/);
  assert.doesNotMatch(app,/#text|text\.value/);
});
