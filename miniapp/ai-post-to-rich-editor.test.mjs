import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const transfer=await readFile(new URL('./ai-post-editor-transfer.js',import.meta.url),'utf8');
const responseUi=await readFile(new URL('./ai-response-ui.js',import.meta.url),'utf8');
const stability=await readFile(new URL('./composer-editor-stability.js',import.meta.url),'utf8');
const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');

test('ready PostDocument exposes primary edit and publish action',()=>{
  assert.match(transfer,/Редактировать и опубликовать/);
  assert.match(transfer,/function loadPostDocument\(doc\)/);
  assert.match(transfer,/editor\.restoreDraft\(value\)/);
  assert.match(transfer,/dataset\.publishMode='compose'/);
});

test('AI response keeps canonical PostDocument for direct editor transfer',()=>{
  assert.match(responseUi,/window\.CosmoAiPostDocument = doc \|\| null/);
  assert.match(responseUi,/cosmo-ai-post-document/);
  assert.match(stability,/api\.restoreDraft=value/);
  assert.match(stability,/renderDocument\(doc\)/);
  assert.match(bootstrap,/ai-post-editor-transfer\.js/);
});

