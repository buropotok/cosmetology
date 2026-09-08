import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const status=await readFile(new URL('./ai-generation-status.js',import.meta.url),'utf8');
const runtime=await readFile(new URL('./new-post-runtime.js',import.meta.url),'utf8');

test('news uses a dedicated pending message while other generation keeps generic copy',()=>{
  assert.match(status,/activePreset\(\)==='Новости'\?NEWS_PENDING:'Идёт генерация\.\.\.'/);
  assert.match(status,/const NEWS_PENDING='Ищем актуальные новости\.\.\.'/);
  assert.match(runtime,/import\('\.\/ai-generation-status\.js'\)/);
});
