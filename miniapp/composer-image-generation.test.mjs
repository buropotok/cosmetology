import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./composer-image-generation.js',import.meta.url),'utf8');

test('image generation reads the current rich editor text with textarea fallback',()=>{
  assert.match(source,/window\.CosmoRichEditor\?\.getPlainText\?\.\(\)\?\?text\.value/);
  assert.match(source,/const postText=currentPostText\(\)/);
  assert.doesNotMatch(source,/const postText=text\.value\.trim\(\)/);
});

test('empty image-generation input focuses the active rich editor when available',()=>{
  assert.match(source,/\(window\.CosmoRichEditor\?\.element\|\|text\)\.focus\?\.\(\)/);
});
