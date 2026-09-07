import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const entry=await readFile(new URL('./new-post-entry.js',import.meta.url),'utf8');
const navigation=await readFile(new URL('./navigation.js',import.meta.url),'utf8');
const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');
const pencil=await readFile(new URL('./assets/icons/manual-edit.svg',import.meta.url),'utf8');

test('Home new-post flow opens the Composer choice screen',()=>{
  assert.match(entry,/data-new-post-choice="ai"/);
  assert.match(entry,/Создать пост с помощью AI/);
  assert.match(entry,/data-new-post-choice="manual"/);
  assert.match(entry,/Создать пост вручную с нуля/);
  assert.match(entry,/data-new-post-choice="before-after"/);
  assert.match(entry,/ДО \/ ПОСЛЕ/);
  assert.match(navigation,/async function openNewPost\(\)/);
  assert.match(navigation,/cosmo-ai-wizard-reset/);
  assert.match(navigation,/router\.show\('composer'\);\s*window\.CosmoComposerView\?\.showEntry\?\.\(\)/);
  assert.match(entry,/function showEntry\(\)[\s\S]*wizard\.hidden=true;\s*composerContent\.hidden=true;\s*controls\.hidden=false;\s*publishMode\('entry'\)/);
});

test('AI interface opens only after explicit AI choice',()=>{
  assert.match(entry,/if\(choice==='ai'\)showAi\(\)/);
  assert.match(entry,/function showAi\(\)/);
  assert.match(entry,/state\.restore\(\{\.\.\.state\.getSnapshot\(\),screen:'ai'\}\)/);
  assert.ok(bootstrap.indexOf("import('/navigation.js')")<bootstrap.indexOf("import('/publish-ai-wizard.js')"));
  assert.ok(bootstrap.indexOf("import('/publish-ai-wizard.js')")<bootstrap.indexOf("import('/new-post-entry.js')"));
});

test('manual and before-after choices stay inside the Composer view',()=>{
  assert.match(entry,/function showEditor\(\{manual=false,focus=true\}=\{\}\)[\s\S]*composerContent\.hidden=false;\s*publishMode\('compose'\)/);
  assert.match(entry,/if\(choice==='manual'\)showEditor\(\{manual:true\}\)/);
  assert.match(entry,/else if\(choice==='before-after'\)openBeforeAfter\(\)/);
  assert.match(entry,/window\.CosmoBeforeAfter\?\.open\?\.\(\)/);
  assert.match(entry,/window\.addEventListener\('cosmo-before-after-close',event=>\{\s*if\(event\.detail\?\.action==='back'\)showEntry\(\);\s*else if\(event\.detail\?\.action==='save'\)showEditor\(\{focus:false\}\)/);
});

test('duplicate manual and before-after actions are removed from AI screen',()=>{
  assert.match(entry,/wizard\.querySelectorAll\('\.publish-ai-wizard__manual,\.publish-ai-wizard__before-after'\)\.forEach\(node=>node\.remove\(\)\)/);
});

test('choice buttons use requested icons, blue styling and centered labels',()=>{
  assert.match(entry,/new-post-entry__icon--ai[^>]*[^<]*>✨<\/span>/);
  assert.doesNotMatch(entry,/data-new-post-choice="ai"><img src="\/assets\/icons\/cosmo-sofa\.svg"/);
  assert.match(entry,/\.new-post-entry__button\{[^}]*justify-content:center[^}]*background:#2d8fd3[^}]*text-align:center/);
  assert.match(entry,/\.new-post-entry__icon\{[^}]*position:absolute[^}]*left:18px/);
  assert.match(entry,/\.new-post-entry__pair img\{[^}]*filter:brightness\(0\) invert\(1\)/);
  assert.match(entry,/data-new-post-choice="before-after"[\s\S]*account-box\.svg[\s\S]*account-box\.svg/);
  assert.match(entry,/\.new-post-entry__title\{[^}]*text-align:center/);
  assert.match(entry,/\.new-post-entry__subtitle\{[^}]*text-align:center/);
});

test('existing pencil artwork is unchanged except for white stroke color',()=>{
  assert.match(pencil,/stroke="#fff"/);
  assert.match(pencil,/M3 20\.5h5\.2L19 9\.7/);
  assert.match(pencil,/m12\.9 6\.4 4\.7 4\.7/);
  assert.match(pencil,/M5\.1 15\.2c-1\.5-.5-2\.7-1\.8-2\.9-3\.4/);
  assert.match(pencil,/M4\.3 8\.2c-.6-1\.1-.5-2\.5.3-3\.5/);
});
