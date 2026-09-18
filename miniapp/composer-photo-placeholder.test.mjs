import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./composer-mockup.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('./composer-mockup.css',import.meta.url),'utf8');

test('empty Composer photo placeholder opens the device picker and loaded photos show the edit hint',()=>{
  assert.match(source,/Нажмите на фото для редактирования/);
  assert.match(source,/photoStage\?\.addEventListener\('click',\(\)=>\{if\(!\(imageInput\.files\?\.length\|\|0\)\)imageInput\.click\(\)\}\)/);
  assert.match(source,/const syncPhotoEditHint=\(\)=>\{photoEditHint\.hidden=!\(imageInput\.files\?\.length\|\|0\)\}/);
  assert.match(source,/imageInput\.addEventListener\('change',syncPhotoEditHint\)/);
  assert.match(css,/\.composer-photo-edit-hint\{/);
});
