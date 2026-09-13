import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('./composer-image-manager.js',import.meta.url),'utf8');

test('photo manager exposes deterministic file reordering',()=>{
 assert.match(source,/function moveFile\(from,to\)/);
 assert.match(source,/const \[file\]=files\.splice\(from,1\);\s*files\.splice\(to,0,file\);\s*notifyChange\(\)/);
 assert.match(source,/moveFile,/);
});

test('photo thumbnails provide a pointer drag handle suitable for touch and mouse',()=>{
 assert.match(source,/composer-image-reorder/);
 assert.match(source,/aria-label','Переместить изображение'/);
 assert.match(source,/touch-action:none/);
 assert.match(source,/addEventListener\('pointerdown'/);
 assert.match(source,/addEventListener\('pointermove'/);
 assert.match(source,/setPointerCapture/);
 assert.match(source,/elementFromPoint/);
});
