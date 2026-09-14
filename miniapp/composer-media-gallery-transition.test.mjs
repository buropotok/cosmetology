import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=name=>readFile(new URL(name,import.meta.url),'utf8');

test('gallery select action is owned by the right header column',async()=>{
 const css=await read('./composer-media-gallery.css');
 assert.match(css,/\.cosmo-gallery-select,\.cosmo-gallery-add\{grid-column:3;grid-row:1;justify-self:end\}/);
 assert.match(css,/\.cosmo-gallery-collapse\{grid-column:2\}/);
});

test('successful delete compacts existing tiles instead of rebuilding the gallery',async()=>{
 const gallery=await read('./composer-media-gallery.js');
 assert.match(gallery,/button\.dataset\.assetId=asset\.id/);
 assert.match(gallery,/const compactDeletedTiles=/);
 assert.match(gallery,/getBoundingClientRect\(\)/);
 assert.match(gallery,/requestAnimationFrame/);
 assert.match(gallery,/transform 180ms ease/);
 const removeSelected=gallery.match(/const removeSelected=.*?;\n const open=/s)?.[0]||'';
 assert.match(removeSelected,/compactDeletedTiles\(removed\)/);
 assert.doesNotMatch(removeSelected,/showGrid\(\)/);
});
