import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {computeVisualViewportInsets,isMobileEditorEnvironment} from './composer-editor-keyboard-layout.js';

const read=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8');

test('VisualViewport inset keeps the editor dock above an overlay keyboard',()=>{
  assert.deepEqual(
    computeVisualViewportInsets({innerHeight:800,viewport:{offsetTop:20,height:500}}),
    {top:20,bottom:280,height:500}
  );
});

test('resized layout viewport needs no synthetic keyboard bottom inset',()=>{
  assert.deepEqual(
    computeVisualViewportInsets({innerHeight:500,viewport:{offsetTop:0,height:500}}),
    {top:0,bottom:0,height:500}
  );
});

test('keyboard layout is limited to mobile or coarse-pointer editor environments',()=>{
  assert.equal(isMobileEditorEnvironment({platform:'android'}),true);
  assert.equal(isMobileEditorEnvironment({platform:'ios'}),true);
  assert.equal(isMobileEditorEnvironment({platform:'tdesktop',coarsePointer:false}),false);
  assert.equal(isMobileEditorEnvironment({platform:'web',coarsePointer:true}),true);
});

test('Composer keyboard layout anchors controls and keeps overflowing text scrollable',()=>{
  const source=read('./composer-editor-keyboard-layout.js');
  const runtime=read('./composer-editor-runtime.js');

  assert.match(source,/controls\.append\(toolbar,clear\)/);
  assert.match(source,/position:fixed!important/);
  assert.match(source,/bottom:var\(--composer-editor-vv-bottom,0px\)!important/);
  assert.match(source,/\.composer-tiptap-editor\{order:1;flex:1 1 auto;min-height:0!important/);
  assert.match(source,/overflow-y:auto!important/);
  assert.match(source,/\.composer-editor-footer\{display:none!important\}/);
  assert.match(source,/\.composer-tool-panel\{top:auto!important;bottom:43px!important\}/);
  assert.match(source,/win\.addEventListener\('resize',updateViewport\)/);
  assert.match(source,/win\.removeEventListener\('resize',updateViewport\)/);
  assert.match(source,/viewport\?\.addEventListener\?\.\('resize',updateViewport\)/);
  assert.match(source,/viewport\?\.addEventListener\?\.\('scroll',updateViewport\)/);
  assert.match(source,/editor\.off\('focus',onFocus\)/);
  assert.match(source,/editor\.off\('blur',onBlur\)/);
  assert.match(runtime,/module:'composer-editor-keyboard-layout'/);
  assert.match(runtime,/initComposerEditorKeyboardLayout\(\)/);
  assert.match(runtime,/modules:\{tiptap,bridge,placeholder,fixes\}/);
});
