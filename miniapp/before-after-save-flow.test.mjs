import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const controller=await readFile(new URL('./before-after-controller.js',import.meta.url),'utf8');
const bridge=await readFile(new URL('./before-after-bridge.js',import.meta.url),'utf8');
const html=await readFile(new URL('./before-after.html',import.meta.url),'utf8');
const css=await readFile(new URL('./before-after.css',import.meta.url),'utf8');
const ios=await readFile(new URL('./before-after-ios.js',import.meta.url),'utf8');

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

test('Before After uses native label activation for iOS photo picking',()=>{
  assert.match(html,/<label class="empty" for="file">/);
  assert.match(html,/id="file" class="native-file-input"/);
  assert.doesNotMatch(html,/id="file"[^>]* hidden/);
  assert.match(html,/src="\/before-after-ios\.js"/);
  assert.match(ios,/file\.click=\(\)=>\{\}/);
  assert.match(ios,/originalDown\.call\(slot,event\)/);
});

test('Before After delete action is visible and destructive',()=>{
  assert.match(html,/data-delete-photo="before"[^>]*>Удалить</);
  assert.match(html,/data-delete-photo="after"[^>]*>Удалить</);
  assert.match(css,/\.delete-photo\{[^}]*background:var\(--danger/);
  assert.match(ios,/async function removePhoto\(slotName\)/);
  assert.match(ios,/restoreDraft\(nextState/);
});

test('Before After resize tracks pointer on window and commits once at end',()=>{
  assert.match(ios,/window\.addEventListener\('pointermove',onMove/);
  assert.match(ios,/cropHandle\.onpointermove=null/);
  assert.match(ios,/originalMove\.call\(cropHandle,event\)/);
  const moveStart=ios.indexOf('function onMove(event)');
  const moveEnd=ios.indexOf('function onEnd(event)',moveStart);
  assert.doesNotMatch(ios.slice(moveStart,moveEnd),/render\(/);
  assert.doesNotMatch(ios.slice(moveStart,moveEnd),/requestAnimationFrame/);
});

test('Before After back closes immediately and persists in background',()=>{
  const backBranch=bridge.match(/if\(button\.id==='back'\)\{([^}]*)\}/)?.[1]||'';
  const closeAt=backBranch.indexOf("close('back')");
  const persistAt=backBranch.indexOf('persistDraft()');
  assert.ok(closeAt>=0,'back should close the editor');
  assert.ok(persistAt>closeAt,'draft persistence must not block back navigation');
  assert.doesNotMatch(backBranch,/await persistDraft/);
});
