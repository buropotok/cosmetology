import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const css=await readFile(new URL('./publish-ai-wizard.css',import.meta.url),'utf8');
const source=await readFile(new URL('./publish-ai-wizard.js',import.meta.url),'utf8');

test('AI response has a substantially larger scrollable reading area',()=>{
  const responseRule=css.match(/\.publish-ai-wizard__response-body\{([^}]*)\}/)?.[1]||'';
  assert.match(responseRule,/min-height:220px/);
  assert.match(responseRule,/max-height:520px/);
  assert.match(responseRule,/overflow-y:auto/);
  assert.match(css,/@media\(max-width:520px\)\{[\s\S]*?\.publish-ai-wizard__response-body\{max-height:60vh\}/);
});

test('successful AI generation smoothly scrolls the response section to the top',()=>{
  assert.match(source,/function scrollResponseIntoView\(\)\{[^}]*scrollIntoView\(\{behavior:'smooth',block:'start'\}\)/);
  assert.match(source,/let shouldScrollResponse=false;/);
  assert.match(source,/renderDiscovery\(result\.discovery\);\s*shouldScrollResponse=true;/);
  assert.match(source,/setResponse\(result\.text,\{controlsState:'ready-post',imageOptions:requestImageOptions\}\);\s*shouldScrollResponse=true;/);
  assert.match(source,/setPending\(false\);if\(shouldScrollResponse\)scrollResponseIntoView\(\)/);
});

test('AI request failures do not trigger the success auto-scroll',()=>{
  const catchBody=source.match(/\}catch\(error\)\{([\s\S]*?)\}finally\{/)?.[1]||'';
  assert.doesNotMatch(catchBody,/shouldScrollResponse=true/);
});
