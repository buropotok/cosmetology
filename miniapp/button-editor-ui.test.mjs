import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./composer-tiptap.js',import.meta.url),'utf8');

test('link button uses persistent editor footer and two-step modal without changing PostDocument buttons contract',()=>{
  assert.match(source,/const buttonDock=document\.createElement\('div'\);buttonDock\.className='composer-button-dock'/);
  assert.match(source,/host\.append\(buttonDock\)/);
  assert.match(source,/title\.textContent=step==='text'\?'Введите название:':'Введите ссылку:'/);
  assert.match(source,/draft=\{text:existing\?\.text\|\|'Ссылка',url:existing\?\.url\|\|'https:\/\/'\}/);
  assert.match(source,/next\.textContent=step==='text'\?'Продолжить':'Готово'/);
  assert.match(source,/openButtonEditor\(index\)/);
  assert.match(source,/buttons\.push\(\{text:draft\.text,url:draft\.url\}\)/);
  assert.match(source,/buttons\[index\]=\{text:draft\.text,url:draft\.url\}/);
  assert.match(source,/buttons\.splice\(index,1\)/);
  assert.match(source,/return\{schemaVersion:2,blocks,\.\.\.\(buttons\.length\?\{buttons:\[\.\.\.buttons\]\}:\{\}\)\}/);
  assert.doesNotMatch(source,/prompt\('Текст кнопки'/);
  assert.doesNotMatch(source,/prompt\('Ссылка кнопки'/);
});
