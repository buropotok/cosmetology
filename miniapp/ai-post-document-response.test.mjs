import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const ui=await readFile(new URL('./ai-response-ui.js',import.meta.url),'utf8');
const worker=await readFile(new URL('../worker/src/services/miniapp-ai.ts',import.meta.url),'utf8');

test('AI response UI parses and renders PostDocument v2 blocks and marks',()=>{
  assert.match(ui,/JSON\.parse\(raw\)/);
  assert.match(ui,/doc\?\.schemaVersion !== 2 \|\| !Array\.isArray\(doc\.blocks\)/);
  for(const type of ['heading','quote','details','bullet_list','ordered_list','bold','italic','underline','strikethrough','spoiler','link']) assert.match(ui,new RegExp(`['"]${type}['"]`));
  assert.match(ui,/for \(const child of Array\.isArray\(block\.blocks\)/);
  assert.match(ui,/publish-ai-wizard__post-button/);
});

test('final PostDocument prompt limits publication to 200 words',()=>{
  assert.match(worker,/не более 200 слов/);
  assert.match(worker,/до 200 слов максимум/);
});
