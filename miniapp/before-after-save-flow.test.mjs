import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const controller=await readFile(new URL('./before-after-controller.js',import.meta.url),'utf8');
const bridge=await readFile(new URL('./before-after-bridge.js',import.meta.url),'utf8');
const html=await readFile(new URL('./before-after.html',import.meta.url),'utf8');
const css=await readFile(new URL('./before-after.css',import.meta.url),'utf8');
const entry=await readFile(new URL('./before-after.js',import.meta.url),'utf8');
const resize=await readFile(new URL('./before-after/resize.js',import.meta.url),'utf8');

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

test('Before After uses native label activation for photo picking without an iOS patch runtime',()=>{
  assert.match(html,/<label class="empty" for="file">/);
  assert.match(html,/id="file" class="native-file-input"/);
  assert.doesNotMatch(html,/id="file"[^>]* hidden/);
  assert.doesNotMatch(html,/before-after-ios\.js/);
  assert.match(entry,/if \(!event\.target\?\.closest\?\.\('label\[for="file"\]'\)\) file\.click\(\)/);
});

test('Before After delete action is visible and owned by the entry component',()=>{
  assert.match(html,/data-delete-photo="before"[^>]*>Удалить</);
  assert.match(html,/data-delete-photo="after"[^>]*>Удалить</);
  assert.match(css,/\.delete-photo\{[^}]*background:var\(--danger/);
  assert.match(entry,/document\.querySelectorAll\('\[data-delete-photo\]'\)/);
  assert.match(entry,/state\.photos\[role\] = null/);
});

test('Before After resize tracks pointer on window through the resize owner',()=>{
  assert.match(resize,/window\.addEventListener\('pointermove',\s*onPointerMove,\s*\{\s*capture:\s*true,\s*passive:\s*false\s*\}\)/);
  assert.match(resize,/window\.addEventListener\('pointerup',\s*onPointerEnd,\s*true\)/);
  assert.match(resize,/window\.addEventListener\('pointercancel',\s*onPointerEnd,\s*true\)/);
  assert.match(resize,/state\.cropHeight = next/);
  assert.doesNotMatch(resize,/setPointerCapture|releasePointerCapture/);
});

test('Before After action buttons do not force draft persistence',()=>{
  const backBranch=bridge.match(/if\(button\.id==='back'\)\{([^}]*)\}/)?.[1]||'';
  assert.match(backBranch,/clearTimeout\(saveTimer\)/,'back should cancel a pending autosave');
  assert.match(backBranch,/close\('back'\)/,'back should close the editor');
  assert.doesNotMatch(backBranch,/persistDraft\(/,'back must not force draft persistence');

  const saveStart=bridge.indexOf('async function save()');
  const saveEnd=bridge.indexOf("window.addEventListener('cosmo-before-after-change'",saveStart);
  const saveBody=bridge.slice(saveStart,saveEnd);
  assert.match(saveBody,/clearTimeout\(saveTimer\)/,'save should cancel a pending autosave');
  assert.doesNotMatch(saveBody,/persistDraft\(/,'save must not force BA draft persistence');
  assert.match(saveBody,/controller\.save\(blob,/,'save should still pass the composite to Publisher');
});
