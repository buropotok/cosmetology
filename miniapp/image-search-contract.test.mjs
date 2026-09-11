import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const wizard=fs.readFileSync(new URL('./publish-ai-wizard.js',import.meta.url),'utf8');
const responseUi=fs.readFileSync(new URL('./ai-response-ui.js',import.meta.url),'utf8');
const transfer=fs.readFileSync(new URL('./ai-post-editor-transfer.js',import.meta.url),'utf8');
const composerState=fs.readFileSync(new URL('./composer-state.js',import.meta.url),'utf8');
const draftStore=fs.readFileSync(new URL('./draft-store.js',import.meta.url),'utf8');
const imageGeneration=fs.readFileSync(new URL('./composer-image-generation.js',import.meta.url),'utf8');
const bootstrap=fs.readFileSync(new URL('./bootstrap.js',import.meta.url),'utf8');

test('product review binds official-image options to the generated response before transfer',()=>{
  assert.match(wizard,/PRODUCT_REVIEW_IMAGE_OPTIONS=Object\.freeze\(\{internetSearch:true,searchProfile:'cosmetic_product',sourcePolicy:'official'\}\)/);
  assert.match(wizard,/requestAi\(productReviewPrompt\(name\),'text',PRODUCT_REVIEW_IMAGE_OPTIONS\)/);
  assert.match(wizard,/currentImageOptions=normalizeImageOptions\(snapshot\.imageOptions\)/);
  assert.match(wizard,/imageOptions:\{\.\.\.currentImageOptions\}/);
  assert.match(responseUi,/getSnapshot\?\.\(\)\.imageOptions/);
  assert.doesNotMatch(responseUi,/Разбор препарата/);
  assert.match(responseUi,/detail:\s*\{[\s\S]*document:[\s\S]*imageOptions:/);
  assert.match(transfer,/event\.detail\?\.imageOptions/);
  assert.match(transfer,/CosmoComposerState\?\.setImageOptions\?\./);
});

test('ComposerState owns and DraftStore persists image acquisition options',()=>{
  assert.match(composerState,/imageOptions=DEFAULT_IMAGE_OPTIONS/);
  assert.match(composerState,/setImageOptions\(value\)/);
  assert.match(composerState,/getSnapshot\(\).*imageOptions/s);
  assert.match(draftStore,/body\.set\('imageOptions',JSON\.stringify\(snapshot\.imageOptions/);
  assert.match(draftStore,/imageOptions:draft\.imageOptions/);
});

test('image component switches between official search and existing generation without rubric knowledge',()=>{
  assert.match(imageGeneration,/🔎 Найти официальное фото/);
  assert.match(imageGeneration,/\/api\/miniapp\/ai\/image\/search/);
  assert.match(imageGeneration,/\/api\/miniapp\/ai\/image'/);
  assert.match(imageGeneration,/AI_IMAGE_SEARCH_NOT_FOUND/);
  assert.match(imageGeneration,/Сгенерировать изображение/);
  assert.match(imageGeneration,/cosmo-composer-restore/);
  assert.doesNotMatch(imageGeneration,/Разбор препарата/);
});

test('Composer state loads before image generation because it is now an explicit dependency',()=>{
  assert.ok(bootstrap.indexOf("import('/composer-state.js')")<bootstrap.indexOf("import('/composer-image-generation.js')"));
});
