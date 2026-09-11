import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source=await readFile(new URL('./before-after-controller.js',import.meta.url),'utf8');

test('Before/After delegates recovery draft persistence to the draft subsystem',()=>{
  assert.doesNotMatch(source,/CosmoComposerState/);
  assert.doesNotMatch(source,/CosmoAiWizardState/);
  assert.doesNotMatch(source,/['"]\/api\/miniapp\/draft['"]/);
  assert.match(source,/CosmoSofaDraft/);
  assert.match(source,/setBeforeAfterState\(snapshot\.state,\{persist:true\}\)/);
  assert.match(source,/flush\('before-after-state'\)/);
});
