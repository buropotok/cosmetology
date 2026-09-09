import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('./publish-ai-wizard.js',import.meta.url),'utf8');

test('AI client prompts delegate source links to the verified server pipeline',()=>{
  assert.match(source,/проверенные источники и кликабельные ссылки сервер добавит сам в конец готового поста/);
  assert.match(source,/Не создавай отдельный раздел «Источники»/);
  assert.match(source,/Указывай только точный реальный URL найденной страницы; не придумывай и не конструируй ссылки/);
  assert.doesNotMatch(source,/Обычные источники оформляй обычными ссылками/);
});
