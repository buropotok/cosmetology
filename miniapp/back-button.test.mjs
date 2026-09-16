import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const css=await readFile(new URL('./back-button.css',import.meta.url),'utf8');
const feedback=await readFile(new URL('./back-button-feedback.js',import.meta.url),'utf8');
const indexHtml=await readFile(new URL('./index.html',import.meta.url),'utf8');
const beforeAfterHtml=await readFile(new URL('./before-after.html',import.meta.url),'utf8');
const navigation=await readFile(new URL('./navigation.js',import.meta.url),'utf8');
const appRouter=await readFile(new URL('./app-router.js',import.meta.url),'utf8');
const onboarding=await readFile(new URL('./onboarding-view.js',import.meta.url),'utf8');
const gallery=await readFile(new URL('./composer-media-gallery.js',import.meta.url),'utf8');
const tiptap=await readFile(new URL('./composer-tiptap.js',import.meta.url),'utf8');

test('screen Back controls use the shared round white pillow presentation',()=>{
  assert.match(indexHtml,/<link rel="stylesheet" href="\/back-button\.css">/);
  assert.match(css,/^\/\* Shared visual contract for screen-level Back controls\./);
  assert.doesNotMatch(css,/\.cosmo-composer-back|\.cosmo-gallery-back|#back/);
  assert.match(css,/\.back-button\s*\{/);
  assert.match(css,/width:44px !important/);
  assert.match(css,/height:44px !important/);
  assert.match(css,/border-radius:50% !important/);
  assert.match(css,/background:linear-gradient\(145deg,#fff 0%,#fff 68%,#fafbfd 100%\) !important/);
  assert.match(css,/color:#536170 !important/);
  assert.match(css,/box-shadow:-5px -5px 9px rgba\(255,255,255,\.98\),7px 8px 11px rgba\(112,130,149,\.32\),0 3px 5px rgba\(105,123,142,\.18\) !important/);
  assert.match(css,/content:"←"/);
  assert.match(css,/font:400 30px\/1/);
  assert.match(css,/:focus-visible[\s\S]*outline:2px solid rgba\(83,97,112,\.72\) !important/);
  assert.match(css,/\.back-button:active,\s*\.back-button\.back-button-activating\s*\{[\s\S]*box-shadow:inset 4px 4px 7px/);
});

test('Settings, onboarding and Composer opt into the shared screen Back style and delayed feedback',()=>{
  assert.match(indexHtml,/id="close-settings" class="back-button" type="button" aria-label="Назад"/);
  assert.match(onboarding,/class="back-button" data-onboarding-back type="button" aria-label="Назад"/);
  assert.match(navigation,/backButton\.className='cosmo-composer-back back-button'/);
  assert.match(navigation,/backButton\.setAttribute\('aria-label','Назад'\)/);
  assert.match(navigation,/runAfterBackButtonPress\(backButton,\(\)=>\{void navigation\.back\(\)\}\)/);
  assert.match(onboarding,/runAfterBackButtonPress\(button,\(\)=>this\.controller\.back\(\)\)/);
  assert.match(appRouter,/if\(target\.id==='close-settings'\)runAfterBackButtonPress\(target,closeSettings\)/);
});

test('shared Back feedback waits for the press transition before running navigation actions',()=>{
  assert.match(feedback,/const TRANSITION_PROPERTY='transform'/);
  assert.match(feedback,/button\.dataset\.backButtonActivation==='pending'/);
  assert.match(feedback,/button\.classList\.add\('back-button-activating'\)/);
  assert.match(feedback,/button\.addEventListener\('transitionend',finish\)/);
  assert.match(feedback,/event\.propertyName!==TRANSITION_PROPERTY/);
  assert.match(feedback,/fallbackTimer=setTimeout\(\(\)=>finish\(\),FALLBACK_MS\)/);
  assert.match(feedback,/const FALLBACK_MS=160/);
  assert.match(feedback,/window\.matchMedia\?\.\(REDUCED_MOTION_QUERY\)\?\.matches\)\{action\(\);return true\}/);
  assert.doesNotMatch(feedback,/navigation\.|CosmoRouter|controller\./);
});

test('Before After, gallery and link-editor Back controls keep their component-owned presentation',()=>{
  assert.doesNotMatch(beforeAfterHtml,/back-button\.css|class="[^"]*\bback-button\b/);
  assert.match(beforeAfterHtml,/<button id="back" class="ghost">‹ Назад<\/button>/);
  assert.doesNotMatch(gallery,/cosmo-gallery-back back-button/);
  assert.match(gallery,/class="cosmo-gallery-back" hidden aria-label="Назад">‹/);
  assert.doesNotMatch(tiptap,/composer-button-modal-back back-button/);
  assert.match(tiptap,/secondary\.className=step==='text'\?'composer-button-modal-cancel':'composer-button-modal-back'/);
});
