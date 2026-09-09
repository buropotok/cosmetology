import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./before-after-bridge.js', import.meta.url), 'utf8');

test('Before After diagnostic panel is available in both Dual and Solo', () => {
  assert.doesNotMatch(source, /function ensureDebugPanel\(\)\{if\(mode!=='dual'\)return null/);
  assert.doesNotMatch(source, /function debugLog\(type,data\)\{if\(mode!=='dual'\)return/);
  assert.match(source, /mode==='solo'\?'Solo import debug':'Draft state debug'/);
  assert.match(source, /ensureDebugPanel\(\);debugLog\('DEBUG ready',\{mode\}\)/);
});

test('Solo restore diagnostics capture input, restored state and post-paint geometry', () => {
  assert.match(source, /debugLog\('SOLO RESTORE requested'/);
  assert.match(source, /function soloGeometry\(\)/);
  assert.match(source, /naturalWidth:image\.naturalWidth/);
  assert.match(source, /transform:image\.style\.transform/);
  assert.match(source, /debugLog\('SOLO RESTORE completed'/);
  assert.match(source, /requestAnimationFrame\(\(\)=>debugLog\('SOLO RESTORE post-paint'/);
  assert.match(source, /debugLog\('SOLO RESTORE rejected'/);
});
