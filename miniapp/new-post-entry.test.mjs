import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const entry=await readFile(new URL('./new-post-entry.js',import.meta.url),'utf8');
const navigation=await readFile(new URL('./navigation.js',import.meta.url),'utf8');
const controller=await readFile(new URL('./before-after-controller.js',import.meta.url),'utf8');
const beforeAfterHtml=await readFile(new URL('./before-after.html',import.meta.url),'utf8');
const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');
const pencil=await readFile(new URL('./assets/icons/manual-edit.svg',import.meta.url),'utf8');
const transfer=await readFile(new URL('./ai-post-editor-transfer.js',import.meta.url),'utf8');

test('Home new-post flow resets the logical navigation stack to Menu',()=>{
  assert.match(entry,/data-new-post-choice="ai"/);
  assert.match(entry,/Создать пост с помощью AI/);
  assert.match(entry,/data-new-post-choice="manual"/);
  assert.match(entry,/Создать пост вручную с нуля/);
  assert.match(entry,/data-new-post-choice="before-after"/);
  assert.match(entry,/ДО \/ ПОСЛЕ/);
  assert.match(navigation,/await navigation\.reset\(\[STATES\.HOME,STATES\.MENU\]\)/);
  assert.match(navigation,/cosmo-ai-wizard-reset/);
  assert.match(entry,/function showEntry\(\)[\s\S]*syncManualLabel\(\);[\s\S]*wizard\.hidden=true;\s*composerContent\.hidden=true;\s*controls\.hidden=false;\s*publishMode\('entry'\)/);
});

test('resumed draft labels manual entry as continuation and preserves Composer image options',()=>{
  assert.match(entry,/window\.CosmoSofaDraft\?\.getState\?\.\(\)\.hasDraft\?'Продолжить редактирование':'Создать пост вручную с нуля'/);
  assert.doesNotMatch(transfer,/cosmo-ai-wizard-manual/);
  assert.doesNotMatch(transfer,/setImageOptions\?\.\(\{\.\.\.DEFAULT_IMAGE_OPTIONS\}\)/);
});

test('New Post choices request logical navigation instead of deciding Back destinations',()=>{
  assert.match(entry,/navigation\.push\(navigation\.STATES\.AI\)/);
  assert.match(entry,/navigation\.push\(navigation\.STATES\.PUBLISH,\{manual:true\}\)/);
  assert.match(entry,/navigation\.push\(navigation\.STATES\.BEFORE_AFTER\)/);
  assert.doesNotMatch(entry,/CosmoBeforeAfter\?\.open/);
  assert.doesNotMatch(entry,/cosmo-before-after-close/);
  assert.match(entry,/CosmoComposerView=Object\.freeze\(\{showEntry,showAi,showEditor\}\)/);
});

test('New Post entry remains lazy-loaded from navigation',()=>{
  assert.doesNotMatch(bootstrap,/import\(['"]\/new-post-entry\.js['"]\)/);
  assert.match(navigation,/newPostEntryPromise=import\('\/new-post-entry\.js'\)/);
});

test('Before/After Back and Save use the shared navigation API',()=>{
  assert.match(controller,/navigation\?\.back/);
  assert.match(controller,/navigation\.replace\(navigation\.STATES\.PUBLISH,\{focus:false\}\)/);
  assert.doesNotMatch(controller,/CosmoRouter\?\.show\?\.\('composer'\)/);
  assert.doesNotMatch(controller,/dispatchEvent\(new CustomEvent\('cosmo-before-after-close'/);
});

test('Back controls use the same arrow and Назад label',()=>{
  assert.match(navigation,/backButton\.textContent='‹ Назад'/);
  assert.match(navigation,/backButton\.addEventListener\('click',\(\)=>\{void navigation\.back\(\)\}\)/);
  assert.match(navigation,/\.cosmo-composer-back\{[^}]*font:600 15px\/1 inherit!important[^}]*padding:8px 4px!important/);
  assert.match(beforeAfterHtml,/<button id="back" class="ghost">‹ Назад<\/button>/);
});

test('duplicate manual and before-after actions are removed from AI screen',()=>{
  assert.match(entry,/wizard\.querySelectorAll\('\.publish-ai-wizard__manual,\.publish-ai-wizard__before-after'\)\.forEach\(node=>node\.remove\(\)\)/);
});

test('choice buttons keep requested icons, blue styling and centered labels',()=>{
  assert.match(entry,/new-post-entry__icon--ai[^>]*[^<]*>✨<\/span>/);
  assert.match(entry,/\.new-post-entry__button\{[^}]*justify-content:center[^}]*background:#2d8fd3[^}]*text-align:center/);
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