import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');

test('Solo import becomes measurable before fit and visible only after post-layout fit', () => {
  const controller = read('./before-after-controller.js');
  const bridge = read('./before-after-bridge.js');
  const source = read('./before-after.js');

  assert.match(controller, /current\.style\.visibility='hidden';current\.hidden=false;\s*await nextPaint\(\)/);
  assert.match(controller, /if\(!await fitSoloIntoFrame\(\)\)\{current\.hidden=true;current\.style\.visibility='';return false\}/);
  assert.match(controller, /current\.style\.visibility='';return true/);
  assert.match(bridge, /async function fitSolo\(\)\{if\(mode!=='solo'\)return false;const fit=window\.CosmoBeforeAfterSolo\?\.fitSource\?\.\(\)/);
  assert.match(bridge, /debugLog\('SOLO FIT after layout',soloGeometry\(\)\)/);
  assert.match(source, /async function refitSoloSource\(\)/);
  assert.match(source, /fitSource: refitSoloSource/);
});
