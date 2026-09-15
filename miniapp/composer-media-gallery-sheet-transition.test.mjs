import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=name=>readFile(new URL(name,import.meta.url),'utf8');

test('gallery sheet enters from below with a fading scrim',async()=>{
 const [gallery,css]=await Promise.all([read('./composer-media-gallery.js'),read('./composer-media-gallery.css')]);
 assert.match(css,/\.cosmo-gallery-scrim\{[^}]*opacity:0;[^}]*transition:opacity 280ms ease/);
 assert.match(css,/\.cosmo-gallery-sheet\{[^}]*transform:translate3d\(0,100%,0\);[^}]*transition:transform 280ms cubic-bezier\(\.22,\.61,\.36,1\)/);
 assert.match(css,/\.cosmo-gallery-layer\.is-open \.cosmo-gallery-scrim\{opacity:1\}/);
 assert.match(css,/\.cosmo-gallery-layer\.is-open \.cosmo-gallery-sheet\{transform:translate3d\(0,0,0\)\}/);
 assert.match(gallery,/requestAnimationFrame\(\(\)=>\{if\(root===openingRoot&&!openingRoot\.classList\.contains\('is-closing'\)\)openingRoot\.classList\.add\('is-open'\)\}\)/);
});

test('gallery sheet stays mounted until its exit transition completes',async()=>{
 const gallery=await read('./composer-media-gallery.js');
 assert.match(gallery,/const SHEET_TRANSITION_MS=280/);
 assert.match(gallery,/classList\.add\('is-closing'\)/);
 assert.match(gallery,/classList\.remove\('is-open'\)/);
 assert.match(gallery,/addEventListener\('transitionend',onEnd\)/);
 assert.match(gallery,/event\.propertyName!=='transform'/);
 const close=gallery.match(/const finishClose=.*?;\n const renderEmpty=/s)?.[0]||'';
 assert.match(close,/closingRoot\.remove\(\)/);
 assert.match(close,/setTimeout\(/);
 assert.ok(close.indexOf("classList.remove('is-open')")<close.indexOf('closingRoot.remove()'));
});
