import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');

test('composer thumbnails select carousel photos while the active stage opens that photo in solo mode', () => {
  const app = read('./app.js');
  const manager = read('./composer-image-manager.js');
  assert.match(manager, /function replaceAt\(index,file\)/);
  assert.match(manager, /replaceAt,/);
  assert.doesNotMatch(manager, /CosmoBeforeAfter\?\.open/);
  assert.match(app, /img\.addEventListener\('click',\(\)=>selectPhoto\(index\)\)/);
  assert.match(app, /function openActivePhotoEditor\(\)/);
  assert.match(app, /CosmoBeforeAfter\?\.open\?\.\(\{mode:'solo',file:files\[index\],index\}\)/);
  assert.match(app, /stage\.onclick=event=>\{if\(event\.target\?\.closest\?\('\.composer-photo-stage-track img'\)\)openActivePhotoEditor\(\)\}/);
});

test('Before After controller keeps its public API stable and destroys each isolated solo session on close', () => {
  const source = read('./before-after-controller.js');
  assert.match(source, /currentMode='dual'/);
  assert.match(source, /function open\(\)/);
  assert.match(source, /request\?\.mode==='solo'/);
  assert.match(source, /ensureOverlay\('solo'\)/);
  assert.match(source, /manager\.replaceAt\(soloIndex,file\)/);
  assert.match(source, /function destroySolo\(\)/);
  assert.match(source, /overlay\.remove\(\);overlay=null;soloIndex=null;soloFile=null;currentMode='dual'/);
  assert.match(source, /if\(currentMode==='solo'\)destroySolo\(\)/);
  assert.match(source, /Object\.freeze\(\{open,close,clear,save,saveDraft,saveAsset,removeAsset,swapAssets\}\)/);
  assert.doesNotMatch(source, /Object\.freeze\(\{[^}]*openSolo/);
});

test('solo bridge accepts a parent-window image file and does not persist Before After draft state', () => {
  const source = read('./before-after-bridge.js');
  assert.match(source, /mode=params\.get\('mode'\)==='solo'\?'solo':'dual'/);
  assert.match(source, /if\(mode!=='dual'\)return false/);
  assert.match(source, /async function restoreSolo\(file,index\)/);
  assert.match(source, /if\(mode!=='solo'\|\|!file\|\|typeof file\.size!=='number'\|\|typeof file\.type!=='string'\)return false/);
  assert.doesNotMatch(source, /file instanceof File/);
});

test('solo photo taps stay inline and expose main rotation UI', () => {
  const source = read('./before-after.js');
  const css = read('./before-after.css');
  assert.match(source, /mode === 'dual' && tap/);
  assert.match(source, /className = 'solo-rotation'/);
  assert.match(css, /body\[data-mode=solo\] \[data-slot=after\]/);
  assert.match(css, /\.solo-rotation/);
});

test('solo keeps watermark editing in the dedicated editor while photo taps stay inline', () => {
  const source = read('./before-after.js');
  const watermarks = read('./before-after/watermarks.js');
  assert.match(source, /mode === 'dual' && tap && role && state\.photos\[role\]\) editor\.openPhoto\(role\)/);
  assert.match(watermarks, /await getEditor\(\)\.openWatermark\(\)/);
});
