import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');

test('composer images expose an indexed replacement contract and open solo editor from a thumbnail', () => {
  const source = read('./composer-image-manager.js');
  assert.match(source, /function replaceAt\(index,file\)/);
  assert.match(source, /openSolo\?\.\(selected,index\)/);
  assert.match(source, /replaceAt,/);
});

test('Before After controller keeps dual default and provides isolated solo session', () => {
  const source = read('./before-after-controller.js');
  assert.match(source, /currentMode='dual'/);
  assert.match(source, /function openSolo\(file,index\)/);
  assert.match(source, /ensureOverlay\('solo'\)/);
  assert.match(source, /manager\.replaceAt\(soloIndex,file\)/);
  assert.match(source, /currentMode==='solo'/);
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
