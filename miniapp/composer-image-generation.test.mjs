import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./composer-image-generation.js',import.meta.url),'utf8');
const editorSource=fs.readFileSync(new URL('./composer-tiptap.js',import.meta.url),'utf8');

test('image generation reads the current rich editor text with textarea fallback',()=>{
  assert.match(source,/window\.CosmoRichEditor\?\.getPlainText\?\.\(\)\?\?text\.value/);
  assert.match(source,/const postText=currentPostText\(\)/);
  assert.doesNotMatch(source,/const postText=text\.value\.trim\(\)/);
});

test('empty image-generation input focuses Composer through its public contract',()=>{
  assert.match(source,/typeof richEditor\?\.focus==='function'/);
  assert.match(source,/richEditor\.focus\(\)/);
  assert.match(source,/else text\.focus\(\)/);
  assert.doesNotMatch(source,/richEditor\?\.editor/);
  assert.doesNotMatch(source,/CosmoRichEditor\?\.element/);
  assert.match(editorSource,/function focus\(\)\{editor\.commands\.focus\(\)\}/);
  assert.match(editorSource,/window\.CosmoRichEditor=\{[^}]*getPlainText,focus,getSubmissionValue/);
});
