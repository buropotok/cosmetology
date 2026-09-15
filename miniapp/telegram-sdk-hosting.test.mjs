import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const index=await readFile(new URL('./index.html',import.meta.url),'utf8');
const sdk=await readFile(new URL('./vendor/telegram-web-app.js',import.meta.url),'utf8');

test('Telegram WebApp SDK is self-hosted and loads before bootstrap',()=>{
  const sdkTag='<script src="/vendor/telegram-web-app.js"></script>';
  const bootstrapTag='<script type="module" src="/bootstrap.js"></script>';
  assert.match(index,/src="\/vendor\/telegram-web-app\.js"/);
  assert.doesNotMatch(index,/https:\/\/telegram\.org\/js\/telegram-web-app\.js/);
  assert.ok(index.indexOf(sdkTag)>=0);
  assert.ok(index.indexOf(sdkTag)<index.indexOf(bootstrapTag));
  assert.match(sdk,/window\.Telegram\.WebApp/);
});
