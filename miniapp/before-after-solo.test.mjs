import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');

test('composer images expose indexed replacement and request solo mode from the existing Before After entry', () => {
  const source = read('./composer-image-manager.js');
  assert.match(source, /function replaceAt\(index,file\)/);
  assert.match(source, /CosmoBeforeAfter\?\.open\?\.\(\{mode:'solo',file:selected,index\}\)/);
  assert.match(source, /replaceAt,/);
});

test('Before After controller keeps its public API stable while open accepts an isolated solo request', () => {
  const source = read('./before-after-controller.js');
  assert.match(source, /currentMode='dual'/);
  assert.match(source, /function open\(\)/);
  assert.match(source, /request\?\.mode==='solo'/);
  assert.match(source, /ensureOverlay\('solo'\)/);
  assert.match(source, /manager\.replaceAt\(soloIndex,file\)/);
  assert.match(source, /currentMode==='solo'/);
  assert.match(source, /Object\.freeze\(\{open,close,clear,save,saveDraft,saveAsset,removeAsset,swapAssets\}\)/);
  assert.doesNotMatch(source, /Object\.freeze\(\{[^}]*openSolo/);
});

test('solo bridge does not persist Before After draft state', () => {
  const source = read('./before-after-bridge.js');
  assert.match(source, /mode=params\.get\('mode'\)==='solo'\?'solo':'dual'/);
  assert.match(source, /if\(mode!=='dual'\)return false/);
  assert.match(source, /async function restoreSolo\(file,index\)/);
});

test('solo editor disables nested photo editor and exposes main rotation UI', () => {
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
