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

test('AI generation modal uses news-specific copy and animated dots',()=>{
  assert.match(ux,/active==='Новости'\?'Ищем актуальные новости':'Идёт генерация'/);
  assert.match(ux,/cosmo-ai-generation-dot/);
  assert.match(ux,/@keyframes cosmo-ai-dot/);
  assert.match(ux,/modal\.querySelector\('\[data-generation-copy\]'\)\.textContent=activeGenerationCopy\(\)/);
});

test('modal cancel routes through the wizard cancellation state before transport fallback',()=>{
  assert.match(ux,/function cancelWizardGeneration\(\)/);
  assert.match(ux,/#publish-ai-wizard\.is-pending \.publish-ai-wizard__prompt button/);
  assert.match(ux,/button\.click\(\)/);
  assert.match(ux,/if\(cancelWizardGeneration\(\)\)\{hideGenerationModal\(\);return\}/);
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
