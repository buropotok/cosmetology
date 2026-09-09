import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');

test('solo gesture hint uses the provided SVG and never intercepts photo gestures', () => {
  const source = read('./before-after.js');
  const css = read('./before-after.css');
  const svg = read('./assets/two-finger-swipe-left.svg');
  const hash = createHash('sha256').update(svg).digest('hex');

  assert.equal(hash, '4d7ab60e2b066a90b3a09bdc595335ac216272f0c73628b731af331fbfd9438e');
  assert.match(source, /soloGestureHint\.innerHTML = '<img src="\/assets\/two-finger-swipe-left\.svg" alt="" draggable="false">'/);
  assert.match(source, /await fitSoloSource\(\);\s*composite\.clearCommitted\(\);\s*render\(\);\s*showSoloGestureHint\(\)/);
  assert.match(source, /soloGestureHintTimer = window\.setTimeout\(/);
  assert.match(source, /}, 1800\);/);
  assert.match(source, /hideSoloGestureHint\(\); event\.preventDefault\(\); for \(const pointerId of previewPointers\.keys\(\)\)/);
  assert.match(source, /if \(soloGestureHintTimer\) clearTimeout\(soloGestureHintTimer\); resize\.destroy\(\)/);
  assert.match(css, /\.solo-gesture-hint\{[^}]*pointer-events:none[^}]*transition:opacity \.5s ease/);
  assert.match(css, /\.solo-gesture-hint\.is-hidden\{opacity:0\}/);
});
