import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {combineImageGenerationText,imageWishesAction,normalizeImageWishes} from './composer-image-wishes.js';

const source=fs.readFileSync(new URL('./composer-image-generation.js',import.meta.url),'utf8');

test('image generation wishes keep skip/continue semantics and the required instruction label',()=>{
  assert.equal(normalizeImageWishes('   '),'');
  assert.equal(imageWishesAction('   '),'Пропустить');
  assert.equal(imageWishesAction('  Без текста на изображении  '),'Продолжить');
  assert.equal(combineImageGenerationText('Текст публикации','   '),'Текст публикации');
  assert.equal(combineImageGenerationText('Текст публикации','  Без текста на изображении  '),'Текст публикации\n\nУчитывай пожелания пользователя в первую очередь: Без текста на изображении');
});

test('generation opens a titleless wishes modal and cancel does not start generation',()=>{
  assert.match(source,/placeholder="Напишите сюда ваши пожелания"/);
  assert.match(source,/class="composer-image-wishes-action">Пропустить</);
  assert.match(source,/class="composer-image-wishes-cancel">Отмена</);
  assert.doesNotMatch(source,/composer-image-wishes-title/);
  assert.match(source,/action\.textContent=imageWishesAction\(textarea\.value\)/);
  assert.match(source,/cancel\.addEventListener\('click',\(\)=>closeWishesModal\(\)\)/);
  assert.match(source,/requestImage\('\/api\/miniapp\/ai\/image',\{text:generationText\},operation\)/);
  assert.match(source,/if\(options\.internetSearch!==true&&!generationRequest\.resolved\)\{\s*const choice=await requestGenerationWishes\(\);\s*if\(!choice\.proceed\)return;/);
});

test('search fallback asks for wishes before generated fallback and retries reuse the resolved choice',()=>{
  assert.match(source,/if\(!generationRequest\.resolved\)\{\s*const choice=await requestGenerationWishes\(\);/);
  assert.match(source,/generateImage\(postText,generationRequest\.wishes,operation\)/);
  assert.match(source,/runImageAcquisition\(postText,options,webApp,generationRequest\)/);
});
