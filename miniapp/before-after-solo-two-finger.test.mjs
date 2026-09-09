import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');

test('Solo leaves one-finger vertical gestures to native page scrolling', () => {
  const source = read('./before-after.js');
  const css = read('./before-after.css');
  assert.match(css, /body\[data-mode=solo\] #slots,body\[data-mode=solo\] \[data-slot=before\]\{touch-action:pan-y\}/);
  assert.match(source, /if \(mode === 'solo'\) \{\s*if \(previewPointers\.size < 2\) \{ previewGesture = null; previewMoved = false; return; \}\s*event\.preventDefault\(\);/);
});

test('Solo acquires the gesture only with two pointers and pans around their midpoint while zooming', () => {
  const source = read('./before-after.js');
  assert.match(source, /const midpoint = \(a, b\) => \(\{ x: \(a\.x \+ b\.x\) \/ 2, y: \(a\.y \+ b\.y\) \/ 2 \}\)/);
  assert.match(source, /for \(const pointerId of previewPointers\.keys\(\)\) element\.setPointerCapture\?\.\(pointerId\)/);
  assert.match(source, /const center = midpoint\(points\[0\], points\[1\]\), distance = Math\.hypot/);
  assert.match(source, /photo\.x = previewGesture\.x \+ center\.x - previewGesture\.center\.x; photo\.y = previewGesture\.y \+ center\.y - previewGesture\.center\.y/);
  assert.match(source, /photo\.scale = Math\.max\(\.05, Math\.min\(10, previewGesture\.scale \* distance \/ Math\.max\(1, previewGesture\.distance\)\)\)/);
});

test('Dual keeps its existing one-finger pan and tap-to-editor behavior', () => {
  const source = read('./before-after.js');
  assert.match(source, /else if \(points\.length === 1\) \{/);
  assert.match(source, /photo\.x = previewGesture\.x \+ dx; photo\.y = previewGesture\.y \+ dy/);
  assert.match(source, /if \(mode === 'dual' && tap && role && state\.photos\[role\]\) editor\.openPhoto\(role\)/);
});
