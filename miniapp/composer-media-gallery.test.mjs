import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=name=>readFile(new URL(name,import.meta.url),'utf8');

test('Composer owns the only gallery entry and approved labels',async()=>{
 const bridge=await read('./composer-media-gallery-bridge.js');
 assert.match(bridge,/Добавить фото с устройства/);
 assert.match(bridge,/Галерея Cosmo Sofa/);
 assert.match(bridge,/composer-image-actions/);
 assert.doesNotMatch(bridge,/home/i);
});

test('gallery uses permanent media API, authenticated image requests and Composer public image API',async()=>{
 const [gallery,bridge]=await Promise.all([read('./composer-media-gallery.js'),read('./composer-media-gallery-bridge.js')]);
 assert.match(gallery,/\/api\/miniapp\/media/);
 assert.match(gallery,/Authorization:`tma \$\{initData\}`/);
 assert.match(gallery,/Пока в вашей галерее нет иллюстраций\./);
 assert.match(gallery,/Свернуть/);
 assert.match(gallery,/Добавить/);
 assert.match(gallery,/fetchFile/);
 assert.match(bridge,/CosmoComposerImages/);
 assert.match(bridge,/addFiles/);
});

test('gallery supports approved multi-select add and confirmed batch delete',async()=>{
 const gallery=await read('./composer-media-gallery.js');
 assert.match(gallery,/Выбрать/);
 assert.match(gallery,/Удалить/);
 assert.match(gallery,/selectedIds/);
 assert.match(gallery,/\/delete/);
 assert.match(gallery,/Удалить выбранные изображения/);
 assert.match(gallery,/showConfirm/);
 assert.match(gallery,/Promise\.all/);
});

test('selected image transfer has explicit cancel and ten second timeout',async()=>{
 const gallery=await read('./composer-media-gallery.js');
 assert.match(gallery,/ADD_TIMEOUT_MS=10000/);
 assert.match(gallery,/Идёт загрузка\./);
 assert.match(gallery,/>Отмена</);
 assert.match(gallery,/controller\.abort\(\)/);
});

test('optional gallery startup is failure isolated and bridge cleanup is reversible',async()=>{
 const [bootstrap,bridge]=await Promise.all([read('./bootstrap.js'),read('./composer-media-gallery-bridge.js')]);
 assert.match(bootstrap,/void import\('\/composer-media-gallery-bridge\.js'\)/);
 assert.match(bootstrap,/Composer gallery failed to start/);
 assert.doesNotMatch(bootstrap,/await import\('\/composer-media-gallery-bridge\.js'\)/);
 assert.match(bridge,/gallery\.remove\(\)/);
 assert.match(bridge,/classList\.remove\('composer-image-actions--gallery'\)/);
 assert.match(bridge,/addDevice\.textContent=previousLabel/);
});
