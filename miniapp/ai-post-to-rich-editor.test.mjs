import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const transfer=await readFile(new URL('./ai-post-editor-transfer.js',import.meta.url),'utf8');
const responseUi=await readFile(new URL('./ai-response-ui.js',import.meta.url),'utf8');
const tiptap=await readFile(new URL('./composer-tiptap.js',import.meta.url),'utf8');
const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');

test('ready PostDocument v2 exposes primary edit and publish action',()=>{
  assert.match(transfer,/Редактировать и опубликовать/);
  assert.match(transfer,/schemaVersion===2/);
  assert.match(transfer,/COSMO_DRAFT_V3/);
  assert.match(transfer,/version:3,document:doc/);
  assert.match(transfer,/await waitForEditor\(\)/);
  assert.match(transfer,/editor\.restoreDraft\(value\)/);
  assert.match(transfer,/dataset\.publishMode='compose'/);
});

test('Tiptap preserves recursive quote, details and nested-list structure in PostDocument',()=>{
  assert.match(tiptap,/function nodeToPostBlock\(node\)/);
  assert.match(tiptap,/node\.type==='blockquote'.*map\(nodeToPostBlock\)/s);
  assert.match(tiptap,/node\.type==='details'.*map\(nodeToPostBlock\)/s);
  assert.match(tiptap,/item\.children=\{type:listType\(nested\),items:/);
  assert.match(tiptap,/Array\.isArray\(block\.blocks\)\?block\.blocks\.map\(blockNode\)/);
  assert.match(tiptap,/nested\.type==='ordered_list'\?'orderedList':'bulletList'/);
  assert.match(tiptap,/schemaVersion:2,blocks/);
});

test('AI response keeps canonical PostDocument for direct Tiptap transfer',()=>{
  assert.match(responseUi,/window\.CosmoAiPostDocument = doc \|\| null/);
  assert.match(responseUi,/cosmo-ai-post-document/);
  assert.match(responseUi,/Array\.isArray\(block\.blocks\)/);
  assert.match(tiptap,/COSMO_DRAFT_V3/);
  assert.match(tiptap,/function postToTiptap\(doc\)/);
  assert.match(tiptap,/function restoreDraft\(value\)/);
  assert.match(tiptap,/editor\.commands\.setContent\(postToTiptap\(doc\)/);
  assert.match(bootstrap,/ai-post-editor-transfer\.js/);
});
