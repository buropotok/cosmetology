import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./before-after.js', import.meta.url), 'utf8');

test('Solo starts image manipulation only from an exact two-pointer pair', () => {
  assert.match(source, /if \(points\.length < 2\) \{ previewGesture = null; return; \}/);
  assert.match(source, /if \(points\.length > 2\) \{ previewGesture = null; return; \}/);
  assert.match(source, /if \(previewPointers\.size < 2\) \{ previewGesture = null; previewMoved = false; return; \}/);
  assert.match(source, /if \(previewPointers\.size > 2\) \{ previewGesture = null; previewMoved = false; return; \}/);
  assert.match(source, /if \(points\.length > 2 \|\| !previewGesture \|\| previewGesture\.type !== 'solo'\) return;/);
  assert.match(source, /if \(mode === 'solo' && previewPointers\.size >= 2 && !previewPointers\.has\(event\.pointerId\)\) return;/);
});

test('Solo discards stale pointer state when a new primary contact starts', () => {
  assert.match(source, /if \(mode === 'solo' && event\.isPrimary && previewPointers\.size\) resetSoloPointers\(element\);/);
  assert.match(source, /function resetSoloPointers\(element\) \{\s*releasePreviewCaptures\(element\);\s*previewPointers\.clear\(\);\s*previewGesture = null;\s*previewSlot = null;\s*previewMoved = false;\s*\}/);
});

test('Solo cleans pointer state when capture is lost and never promotes one pointer to pan', () => {
  assert.match(source, /element\.onlostpointercapture = event => \{ if \(mode !== 'solo' \|\| !previewPointers\.has\(event\.pointerId\)\) return;/);
  const soloStart = source.indexOf("if (mode === 'solo') {\n      if (points.length < 2) return;");
  const soloMove = source.slice(soloStart, source.indexOf("} else if (points.length === 1)", soloStart));
  assert.ok(soloStart >= 0, 'Solo move branch should exist');
  assert.doesNotMatch(soloMove, /photo\.x = .*dx|photo\.y = .*dy|type: 'pan'/);
});
