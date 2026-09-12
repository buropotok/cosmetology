import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const client=await readFile(new URL('./d1-diagnostic.js',import.meta.url),'utf8');
const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');
const entry=await readFile(new URL('../worker/src/watermark-entry.ts',import.meta.url),'utf8');
const diagnostic=await readFile(new URL('../worker/src/services/d1-diagnostic.ts',import.meta.url),'utf8');

test('Home D1 diagnostic is mounted after navigation without blocking the shell',()=>{
  assert.ok(bootstrap.indexOf("import('/navigation.js')")<bootstrap.indexOf("import('/d1-diagnostic.js')"));
  assert.match(bootstrap,/void import\('\/d1-diagnostic\.js'\)\.catch/);
  assert.doesNotMatch(bootstrap,/await import\('\/d1-diagnostic\.js'\)/);
  assert.match(client,/querySelector\('#home-screen'\)/);
  assert.match(client,/textContent='Test D1'/);
  assert.match(client,/fetch\('\/api\/miniapp\/diagnostics\/d1'/);
  assert.match(client,/Authorization:`tma \$\{tg\.initData\}`/);
  assert.match(client,/button\.disabled=true/);
  assert.match(client,/finally\{inFlight=false;button\.disabled=false\}/);
});

test('D1 diagnostic route uses isolated healthcheck storage',()=>{
  assert.match(entry,/\/api\/miniapp\/diagnostics\/d1/);
  assert.match(entry,/runD1Diagnostic\(req,env\)/);
  assert.match(diagnostic,/validateTelegramMiniAppInitData/);
  assert.match(diagnostic,/SELECT 1 AS test/);
  assert.match(diagnostic,/CREATE TABLE IF NOT EXISTS __d1_healthcheck/);
  assert.match(diagnostic,/INSERT INTO __d1_healthcheck/);
  assert.match(diagnostic,/SELECT created_at FROM __d1_healthcheck WHERE id=1/);
  assert.match(diagnostic,/DELETE FROM __d1_healthcheck WHERE id=1/);
  assert.doesNotMatch(diagnostic,/miniapp_drafts|\bposts\b|publication/);
});

test('D1 diagnostic exposes only stage and error message on failure',()=>{
  assert.match(diagnostic,/return \{ ok: false, stage, error: errorMessage\(error\) \}/);
  assert.doesNotMatch(diagnostic,/\.stack|authorization.*return|initData.*return/);
});
