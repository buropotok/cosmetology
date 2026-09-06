import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const controller=await readFile(new URL('./before-after-controller.js',import.meta.url),'utf8');
const bridge=await readFile(new URL('./before-after-bridge.js',import.meta.url),'utf8');
const html=await readFile(new URL('./before-after.html',import.meta.url),'utf8');
const css=await readFile(new URL('./before-after.css',import.meta.url),'utf8');

test('Before After shows a blocking save loader',()=>{
  assert.match(html,/id="saveOverlay"/);
  assert.match(html,/Загрузка в редактор/);
  assert.match(html,/id="saveStage"/);
  assert.match(css,/\.save-spinner/);
  assert.match(bridge,/showLoader\(\)/);
});

test('Before After persists to R2 before importing into composer',()=>{
  const saveStart=controller.indexOf('async function save(');
  const saveBody=controller.slice(saveStart,controller.indexOf("window.addEventListener('message'",saveStart));
  const persistAt=saveBody.indexOf('persistResult(file)');
  const importAt=saveBody.indexOf('applyImageFile(file)');
  assert.ok(persistAt>=0,'result should be persisted before composer import');
  assert.ok(importAt>persistAt,'composer import must happen only after durable server persistence');
  assert.doesNotMatch(controller,/webApp\.downloadFile\(/);
  assert.doesNotMatch(controller,/downloadToGallery/);
});

test('Before After bridge passes Blob directly without ArrayBuffer cloning',()=>{
  assert.doesNotMatch(bridge,/\.arrayBuffer\(/);
  assert.doesNotMatch(bridge,/image:\{buffer/);
  assert.match(bridge,/controller\.save\(blob,/);
});

test('save stages explain durable save and editor import progress',()=>{
  assert.match(controller,/Сохраняем изображение/);
  assert.match(controller,/Добавляем изображение/);
  assert.doesNotMatch(controller,/Сохраняем копию в галерею/);
});
