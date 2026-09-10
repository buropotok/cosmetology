import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('./publish-ai-wizard.js',import.meta.url),'utf8');
const css=await readFile(new URL('./publish-ai-wizard.css',import.meta.url),'utf8');

test('Discovery puts an explicit select button under every idea',()=>{
  assert.match(source,/select\.textContent=`Выбрать вариант \$\{index\+1\}`/);
  assert.match(source,/select\.addEventListener\('click',\(\)=>confirmIdea\(idea,index\+1\)\)/);
  assert.match(source,/if\(idea\.source\)[\s\S]*?item\.append\(link\)\}const select=document\.createElement\('button'\)/);
});

test('Discovery no longer duplicates selection in the numbered control panel',()=>{
  assert.doesNotMatch(source,/controlLabel\.textContent='Выберите вариант'/);
  assert.doesNotMatch(source,/if\(state==='discovery'\)/);
});

test('Idea separators remain and inline select button reuses the existing action style',()=>{
  assert.match(css,/\.publish-ai-wizard__idea\{[^}]*border-bottom:1px solid #e5e5ea/);
  assert.match(css,/\.publish-ai-wizard__idea-select\{margin-top:10px\}/);
  assert.match(css,/\.publish-ai-wizard__controls button,\.publish-ai-wizard__idea-select\{/);
});
