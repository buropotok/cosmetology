import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const css=await readFile(new URL('./publish-ai-wizard.css',import.meta.url),'utf8');

test('AI response has a substantially larger scrollable reading area',()=>{
  const responseRule=css.match(/\.publish-ai-wizard__response-body\{([^}]*)\}/)?.[1]||'';
  assert.match(responseRule,/min-height:220px/);
  assert.match(responseRule,/max-height:520px/);
  assert.match(responseRule,/overflow-y:auto/);
  assert.match(css,/@media\(max-width:520px\)\{[\s\S]*?\.publish-ai-wizard__response-body\{max-height:60vh\}/);
});
