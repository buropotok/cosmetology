import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./composer-editor-keyboard-layout.js',import.meta.url),'utf8');

test('fullscreen editor hint is large, wide, and horizontally padded',()=>{
  assert.ok(source.includes('font-size:26px'));
  assert.ok(source.includes('left:24px;right:24px'));
  assert.ok(source.includes('padding:14px 24px'));
  assert.ok(source.includes('left:18px;right:18px;padding-left:20px;padding-right:20px'));
});
