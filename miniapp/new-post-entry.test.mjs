import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const entry=await readFile(new URL('./new-post-entry.js',import.meta.url),'utf8');
const navigation=await readFile(new URL('./navigation.js',import.meta.url),'utf8');
const controller=await readFile(new URL('./before-after-controller.js',import.meta.url),'utf8');
const bootstrap=await readFile(new URL('./bootstrap.js',import.meta.url),'utf8');
const pencil=await readFile(new URL('./assets/icons/manual-edit.svg',import.meta.url),'utf8');
const transfer=await readFile(new URL('./ai-post-editor-transfer.js',import.meta.url),'utf8');
const styles=await readFile(new URL('./styles.css',import.meta.url),'utf8');

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

test('resumed draft labels manual entry as manual editing and preserves Composer image options',()=>{
  assert.match(entry,/window\.CosmoSofaDraft\?\.getState\?\.\(\)\.hasDraft\?'Ручное редактирование':'Создать пост вручную с нуля'/);
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

test('Composer Back preserves accessible label and the shared navigation path',()=>{
  assert.match(navigation,/backButton\.className='cosmo-composer-back back-button'/);
  assert.match(navigation,/backButton\.setAttribute\('aria-label','Назад'\)/);
  assert.match(navigation,/backButton\.addEventListener\('click',\(\)=>\{void navigation\.back\(\)\}\)/);
});

test('duplicate manual and before-after actions are removed from AI screen',()=>{
  assert.match(entry,/wizard\.querySelectorAll\('\.publish-ai-wizard__manual,\.publish-ai-wizard__before-after'\)\.forEach\(node=>node\.remove\(\)\)/);
});

test('Home and New Post menu buttons use white pillow surfaces on a soft gray panel',()=>{
  assert.match(entry,/new-post-entry__icon--ai[^>]*[^<]*>✨<\/span>/);
  assert.match(entry,/\.new-post-entry__button\{[^}]*justify-content:center[^}]*text-align:center/);
  assert.match(entry,/data-new-post-choice="before-after"[\s\S]*account-box\.svg[\s\S]*account-box\.svg/);
  assert.match(entry,/\.new-post-entry__title\{[^}]*text-align:center/);
  assert.match(entry,/\.new-post-entry__subtitle\{[^}]*text-align:center/);
  assert.match(styles,/#home-screen \.cosmo-flow-actions \.cosmo-primary,[\s\S]*#home-screen \.cosmo-flow-actions \.cosmo-secondary,[\s\S]*\.new-post-entry \.new-post-entry__actions \.new-post-entry__button\{/);
  assert.match(styles,/#home-screen\.cosmo-flow-screen\{background:linear-gradient\(145deg,#eef3f8 0%,#e7edf3 100%\)\}/);
  assert.match(styles,/#new-post-entry\.new-post-entry\{[^}]*background:linear-gradient\(145deg,#eef3f8 0%,#e7edf3 100%\)/);
  assert.match(styles,/background:linear-gradient\(145deg,#fff 0%,#fff 68%,#fafbfd 100%\)/);
  assert.match(styles,/color:#536170/);
  assert.match(styles,/border-radius:22px/);
  assert.match(styles,/box-shadow:-5px -5px 9px rgba\(255,255,255,\.98\),7px 8px 11px rgba\(112,130,149,\.32\),0 3px 5px rgba\(105,123,142,\.18\)/);
  assert.match(styles,/\.new-post-entry \.new-post-entry__actions \.new-post-entry__button:focus-visible\{[\s\S]*outline:2px solid/);
  assert.match(styles,/\.new-post-entry \.new-post-entry__actions \.new-post-entry__button:active\{[\s\S]*box-shadow:inset 4px 4px 7px/);
});

test('Pillow buttons finish pressed feedback before Home and New Post actions run',()=>{
  assert.match(styles,/@keyframes cosmo-pillow-press-hold\{/);
  assert.match(styles,/animation:cosmo-pillow-press-hold 140ms linear both/);
  assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(navigation,/function waitForPillowPress\(button\)/);
  assert.match(navigation,/button\.addEventListener\('animationend',finish\)/);
  assert.match(navigation,/fallbackTimer=setTimeout\(\(\)=>finish\(\),180\)/);
  const newPost=navigation.slice(navigation.indexOf('async function openNewPost()'),navigation.indexOf('let resumeInFlight=false'));
  assert.ok(newPost.indexOf('await waitForPillowPress(button)')<newPost.indexOf('await confirmDraftReplacement()'));
  const resume=navigation.slice(navigation.indexOf('async function resumeDraft()'),navigation.indexOf("home.querySelector('#flow-new')",navigation.indexOf('async function resumeDraft()')));
  assert.ok(resume.indexOf('await waitForPillowPress(continueButton)')<resume.indexOf('restored=await draft.load()'));
  assert.match(entry,/function runAfterPillowPress\(button,action\)/);
  assert.match(entry,/button\.addEventListener\('animationend',finish\)/);
  assert.match(entry,/void action\(\)/);
  assert.match(entry,/fallbackTimer=setTimeout\(\(\)=>finish\(\),180\)/);
  assert.match(entry,/runAfterPillowPress\(button,\(\)=>\{[\s\S]*navigation\.push\(navigation\.STATES\.AI\)/);
});

test('existing pencil artwork is unchanged except for white stroke color',()=>{
  assert.match(pencil,/stroke="#fff"/);
  assert.match(pencil,/M3 20\.5h5\.2L19 9\.7/);
  assert.match(pencil,/m12\.9 6\.4 4\.7 4\.7/);
  assert.match(pencil,/M5\.1 15\.2c-1\.5-.5-2\.7-1\.8-2\.9-3\.4/);
  assert.match(pencil,/M4\.3 8\.2c-.6-1\.1-.5-2\.5.3-3\.5/);
});
