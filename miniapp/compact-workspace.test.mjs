import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const css=await readFile(new URL('./compact-workspace.css',import.meta.url),'utf8');
const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');

test('AI and Composer use the shared 2px workspace gutter without touching onboarding',()=>{
  assert.match(css,/\.publish-ai-wizard\{margin:2px;padding:2px\}/);
  assert.match(css,/#composer-screen\.approved-composer\{padding-left:2px;padding-right:2px\}/);
  assert.match(css,/\.publish-ai-wizard__prompt textarea\{padding:2px\}/);
  assert.match(css,/#composer-screen\.approved-composer \.composer-editor\{padding:2px\}/);
  assert.doesNotMatch(css,/onboarding/i);
  assert.doesNotMatch(css,/settings-/i);
  assert.match(bootstrap,/href='\/compact-workspace\.css'/);
});
