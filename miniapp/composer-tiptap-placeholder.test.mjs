import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8');

test('empty Tiptap editor shows a non-content publication placeholder',()=>{
  const source=read('./composer-tiptap-placeholder.js');
  const runtime=read('./composer-editor-runtime.js');

  assert.match(source,/const text='Введите текст публикации'/);
  assert.match(source,/root\.setAttribute\('aria-placeholder',text\)/);
  assert.match(source,/pointer-events:none/);
  assert.match(source,/const render=\(\)=>\{placeholder\.hidden=!editor\.isEmpty\}/);
  assert.match(source,/editor\.on\('update',render\)/);
  assert.match(source,/editor\.on\('destroy',destroy\)/);
  assert.doesNotMatch(source,/textContent\s*=\s*editor\.|commands\.insertContent|commands\.setContent/);
  assert.match(runtime,/module:'composer-tiptap-placeholder'/);
  assert.match(runtime,/modules:\{tiptap,placeholder,fixes\}/);
});
