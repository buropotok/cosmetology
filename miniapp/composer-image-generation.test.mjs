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

test('image acquisition records request, response, fallback and final UI diagnostics without logging post text',()=>{
  assert.match(source,/recordRuntimeDiagnostic/);
  assert.match(source,/'http\.request'/);
  assert.match(source,/'http\.response'/);
  assert.match(source,/'fallback\.opened'/);
  assert.match(source,/'image\.ui_restored'/);
  assert.match(source,/textLength:String\(body\.text\|\|''\)\.length/);
  assert.doesNotMatch(source,/details:\{[^}]*text:postText/);
});

test('internet image search parses multipart files and passes them through the existing Composer image owner',()=>{
  assert.match(source,/contentType\.toLowerCase\(\)\.startsWith\('multipart\/form-data'\)/);
  assert.match(source,/const form=await response\.formData\(\)/);
  assert.match(source,/form\.getAll\('images'\)/);
  assert.match(source,/value instanceof File&&value\.type\.startsWith\('image\/'\)/);
  assert.match(source,/images\?\.addFiles\?\.\(accepted\)/);
  assert.match(source,/const \{files,metadata\}=await requestImages\('\/api\/miniapp\/ai\/image\/search'/);
  assert.doesNotMatch(source,/importToken/);
});

test('multipart search respects the existing ten-image Composer limit',()=>{
  assert.match(source,/const available=Math\.max\(0,10-beforeCount\)/);
  assert.match(source,/const accepted=files\.slice\(0,available\)/);
});

test('diagnostic panel renders the runtime snapshot at the bottom of Composer and supports Copy',()=>{
  assert.match(panelSource,/document\.querySelector\('#composer-content'\)/);
  assert.match(panelSource,/composerContent\.append\(root\)/);
  assert.match(panelSource,/getRuntimeDiagnosticSnapshot/);
  assert.match(panelSource,/navigator\.clipboard\?\.writeText/);
  assert.match(diagnosticsSource,/cosmo-runtime-diagnostic/);
  assert.match(diagnosticsSource,/function safeDetails/);
});
