import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const tiptap=await readFile(new URL('./composer-tiptap.js',import.meta.url),'utf8');
const state=await readFile(new URL('./composer-state.js',import.meta.url),'utf8');
const mockup=await readFile(new URL('./composer-mockup.js',import.meta.url),'utf8');
const app=await readFile(new URL('./app.js',import.meta.url),'utf8');

test('rich editor exposes one explicit content API without intercepting global fetch',()=>{
  for(const method of ['toPostDocument','getPlainText','getSubmissionValue','setDocument','subscribe','draftValue','restoreDraft','restorePlain','clear'])assert.match(tiptap,new RegExp(`\\b${method}\\b`));
  assert.match(tiptap,/window\.CosmoRichEditor=\{[^}]*getPlainText[^}]*getSubmissionValue[^}]*setDocument[^}]*subscribe/);
  assert.doesNotMatch(tiptap,/window\.fetch\s*=/);
  assert.doesNotMatch(tiptap,/nativeFetch/);
});

test('ComposerState delegates canonical text reads and change notifications to the rich editor',()=>{
  assert.match(state,/getRichEditor\(\)\?\.getPlainText\?\.\(\)\?\?text\.value/);
  assert.match(state,/editor\?\.subscribe\?\.\(\(\)=>onContent\(\)\)/);
  assert.match(state,/cosmo-rich-ready/);
  assert.match(state,/currentContent\(\).*draftValue/s);
});

test('Clear, count, Preview and Publish use editor API with textarea only as fallback',()=>{
  assert.match(mockup,/currentPlainText=.*getPlainText/);
  assert.match(mockup,/currentSubmissionText=.*getSubmissionValue/);
  assert.match(mockup,/if\(current\?\.clear\)current\.clear\(\)/);
  assert.match(mockup,/count\.textContent=`\$\{currentPlainText\(\)\.length\} символов`/);
  assert.match(mockup,/body\.set\('text',currentSubmissionText\(\)\)/);
  assert.doesNotMatch(mockup,/body\.set\('text',text\.value\)/);

  assert.match(app,/function currentPlainText\(\).*getPlainText/s);
  assert.match(app,/function currentSubmissionText\(\).*getSubmissionValue/s);
  assert.match(app,/navigator\.clipboard\.writeText\(plainText\)/);
  assert.match(app,/body\.set\('text',currentSubmissionText\(\)\)/);
  assert.doesNotMatch(app,/body\.set\('text',text\.value\)/);
});
