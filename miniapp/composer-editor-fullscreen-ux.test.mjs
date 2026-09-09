import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {shouldExitFullscreenOnPull} from './composer-editor-keyboard-layout.js';

const read=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8');

test('fullscreen exits only on a new downward pull that starts at the top of editor content',()=>{
  assert.equal(shouldExitFullscreenOnPull({scrollTop:0,startX:100,startY:100,currentX:104,currentY:154}),true);
  assert.equal(shouldExitFullscreenOnPull({scrollTop:24,startX:100,startY:100,currentX:104,currentY:170}),false);
  assert.equal(shouldExitFullscreenOnPull({scrollTop:0,startX:100,startY:100,currentX:160,currentY:135}),false);
  assert.equal(shouldExitFullscreenOnPull({scrollTop:0,startX:100,startY:100,currentX:102,currentY:132}),false);
});

test('fullscreen lifecycle is gesture-owned instead of blur-owned and toolbar menus open upward',()=>{
  const source=read('./composer-editor-keyboard-layout.js');
  assert.doesNotMatch(source,/editor\.on\('blur'/);
  assert.doesNotMatch(source,/editor\.off\('blur'/);
  assert.match(source,/host\.addEventListener\('touchmove',onTouchMove,\{passive:false\}\)/);
  assert.match(source,/shouldExitFullscreenOnPull\(/);
  assert.match(source,/\.composer-tool-menu \.composer-tool-panel\{top:auto!important;bottom:calc\(100% \+ 6px\)!important\}/);
  assert.match(source,/deactivate\(\);\s*if\(typeof editor\.commands\?\.blur==='function'\)editor\.commands\.blur\(\)/);
});

test('emoji popup is anchored above the toolbar and draggable inside the visual viewport',()=>{
  const source=read('./composer-tiptap.js');
  assert.match(source,/\.composer-emoji-panel\{position:fixed/);
  assert.match(source,/composer-emoji-drag-handle/);
  assert.match(source,/window\.visualViewport/);
  assert.match(source,/anchorRect\.top-panelRect\.height-8/);
  assert.match(source,/makeEmojiPanelDraggable\(panel,handle\)/);
  assert.match(source,/handle\.addEventListener\('pointerdown'/);
  assert.match(source,/handle\.addEventListener\('pointermove'/);
  assert.match(source,/placeEmojiPanel\(panel,drag\.left\+event\.clientX-drag\.x,drag\.top\+event\.clientY-drag\.y\)/);
});
