import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const app=await readFile(new URL('./app.js',import.meta.url),'utf8');
const mockup=await readFile(new URL('./composer-mockup.js',import.meta.url),'utf8');
const screen=await readFile(new URL('./composer-screen.js',import.meta.url),'utf8');
const css=await readFile(new URL('./composer-mockup.css',import.meta.url),'utf8');

test('Composer publication actions use component-owned white pillow styling',()=>{
  assert.match(css,/#composer-screen\.approved-composer \.composer-bottom \.composer-telegram-preview,#composer-screen\.approved-composer \.composer-bottom #publish,#composer-screen\.approved-composer \.composer-bottom #publish-vk\{/);
  assert.match(css,/border:1px solid rgba\(255,255,255,\.92\);border-radius:22px;background:linear-gradient\(145deg,#fff 0%,#fff 68%,#fafbfd 100%\);color:#536170/);
  assert.match(css,/box-shadow:-5px -5px 9px rgba\(255,255,255,\.98\),7px 8px 11px rgba\(112,130,149,\.32\),0 3px 5px rgba\(105,123,142,\.18\)/);
  assert.match(css,/#publish:focus-visible/);
  assert.match(css,/#publish-vk:focus-visible/);
  assert.match(css,/\.composer-telegram-preview:focus-visible/);
  assert.match(css,/@keyframes composer-pillow-press-hold\{/);
  assert.match(css,/animation:composer-pillow-press-hold 140ms linear both/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(screen,/composer-pillow-press-hold/);
  assert.doesNotMatch(screen,/composer-pillow-activating/);
});

test('all three Composer publication actions finish pillow feedback before acting',()=>{
  assert.match(app,/function waitForComposerPillowPress\(button\)/);
  assert.match(app,/fallbackTimer=setTimeout\(\(\)=>finish\(\),180\)/);
  const vkHandler=app.slice(app.indexOf("publishVk.addEventListener('click'"),app.indexOf('let previewUrls='));
  assert.ok(vkHandler.indexOf('await waitForComposerPillowPress(publishVk)')>=0);
  assert.ok(vkHandler.indexOf('await waitForComposerPillowPress(publishVk)')<vkHandler.indexOf('CosmoComposerVkDestination'));
  const submitHandler=app.slice(app.indexOf("form.addEventListener('submit'"),app.indexOf("window.addEventListener('cosmo-composer-restore'"));
  assert.ok(submitHandler.indexOf('await waitForComposerPillowPress(publish)')>=0);
  assert.ok(submitHandler.indexOf('await waitForComposerPillowPress(publish)')<submitHandler.indexOf('CosmoComposerActions.publishTelegram'));
  assert.match(mockup,/function waitForComposerPillowPress\(button\)/);
  assert.match(mockup,/fallbackTimer=setTimeout\(\(\)=>finish\(\),180\)/);
  const previewHandler=mockup.slice(mockup.indexOf("telegramPreview.addEventListener('click'"),mockup.indexOf("toolbar.querySelectorAll('.composer-menu-trigger')"));
  assert.ok(previewHandler.indexOf('await waitForComposerPillowPress(telegramPreview)')>=0);
  assert.ok(previewHandler.indexOf('await waitForComposerPillowPress(telegramPreview)')<previewHandler.indexOf("flush?.('preview')"));
});
