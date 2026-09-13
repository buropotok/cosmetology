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
 assert.match(gallery,/cosmo-gallery-collapse[^']*'>Свернуть/);
 assert.match(gallery,/cosmo-gallery-add[^']*hidden>Добавить/);
 assert.match(gallery,/fetchResponse\(asset\.originalUrl\)/);
 assert.match(bridge,/CosmoComposerImages\?\.addFiles/);
});
