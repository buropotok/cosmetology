import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');
const splashCss=await readFile(new URL('./startup-splash.css',import.meta.url),'utf8');

test('startup bootstrap routes every dynamic module load through the visible trace',()=>{
  assert.match(bootstrap,/async function loadStartupModule\(modulePath\)/);
  assert.equal((bootstrap.match(/\bimport\(/g)||[]).length,1);
  assert.match(bootstrap,/appendStartupLog\('START',modulePath\)/);
  assert.match(bootstrap,/appendStartupLog\('OK',modulePath,/);
  assert.match(bootstrap,/appendStartupLog\('ERROR',modulePath,/);
  assert.match(bootstrap,/throw error;/);
});

test('startup splash becomes visible before platform imports and stays until bootstrap completes',()=>{
  const start=bootstrap.slice(bootstrap.indexOf('async function start()'));
  assert.ok(start.indexOf('showStartupSplash()')<start.indexOf('await loadPlatform()'));
  assert.ok(start.indexOf('hideStartupSplash()')>start.indexOf('await loadRuntimeIntegrations()'));
  const show=bootstrap.slice(bootstrap.indexOf('function showStartupSplash()'),bootstrap.indexOf('function hideStartupSplash()'));
  assert.match(show,/webApp\.ready\(\)/);
  assert.match(show,/aria-live=\"polite\"/);
});

test('startup trace uses isolated compatible styles and contains no auth payload logging',()=>{
  assert.match(bootstrap,/href='\/startup-splash\.css'/);
  assert.match(bootstrap,/splash\.scrollTop=splash\.scrollHeight/);
  assert.match(splashCss,/\.cosmo-startup-splash\{position:fixed;top:0;right:0;bottom:0;left:0;/);
  assert.doesNotMatch(splashCss,/\binset:/);
  assert.match(splashCss,/\.cosmo-startup-splash\[hidden\]\{display:none!important\}/);
  assert.doesNotMatch(bootstrap,/initData|Authorization/);
});
