import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index=await readFile(new URL('./index.html',import.meta.url),'utf8');
const beforeAfter=await readFile(new URL('./before-after.html',import.meta.url),'utf8');
const sdk=await readFile(new URL('./vendor/telegram-web-app.js',import.meta.url),'utf8');

test('Telegram WebApp SDK is self-hosted in Mini App entry points and loads before app runtime',()=>{
  const sdkTag='<script src="/vendor/telegram-web-app.js"></script>';
  const bootstrapTag='<script type="module" src="/bootstrap.js"></script>';
  const beforeAfterTag='<script type="module" src="/before-after.js"></script>';

  for(const html of [index,beforeAfter]){
    assert.match(html,/src="\/vendor\/telegram-web-app\.js"/);
    assert.doesNotMatch(html,/https:\/\/telegram\.org\/js\/telegram-web-app\.js/);
  }

  assert.ok(index.indexOf(sdkTag)>=0);
  assert.ok(index.indexOf(sdkTag)<index.indexOf(bootstrapTag));
  assert.match(beforeAfter,/rel="preload" href="\/vendor\/telegram-web-app\.js" as="script"/);
  assert.ok(beforeAfter.indexOf(sdkTag)>=0);
  assert.ok(beforeAfter.indexOf(sdkTag)<beforeAfter.indexOf(beforeAfterTag));
  assert.match(sdk,/window\.Telegram\.WebApp/);
});
