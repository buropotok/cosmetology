import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('Before/After entry delegates owned responsibilities to modules', async () => {
  const entry = await read('./before-after.js');
  for (const module of ['state', 'geometry', 'composite', 'editor', 'watermarks', 'resize']) {
    assert.match(entry, new RegExp(`before-after/${module}\\.js`));
  }
});

test('photo editor save does not refit composite scale', async () => {
  const editor = await read('./before-after/editor.js');
  assert.doesNotMatch(editor, /refitForComposite/);
});

test('resize owns the WebKit-safe window pointer lifecycle without pointer-capture monkey patches', async () => {
  const resize = await read('./before-after/resize.js');
  assert.match(resize, /window\.addEventListener\('pointermove'/);
  assert.match(resize, /window\.addEventListener\('pointerup'/);
  assert.match(resize, /state\.cropHeight = next/);
  assert.match(resize, /state\.selectedRatio = 'custom'/);
  assert.doesNotMatch(resize, /setPointerCapture|releasePointerCapture/);
});

test('Before/After page loads only owned module entry and no iOS monkey-patch runtime', async () => {
  const html = await read('./before-after.html');
  assert.match(html, /<script type="module" src="\/before-after\.js"><\/script>/);
  assert.doesNotMatch(html, /before-after-editor-scale\.js/);
  assert.doesNotMatch(html, /before-after-ios\.js/);
});
