import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');
const splashCss=await readFile(new URL('./startup-splash.css',import.meta.url),'utf8');
const sofaSvg=await readFile(new URL('./icons/sofa-animated.svg',import.meta.url),'utf8');

test('startup bootstrap traces module lifecycle without hiding explicit import contracts',()=>{
  assert.match(bootstrap,/async function loadStartupModule\(moduleName,loader\)/);
  assert.match(bootstrap,/const module=await loader\(\)/);
  assert.doesNotMatch(bootstrap,/import\(modulePath\)/);
  assert.match(bootstrap,/appendStartupLog\('START',moduleName\)/);
  assert.match(bootstrap,/appendStartupLog\('OK',moduleName,/);
  assert.match(bootstrap,/appendStartupLog\('ERROR',moduleName,/);
  assert.match(bootstrap,/import\('\/telegram-gateway\.js'\)/);
  assert.match(bootstrap,/void import\('\/runtime-diagnostics\.js'\)/);
  assert.match(bootstrap,/void import\('\/composer-media-gallery-bridge\.js'\)/);
  assert.match(bootstrap,/throw error;/);
});

test('startup module trace is mirrored to persistent diagnostics without blocking imports',()=>{
  const recorder=bootstrap.slice(bootstrap.indexOf('function recordStartupRuntimeDiagnostic'),bootstrap.indexOf('async function loadStartupModule'));
  const loader=bootstrap.slice(bootstrap.indexOf('async function loadStartupModule'),bootstrap.indexOf('function loadWorkspaceStyles'));
  assert.match(recorder,/void import\('\/runtime-diagnostics\.js'\)/);
  assert.match(recorder,/recordRuntimeDiagnostic\?\.\(\{/);
  assert.match(recorder,/stage:'application\.startup'/);
  assert.match(loader,/recordStartupRuntimeDiagnostic\(\{module:moduleName,status:'loading'\}\)/);
  assert.match(loader,/recordStartupRuntimeDiagnostic\(\{module:moduleName,status:'loaded',durationMs\}\)/);
  assert.match(loader,/recordStartupRuntimeDiagnostic\(\{module:moduleName,status:'failed',durationMs,error\}\)/);
  assert.doesNotMatch(loader,/await recordStartupRuntimeDiagnostic/);
});

test('startup splash becomes visible before platform imports and stays until bootstrap completes',()=>{
  const start=bootstrap.slice(bootstrap.indexOf('async function start()'));
  assert.ok(start.indexOf('showStartupSplash()')<start.indexOf('await loadPlatform()'));
  assert.ok(start.indexOf('hideStartupSplash()')>start.indexOf('await loadRuntimeIntegrations()'));
  const show=bootstrap.slice(bootstrap.indexOf('function showStartupSplash()'),bootstrap.indexOf('function hideStartupSplash()'));
  assert.match(show,/webApp\.ready\(\)/);
  assert.match(show,/src=\"\/icons\/sofa-animated\.svg\"/);
  assert.match(show,/id=\"cosmo-startup-log\"[^>]*hidden/);
});

test('startup splash is a centered white logo screen while diagnostics remain hidden',()=>{
  assert.match(bootstrap,/href='\/startup-splash\.css'/);
  assert.match(bootstrap,/splash\.scrollTop=splash\.scrollHeight/);
  assert.match(splashCss,/\.cosmo-startup-splash\{position:fixed;top:0;right:0;bottom:0;left:0;/);
  assert.match(splashCss,/display:flex;align-items:center;justify-content:center/);
  assert.match(splashCss,/background:#fff/);
  assert.match(splashCss,/\.cosmo-startup-splash__logo\{display:block;width:min\(82vw,420px\);height:auto\}/);
  assert.match(splashCss,/\.cosmo-startup-splash__log\{display:none!important\}/);
  assert.doesNotMatch(splashCss,/\binset:/);
  assert.match(splashCss,/\.cosmo-startup-splash\[hidden\]\{display:none!important\}/);
  assert.match(sofaSvg,/@keyframes sofa-sit/);
  assert.match(sofaSvg,/@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(bootstrap,/initData|Authorization/);
});
