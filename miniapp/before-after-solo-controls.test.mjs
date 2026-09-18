import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createBeforeAfterState} from './before-after/state.js';

const read=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8');

test('Solo AI instruction text and placeholder are white',()=>{
  const css=read('./before-after.css');
  assert.match(css,/\.solo-ai textarea\{[^}]*color:#fff/);
  assert.match(css,/\.solo-ai textarea::placeholder\{color:#fff;opacity:1\}/);
});

test('Solo rotation exposes reset, +45 and local Tabler flip controls',()=>{
  const source=read('./before-after.js');
  assert.match(source,/data-solo-rotation="reset">0°</);
  assert.match(source,/data-solo-rotation="step">\+45°</);
  assert.match(source,/src="\/icons\/flip-horizontal\.svg"/);
  assert.match(source,/src="\/icons\/flip-vertical\.svg"/);
  assert.match(source,/setSoloRotation\(\(state\.photos\.before\?\.rotation \|\| 0\) \+ 45\)/);
  assert.match(source,/toggleSoloFlip\(button\.dataset\.soloFlip\)/);
  assert.match(read('./icons/flip-horizontal.svg'),/M12 3l0 18/);
  assert.match(read('./icons/flip-vertical.svg'),/M3 12l18 0/);
});

test('Before After persists and restores horizontal and vertical reflection state',async()=>{
  const state=createBeforeAfterState({loadImage:async()=>({naturalWidth:100,naturalHeight:80})});
  const file=new Blob(['image'],{type:'image/jpeg'});
  await state.restore({
    version:1,layout:'horizontal',ratio:'4/5',cropHeight:null,
    before:{imageIndex:0,x:0,y:0,scale:1,rotation:45,flipX:true,flipY:false,fitted:true},
    after:null,watermark:null,watermarkState:{x:0,y:0,scale:1,rotation:0,opacity:.2}
  },[file]);
  const snapshot=state.snapshot().state.before;
  assert.equal(snapshot.flipX,true);
  assert.equal(snapshot.flipY,false);
  URL.revokeObjectURL(state.photos.before.url);
});

test('preview, editor and exported composite all apply the same reflection axes',()=>{
  const source=read('./before-after.js');
  const editor=read('./before-after/editor.js');
  const composite=read('./before-after/composite.js');
  assert.match(source,/photo\.flipX \? -1 : 1/);
  assert.match(source,/photo\.flipY \? -1 : 1/);
  assert.match(editor,/p\.flipX \? -1 : 1/);
  assert.match(editor,/p\.flipY \? -1 : 1/);
  assert.match(composite,/photo\.flipX \? -1 : 1/);
  assert.match(composite,/photo\.flipY \? -1 : 1/);
});
