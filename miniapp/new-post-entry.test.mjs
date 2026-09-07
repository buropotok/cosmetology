import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const entry=await readFile(new URL('./new-post-entry.js',import.meta.url),'utf8');
const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');
const pencil=await readFile(new URL('./assets/icons/manual-edit.svg',import.meta.url),'utf8');

test('new post reset opens a choice screen before the AI wizard',()=>{
  assert.match(entry,/data-new-post-choice="ai"/);
  assert.match(entry,/Создать пост с помощью AI/);
  assert.match(entry,/data-new-post-choice="manual"/);
  assert.match(entry,/Создать пост вручную с нуля/);
  assert.match(entry,/data-new-post-choice="before-after"/);
  assert.match(entry,/ДО \/ ПОСЛЕ/);
  assert.match(entry,/cosmo-ai-wizard-reset[^\n]*queueMicrotask\(showEntry\)/);
  assert.match(entry,/wizard\.hidden=true;\s*composerContent\.hidden=true;\s*entry\.hidden=false/);
});

test('AI interface opens only after explicit AI choice',()=>{
  assert.match(entry,/if\(choice==='ai'\)openAi\(\)/);
  assert.match(entry,/function openAi\(\)/);
  assert.match(entry,/state\.restore\(\{\.\.\.state\.getSnapshot\(\),screen:'ai'\}\)/);
  assert.ok(bootstrap.indexOf("import('/publish-ai-wizard.js')")<bootstrap.indexOf("import('/new-post-entry.js')"));
  assert.ok(bootstrap.indexOf("import('/new-post-entry.js')")<bootstrap.indexOf("import('/navigation.js')"));
});

test('manual and before-after choices route to existing flows',()=>{
  assert.match(entry,/wizard\.querySelector\('\.publish-ai-wizard__manual'\)/);
  assert.match(entry,/window\.CosmoBeforeAfter\?\.open\?\.\(\)/);
  assert.match(entry,/cosmo-before-after-close[^\n]*action==='back'\)showEntry\(\)/);
});

test('existing pencil artwork is unchanged except for white stroke color',()=>{
  assert.match(pencil,/stroke="#fff"/);
  assert.match(pencil,/M3 20\.5h5\.2L19 9\.7/);
  assert.match(pencil,/m12\.9 6\.4 4\.7 4\.7/);
  assert.match(pencil,/M5\.1 15\.2c-1\.5-.5-2\.7-1\.8-2\.9-3\.4/);
  assert.match(pencil,/M4\.3 8\.2c-.6-1\.1-.5-2\.5.3-3\.5/);
});
