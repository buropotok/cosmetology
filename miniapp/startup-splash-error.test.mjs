import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');
const errorSvg=await readFile(new URL('./icons/sofa-sparkle-error-v4.svg',import.meta.url),'utf8');

test('startup failure swaps to the error sofa and shows a user-facing message',()=>{
  assert.match(bootstrap,/const STARTUP_ERROR_ID='cosmo-startup-error'/);
  assert.match(bootstrap,/Не удалось загрузить приложение/);
  const failure=bootstrap.slice(bootstrap.indexOf('function showStartupFailure()'),bootstrap.indexOf('function hideStartupSplash()'));
  assert.match(failure,/logo\.src='\/icons\/sofa-sparkle-error-v4\.svg'/);
  assert.match(failure,/message\.hidden=false/);
  assert.match(failure,/splash\.setAttribute\('aria-label','Не удалось загрузить приложение'\)/);
  const start=bootstrap.slice(bootstrap.indexOf('async function start()'));
  assert.match(start,/catch\(error\)\{[\s\S]*appendStartupLog\('ERROR','\/bootstrap\.js',startupErrorMessage\(error\)\);[\s\S]*showStartupFailure\(\);[\s\S]*throw error;/);
  assert.match(errorSvg,/<animate attributeName="d"/);
  assert.match(errorSvg,/repeatCount="1"/);
});
