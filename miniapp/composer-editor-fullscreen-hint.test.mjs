import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./composer-editor-keyboard-layout.js',import.meta.url),'utf8');

test('fullscreen editor includes its short safe-area exit hint',()=>{
  assert.ok(source.includes('composer-editor-fullscreen-hint'));
  assert.ok(source.includes('Смахните вверх, чтобы выйти из режима редактирования текста'));
  assert.ok(source.includes('safe-area-inset-top'));
  assert.ok(source.includes('2800'));
  assert.ok(source.includes('if(!mobile||active)return'));
  assert.ok(source.includes('hideHint()'));
});
