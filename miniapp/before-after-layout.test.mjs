import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');

test('Before After layout actions are scoped to toolbar controls, never the canvas', () => {
  const source = read('./before-after.js');
  const html = read('./before-after.html');

  assert.match(html, /id="slots" data-layout="horizontal"/);
  assert.match(source, /document\.querySelectorAll\('\.toolbar \[data-layout\]'\)\.forEach\(button => button\.onclick/);
  assert.doesNotMatch(source, /document\.querySelectorAll\('\[data-layout\]'\)\.forEach\(button => button\.onclick/);
});
