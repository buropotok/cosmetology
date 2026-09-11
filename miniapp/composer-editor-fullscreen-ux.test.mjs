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
  assert.match(source,/const exitFullscreen=\(\)=>\{\s*deactivate\(\);\s*if\(typeof editor\.commands\?\.blur==='function'\)editor\.commands\.blur\(\)/);
});

test('fullscreen state clears when Composer leaves its route, publish mode, or opens Before/After',()=>{
  const source=read('./composer-editor-keyboard-layout.js');
  const beforeAfter=read('./before-after-controller.js');
  assert.match(source,/const onRoute=route=>\{if\(route!=='composer'\)exitFullscreen\(\)\}/);
  assert.match(source,/const onPublishMode=event=>\{if\(event\?\.detail\?\.mode!=='compose'\)exitFullscreen\(\)\}/);
  assert.match(source,/const onBeforeAfterOpen=\(\)=>exitFullscreen\(\)/);
  assert.match(source,/router\.subscribe\(onRoute\)/);
  assert.match(source,/win\.addEventListener\('cosmo-publish-mode',onPublishMode\)/);
  assert.match(source,/win\.addEventListener\('cosmo-before-after-open',onBeforeAfterOpen\)/);
  assert.match(source,/win\.removeEventListener\('cosmo-publish-mode',onPublishMode\)/);
  assert.match(source,/win\.removeEventListener\('cosmo-before-after-open',onBeforeAfterOpen\)/);
  assert.match(source,/unsubscribeRoute\(\)/);
  assert.match(beforeAfter,/new CustomEvent\('cosmo-before-after-open',\{detail:\{mode\}\}\)/);
  assert.match(beforeAfter,/ensureOverlay\('solo'\);emitOpen\('solo'\)/);
  assert.match(beforeAfter,/ensureOverlay\('dual'\);emitOpen\('dual'\)/);
});

test('emoji popup is anchored above the toolbar, draggable and toggles closed on a second button press',()=>{
  const source=read('./composer-tiptap.js');
  assert.match(source,/\.composer-emoji-panel\{position:fixed/);
  assert.match(source,/composer-emoji-drag-handle/);
  assert.match(source,/window\.visualViewport/);
  assert.match(source,/anchorRect\.top-panelRect\.height-8/);
  assert.match(source,/makeEmojiPanelDraggable\(panel,handle\)/);
  assert.match(source,/handle\.addEventListener\('pointerdown'/);
  assert.match(source,/handle\.addEventListener\('pointermove'/);
  assert.match(source,/placeEmojiPanel\(panel,drag\.left\+event\.clientX-drag\.x,drag\.top\+event\.clientY-drag\.y\)/);
  assert.match(source,/const existing=document\.querySelector\('\.composer-emoji-panel'\);if\(existing\)\{existing\.remove\(\);return\}/);
});

test('emoji popup is wider, contains a large palette, and scrolls horizontally without stealing the drag handle',()=>{
  const source=read('./composer-tiptap.js');
  assert.match(source,/width:min\(440px,calc\(100vw - 16px\)\)/);
  assert.match(source,/\.composer-emoji-scroll\{display:grid;grid-template-rows:repeat\(4,38px\);grid-auto-flow:column/);
  assert.match(source,/overflow-x:auto;overflow-y:hidden/);
  assert.match(source,/touch-action:pan-x/);
  const emojiArray=source.match(/const EMOJIS=\[(.*?)\];/s)?.[1]||'';
  assert.ok((emojiArray.match(/'[^']+'/g)||[]).length>150);
  assert.match(source,/scroll\.className='composer-emoji-scroll'/);
  assert.match(source,/scroll\.append\(b\)/);
  assert.match(source,/panel\.append\(scroll\)/);
});
