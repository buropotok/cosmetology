import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const css=await readFile(new URL('./navigation-controls.css',import.meta.url),'utf8');
const indexHtml=await readFile(new URL('./index.html',import.meta.url),'utf8');
const beforeAfterHtml=await readFile(new URL('./before-after.html',import.meta.url),'utf8');
const navigation=await readFile(new URL('./navigation.js',import.meta.url),'utf8');
const onboarding=await readFile(new URL('./onboarding-view.js',import.meta.url),'utf8');

test('all in-app Back controls load the shared round pillow presentation',()=>{
  assert.match(indexHtml,/<link rel="stylesheet" href="\/navigation-controls\.css">/);
  assert.match(beforeAfterHtml,/<link rel="stylesheet" href="\/navigation-controls\.css">/);
  assert.match(css,/\.back-button,[\s\S]*\.cosmo-composer-back,[\s\S]*#back\s*\{/);
  assert.match(css,/width:44px !important/);
  assert.match(css,/height:44px !important/);
  assert.match(css,/border-radius:50% !important/);
  assert.match(css,/background:linear-gradient\(145deg,#fff 0%,#fff 68%,#fafbfd 100%\) !important/);
  assert.match(css,/box-shadow:-5px -5px 9px rgba\(255,255,255,\.98\),7px 8px 11px rgba\(112,130,149,\.32\),0 3px 5px rgba\(105,123,142,\.18\) !important/);
  assert.match(css,/content:"←"/);
  assert.match(css,/font:400 30px\/1/);
  assert.match(css,/:focus-visible[\s\S]*outline:2px solid rgba\(83,97,112,\.72\) !important/);
  assert.match(css,/:active[\s\S]*box-shadow:inset 4px 4px 7px/);
});

test('Back behavior and accessible labels remain owned by the existing navigation flows',()=>{
  assert.match(indexHtml,/id="close-settings" class="back-button" type="button" aria-label="Назад"/);
  assert.match(onboarding,/class="back-button" data-onboarding-back type="button" aria-label="Назад"/);
  assert.match(navigation,/backButton\.setAttribute\('aria-label','Назад'\)/);
  assert.match(navigation,/backButton\.addEventListener\('click',\(\)=>\{void navigation\.back\(\)\}\)/);
  assert.match(beforeAfterHtml,/<button id="back" class="ghost">‹ Назад<\/button>/);
});
