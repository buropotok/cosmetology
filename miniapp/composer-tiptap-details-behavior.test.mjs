import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const tiptap=await readFile(new URL('./composer-tiptap.js',import.meta.url),'utf8');

test('details toolbar action preserves selected-text conversion and adds empty-line creation',()=>{
  assert.match(tiptap,/function detailsNode\(content\).*text:'Подробнее'/s);
  assert.match(tiptap,/if\(lines\.length\).*deleteRange\(\{from,to\}\)\.insertContent\(detailsNode\(content\)\)/s);
  assert.match(tiptap,/!selection\.empty\|\|\$from\.depth!==1\|\|\$from\.parent\.type\.name!=='paragraph'\|\|\$from\.parent\.content\.size!==0/);
  assert.match(tiptap,/insertContentAt\(\{from:\$from\.before\(\$from\.depth\),to:\$from\.after\(\$from\.depth\)\},detailsNode\(\[\{type:'paragraph'\}\]\)\)/);
});

test('details Backspace removes a fully selected block or a completely empty block',()=>{
  assert.match(tiptap,/function selectedWholeDetails\(selection\)/);
  assert.match(tiptap,/selection\.node\?\.type\?\.name==='details'/);
  assert.match(tiptap,/selection\.from<=bounds\.from&&selection\.to>=bounds\.to/);
  assert.match(tiptap,/addKeyboardShortcuts\(\)\{return\{Backspace:/);
  assert.match(tiptap,/if\(selected\)return this\.editor\.commands\.deleteRange\(selected\)/);
  assert.match(tiptap,/current\.node\.textContent\.length===0\?this\.editor\.commands\.deleteRange/);
});

test('main editor heading uses Times New Roman and toolbar pointerdown keeps editor focus',()=>{
  assert.match(tiptap,/\.composer-tiptap-editor \.tiptap h1\{[^}]*font-family:"Times New Roman",Times,serif/);
  assert.match(tiptap,/toolbar\.addEventListener\('pointerdown',e=>\{if\(e\.target\.closest\?\.\('button'\)\)e\.preventDefault\(\)\}\)/);
  assert.match(tiptap,/b\.addEventListener\('pointerdown',preserve\)/);
});
