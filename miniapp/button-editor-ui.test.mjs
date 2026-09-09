import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./composer-tiptap.js',import.meta.url),'utf8');
const adapterSource=fs.readFileSync(new URL('./post-document-tiptap-adapter.js',import.meta.url),'utf8');
const adapterUrl=`data:text/javascript;base64,${Buffer.from(adapterSource).toString('base64')}`;
const {tiptapToPostDocument}=await import(adapterUrl);

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

  const tiptapDocument={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Текст'}]}]};
  const buttons=[{text:'Подробнее',url:'https://example.com/'}];
  assert.deepEqual(tiptapToPostDocument(tiptapDocument,buttons).buttons,buttons);
  assert.equal('buttons' in tiptapToPostDocument(tiptapDocument,[]),false);

  assert.doesNotMatch(source,/prompt\('Текст кнопки'/);
  assert.doesNotMatch(source,/prompt\('Ссылка кнопки'/);
});