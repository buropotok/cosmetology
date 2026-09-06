import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const css=await readFile(new URL('./compact-workspace.css',import.meta.url),'utf8');
const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');

test('AI and Composer keep 2px outer gutters with comfortable panel content spacing',()=>{
  assert.match(css,/\.publish-ai-wizard\{margin:2px;padding:14px 2px;border-radius:12px\}/);
  assert.match(css,/#composer-screen\.approved-composer\{padding-left:2px;padding-right:2px\}/);
  assert.match(css,/\.publish-ai-wizard__response-body\{padding:14px 2px;border-radius:10px\}/);
  assert.match(css,/\.publish-ai-wizard__control-panel\{padding:14px 2px;border-radius:10px;overflow:hidden\}/);
  assert.match(css,/#composer-screen\.approved-composer \.composer-editor\{padding:14px 2px\}/);
  assert.match(css,/#composer-screen\.approved-composer \.composer-bodytext\{padding:12px 14px!important\}/);
  assert.doesNotMatch(css,/onboarding/i);
  assert.doesNotMatch(css,/settings-/i);
  assert.match(bootstrap,/href='\/compact-workspace\.css'/);
});

test('AI prompt is one full-width input surface with a circular bottom-right send button',()=>{
  assert.match(css,/\.publish-ai-wizard__prompt\{position:relative;display:block;[^}]*border-radius:12px;overflow:hidden\}/);
  assert.match(css,/\.publish-ai-wizard__prompt textarea\{[^}]*width:100%;[^}]*padding:14px 58px 14px 14px;[^}]*background:transparent;[^}]*border-radius:0\}/);
  assert.match(css,/\.publish-ai-wizard__prompt button\{position:absolute;right:8px;bottom:8px;[^}]*width:40px;height:40px;[^}]*border-radius:50%/);
});
