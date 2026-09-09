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
  assert.match(app, /composer-photo-stage-track img/);
  assert.match(app, /openActivePhotoEditor\(\)/);
});

test('Before After controller keeps its public API stable and destroys each isolated solo session on close', () => {
  const source = read('./before-after-controller.js');
  assert.match(source, /currentMode='dual'/);
  assert.match(source, /function open\(\)/);
  assert.match(source, /request\?\.mode==='solo'/);
  assert.match(source, /ensureOverlay\('solo'\)/);
  assert.match(source, /manager\.replaceAt\(soloIndex,file\)/);
  assert.match(source, /function destroySolo\(\)\{if\(!overlay\)return;overlay\.remove\(\);overlay=null;soloIndex=null;soloFile=null;currentMode='dual'\}/);
  assert.match(source, /if\(currentMode==='solo'\)destroySolo\(\);else overlay\.hidden=true/);
  assert.match(source, /Object\.freeze\(\{open,close,clear,save,saveDraft,saveAsset,removeAsset,swapAssets\}\)/);
  assert.doesNotMatch(source, /Object\.freeze\(\{[^}]*openSolo/);
});

test('solo stays hidden until its source file is restored, preventing native file-picker click-through', () => {
  const source = read('./before-after-controller.js');
  assert.match(source, /async function revealSolo\(current\)/);
  assert.match(source, /if\(!await restoreSoloIntoFrame\(\)\)return false/);
  assert.match(source, /current\.hidden=false;return true/);
  assert.match(source, /const current=ensureOverlay\('solo'\);current\.hidden=true/);
  assert.match(source, /void revealSolo\(current\)/);
});

test('solo bridge accepts a parent-window image file and does not persist Before After draft state', () => {
  const source = read('./before-after-bridge.js');
  assert.match(source, /mode=params\.get\('mode'\)==='solo'\?'solo':'dual'/);
  assert.match(source, /if\(mode!=='dual'\)return false/);
  assert.match(source, /async function restoreSolo\(file,index\)/);
  assert.match(source, /typeof file\.size!=='number'/);
  assert.match(source, /typeof file\.arrayBuffer!=='function'/);
  assert.doesNotMatch(source, /file instanceof File/);
});

test('solo is source-only, matches the canvas to the source ratio and contains the imported image', () => {
  const source = read('./before-after.js');
  assert.match(source, /file\.disabled = true/);
  assert.match(source, /document\.querySelectorAll\('\.empty'\)\.forEach\(element => \{ element\.style\.display = 'none'; \}\)/);
  assert.match(source, /if \(mode === 'solo'\) \{ file\.value = ''; return; \}/);
  assert.match(source, /element\.onclick = event => \{ if \(mode === 'solo'\) return;/);
  assert.match(source, /return width > 0 && height > 0 \? `\$\{width\}\/\$\{height\}` : '16\/9'/);
  assert.match(source, /state\.selectedRatio = sourceRatio\(photo\)/);
  assert.match(source, /geometry\.fitContain\(photo, rect\)/);
});

test('solo exposes deterministic fit controls and a full-turn rotation slider', () => {
  const source = read('./before-after.js');
  const css = read('./before-after.css');
  assert.match(source, /slider\.min = '-180'; slider\.max = '180'; slider\.step = '1'/);
  assert.match(source, /data-solo-fit="width">По ширине/);
  assert.match(source, /data-solo-fit="height">По высоте/);
  assert.match(source, /data-solo-fit="contain">Вписать целиком/);
  assert.match(source, /kind === 'width' \? 'fitWidth' : kind === 'height' \? 'fitHeight' : kind === 'contain' \? 'fitContain'/);
  assert.match(css, /\.solo-fit-actions/);
});

test('solo shares the Dual gesture lifecycle while tap only opens the nested editor in Dual', () => {
  const source = read('./before-after.js');
  assert.match(source, /event\.preventDefault\(\); element\.setPointerCapture\?\.\(event\.pointerId\); previewSlot = role; previewStarted = performance\.now\(\)/);
  assert.doesNotMatch(source, /if \(mode !== 'solo'\) element\.setPointerCapture/);
  assert.doesNotMatch(source, /if \(!previewMoved && mode === 'solo'\) element\.setPointerCapture/);
  assert.match(source, /if \(!previewMoved && distance <= 5\) return;/);
  assert.match(source, /const tap = !moved && performance\.now\(\) - previewStarted < 350; if \(mode === 'dual' && tap && role && state\.photos\[role\]\) editor\.openPhoto\(role\)/);
});

test('solo photo taps stay inline and expose main rotation UI', () => {
  const source = read('./before-after.js');
  const css = read('./before-after.css');
  assert.match(source, /if \(mode === 'dual' && tap && role && state\.photos\[role\]\) editor\.openPhoto\(role\)/);
  assert.doesNotMatch(source, /if \(mode === 'solo'\) return; const tap/);
  assert.match(source, /className = 'solo-rotation'/);
  assert.match(css, /body\[data-mode=solo\] \[data-slot=after\]/);
  assert.match(css, /\.solo-rotation/);
});

test('watermark stays live when the photo moves and is composited fresh on export', () => {
  const source = read('./before-after.js');
  const composite = read('./before-after/composite.js');
  const editor = read('./before-after/editor.js');
  assert.match(source, /previewWatermark\.style\.transform/);
  assert.match(source, /getWatermark: \(\) => \(\{ selectedWatermark: state\.selectedWatermark, watermarkState: state\.watermarkState \}\)/);
  assert.match(composite, /async function photoBlob\(\)/);
  assert.match(composite, /const wm = await loadImage\(selectedWatermark\.url\)/);
  assert.match(composite, /async function publicBlob\(\) \{\s*return blob\(\);/);
  assert.match(editor, /const baseBlob = await composite\.photoBlob\(\)/);
  assert.match(editor, /await composite\.commitWatermark\(\)/);
});

test('solo keeps watermark editing in the dedicated editor while photo taps stay inline', () => {
  const source = read('./before-after.js');
  const watermarks = read('./before-after/watermarks.js');
  assert.match(source, /if \(mode === 'dual' && tap && role && state\.photos\[role\]\) editor\.openPhoto\(role\)/);
  assert.doesNotMatch(source, /if \(tap && role && state\.photos\[role\]\) editor\.openPhoto\(role\)/);
  assert.match(watermarks, /await getEditor\(\)\.openWatermark\(\)/);
});
