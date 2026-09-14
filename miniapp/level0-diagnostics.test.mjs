import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('./index.html',import.meta.url),'utf8');
const probeMatch=html.match(/<script id="cosmo-level0-probe">([\s\S]*?)<\/script>/);
assert.ok(probeMatch,'Level 0 probe must be inline in index.html');
const probe=probeMatch[1];

test('Level 0 diagnostics executes before Telegram SDK and module bootstrap',()=>{
  const probeIndex=html.indexOf('id="cosmo-level0-probe"');
  const telegramIndex=html.indexOf('https://telegram.org/js/telegram-web-app.js');
  const bootstrapIndex=html.indexOf('type="module" src="/bootstrap.js"');
  assert.ok(probeIndex>=0&&probeIndex<telegramIndex);
  assert.ok(telegramIndex<bootstrapIndex);
  assert.match(html,/mark\('telegram-sdk','loading'\)/);
  assert.match(html,/mark\('telegram-sdk','loaded'\)/);
  assert.match(html,/mark\('telegram-sdk','failed'/);
  assert.match(html,/mark\('bootstrap','loading'\)/);
  assert.match(html,/mark\('bootstrap','loaded'\)/);
  assert.match(html,/mark\('bootstrap','failed'/);
});

test('Level 0 diagnostics can persist before telegram-web-app.js initializes',()=>{
  assert.match(probe,/readParam\('tgWebAppData'\)/);
  assert.match(probe,/XMLHttpRequest/);
  assert.match(probe,/xhr\.open\('POST',ENDPOINT,true\)/);
  assert.match(probe,/var auth=initData/);
  assert.match(probe,/window\.Telegram&&window\.Telegram\.WebApp/);
  assert.match(probe,/xhr\.setRequestHeader\('authorization','tma '\+auth\)/);
  assert.match(probe,/ENDPOINT='\/api\/miniapp\/runtime-diagnostics'/);
  const snapshot=probe.slice(probe.indexOf('function snapshot()'),probe.indexOf('function send()'));
  assert.doesNotMatch(snapshot,/initData|tgWebAppData/);
});

test('Level 0 probe captures failures before bootstrap diagnostics exist',()=>{
  assert.match(probe,/addEventListener\('error'/);
  assert.match(probe,/addEventListener\('unhandledrejection'/);
  assert.match(probe,/mark\('window-error','failed'/);
  assert.match(probe,/mark\('unhandled-rejection','failed'/);
  assert.match(probe,/tgWebAppData=\[redacted\]/);
});

test('Level 0 probe stays legacy-syntax-only',()=>{
  assert.doesNotMatch(probe,/=>|\bconst\b|\blet\b|\bclass\b|\basync\b|\bawait\b|\?\.|\?\?|`/);
  assert.doesNotMatch(probe,/\bfetch\s*\(/);
});
