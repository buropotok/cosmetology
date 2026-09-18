import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./composer-image-manager.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('./composer-mockup.css',import.meta.url),'utf8');

test('Composer image owner opens the device picker only for an empty photo stage and renders the edit hint from owned file state',()=>{
  assert.match(source,/photoEditHint\.textContent='Нажмите на фото для редактирования'/);
  assert.match(source,/const syncPhotoUi=\(\)=>\{photoEditHint\.hidden=!files\.length\}/);
  assert.match(source,/const openPickerFromEmptyStage=\(\)=>\{if\(!files\.length\)input\.click\(\)\}/);
  assert.match(source,/photoStage\?\.addEventListener\('click',openPickerFromEmptyStage\)/);
  assert.match(source,/function notifyChange\(\)\{\s*updateTelegramLayoutVisibility\(\);\s*syncPhotoUi\(\);/);
  assert.match(css,/\.composer-photo-edit-hint\{/);
});
