import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./composer-image-generation.js',import.meta.url),'utf8');
const editorSource=fs.readFileSync(new URL('./composer-tiptap.js',import.meta.url),'utf8');
const diagnosticsSource=fs.readFileSync(new URL('./runtime-diagnostics.js',import.meta.url),'utf8');
const panelSource=fs.readFileSync(new URL('./diagnostic-trace-panel.js',import.meta.url),'utf8');

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

test('image acquisition records search and selection diagnostics without logging post text',()=>{
  assert.match(source,/recordRuntimeDiagnostic/);
  assert.match(source,/'http\.request'/);
  assert.match(source,/'http\.response'/);
  assert.match(source,/'search\.completed'/);
  assert.match(source,/'search\.selection\.started'/);
  assert.match(source,/'image\.ui_restored'/);
  assert.match(source,/textLength:String\(body\.text\|\|''\)\.length/);
  assert.doesNotMatch(source,/details:\{[^}]*text:postText/);
});

test('image search chooser uses a feature-owned lazy stylesheet',()=>{
  assert.match(source,/composer-image-search\.css/);
  assert.match(source,/data-cosmo-image-search-style/);
  assert.match(source,/composer-image-search-results/);
});

test('diagnostic panel renders the runtime snapshot at the bottom of Composer and supports Copy',()=>{
  assert.match(panelSource,/document\.querySelector\('#composer-content'\)/);
  assert.match(panelSource,/composerContent\.append\(root\)/);
  assert.match(panelSource,/getRuntimeDiagnosticSnapshot/);
  assert.match(panelSource,/navigator\.clipboard\?\.writeText/);
  assert.match(diagnosticsSource,/cosmo-runtime-diagnostic/);
  assert.match(diagnosticsSource,/function safeDetails/);
});
