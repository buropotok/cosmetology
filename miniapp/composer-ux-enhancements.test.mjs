import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const ux=await readFile(new URL('./composer-ux-enhancements.js',import.meta.url),'utf8');
const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');

test('rich editor exposes the requested uppercase empty-state placeholder',()=>{
  assert.match(ux,/ВВЕДИТЕ ТЕКСТ ПУБЛИКАЦИИ СЮДА\.\.\./);
  assert.match(ux,/is-cosmo-empty/);
  assert.match(ux,/!editor\.textContent\?\.trim\(\)/);
});

test('AI generation modal has animated dots and cancel aborts the active request',()=>{
  assert.match(ux,/Идёт генерация/);
  assert.match(ux,/cosmo-ai-generation-dot/);
  assert.match(ux,/@keyframes cosmo-ai-dot/);
  assert.match(ux,/generationController\?\.abort\(\)/);
  assert.match(ux,/new AbortController\(\)/);
  assert.match(ux,/signal:controller\.signal/);
});

test('AI generation failures switch the same modal to error state',()=>{
  assert.match(ux,/Произошла ошибка генерации 🙁/);
  assert.match(ux,/modal\.dataset\.state='error'/);
  assert.match(ux,/showGenerationError\(\)/);
  assert.match(ux,/textContent='Закрыть'/);
});

test('UX interception loads before the AI wizard starts requests',()=>{
  const uxIndex=bootstrap.indexOf("import('/composer-ux-enhancements.js')");
  const wizardIndex=bootstrap.indexOf("import('/publish-ai-wizard.js')");
  assert.ok(uxIndex>=0);
  assert.ok(wizardIndex>uxIndex);
});
