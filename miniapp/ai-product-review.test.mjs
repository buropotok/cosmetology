import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('./publish-ai-wizard.js',import.meta.url),'utf8');
const css=await readFile(new URL('./publish-ai-wizard.css',import.meta.url),'utf8');

test('product review preset opens a drug-name modal instead of Discovery',()=>{
  assert.match(source,/data-ai-product-modal/);
  assert.match(source,/Введите наименование препарата/);
  assert.match(source,/data-ai-product-input/);
  assert.match(source,/>Продолжить<\/button>/);
  assert.match(source,/if\(preset==='Разбор препарата'\)\{openProductModal\(\);return\}/);
});

test('product review requires a non-empty name and sends a direct text generation request',()=>{
  assert.match(source,/const name=productInput\?\.value\.trim\(\)\|\|'';if\(!name\)\{productInput\?\.focus\(\);return\}/);
  assert.match(source,/void requestAi\(productReviewPrompt\(name\),'text'\)/);
  assert.doesNotMatch(source,/['"]Разбор препарата['"]:\s*`[^`]*\$\{discoveryInstruction\}/);
});

test('product review prompt uses the agreed evidence-focused structure and existing ready-post contract',()=>{
  assert.match(source,/Подготовь доказательный разбор препарата/);
  assert.match(source,/убедись, что идентифицировал именно его/);
  assert.match(source,/активные компоненты и их роль/);
  assert.match(source,/качество и уровень имеющихся доказательств/);
  assert.match(source,/данные производителя/);
  assert.match(source,/результаты исследований/);
  assert.match(source,/Не придумывай состав, свойства, исследования, регистрацию, показания или противопоказания/);
  assert.match(source,/В самом конце публикации перечисли использованные источники обычными кликабельными ссылками/);
  assert.match(source,/\$\{READY_POST_FORMAT_CONTRACT\}/);
});

test('product-name modal is owned and styled by the AI Widget',()=>{
  assert.match(css,/\.publish-ai-wizard__product-modal\{[^}]*position:fixed;inset:0;[^}]*z-index:1000/);
  assert.match(css,/\.publish-ai-wizard__product-form input\{[^}]*min-height:48px/);
  assert.match(css,/\.publish-ai-wizard__product-continue\{background:#2d8fd3;color:#fff\}/);
});
