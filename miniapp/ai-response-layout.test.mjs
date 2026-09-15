import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const css=await readFile(new URL('./publish-ai-wizard.css',import.meta.url),'utf8');
const source=await readFile(new URL('./publish-ai-wizard.js',import.meta.url),'utf8');

function createScrollResponseIntoView({responseBody,response,requestAnimationFrame}){
  const start=source.indexOf('function scrollResponseIntoView()');
  const end=source.indexOf('  function cancelAiMessage',start);
  assert.ok(start>=0&&end>start,'scrollResponseIntoView must exist in AI Widget');
  const functionSource=source.slice(start,end);
  const root={querySelector(selector){assert.equal(selector,'.publish-ai-wizard__response');return response}};
  return Function('root','responseBody','window',`${functionSource};return scrollResponseIntoView;`)(root,responseBody,{requestAnimationFrame});
}

test('AI response has a substantially larger scrollable reading area',()=>{
  const responseRule=css.match(/\.publish-ai-wizard__response-body\{([^}]*)\}/)?.[1]||'';
  assert.match(responseRule,/min-height:220px/);
  assert.match(responseRule,/max-height:520px/);
  assert.match(responseRule,/overflow-y:auto/);
  assert.match(css,/@media\(max-width:520px\)\{[\s\S]*?\.publish-ai-wizard__response-body\{max-height:60vh\}/);
});

test('AI response auto-scroll resets the inner reading position before smooth outer scroll',()=>{
  const responseBody={scrollTop:287};
  let scheduledFrame=null;
  let scrollOptions=null;
  const response={scrollIntoView(options){scrollOptions=options}};
  const scrollResponseIntoView=createScrollResponseIntoView({
    responseBody,
    response,
    requestAnimationFrame(callback){scheduledFrame=callback}
  });

  scrollResponseIntoView();

  assert.equal(responseBody.scrollTop,0);
  assert.equal(scrollOptions,null,'outer page scroll must wait for the rendered frame');
  assert.equal(typeof scheduledFrame,'function');
  scheduledFrame();
  assert.deepEqual(scrollOptions,{behavior:'smooth',block:'start'});
});

test('successful AI generation triggers auto-scroll for discovery and ready posts',()=>{
  assert.match(source,/let shouldScrollResponse=false;/);
  assert.match(source,/renderDiscovery\(result\.discovery\);\s*shouldScrollResponse=true;/);
  assert.match(source,/setResponse\(result\.text,\{controlsState:'ready-post',imageOptions:requestImageOptions\}\);\s*shouldScrollResponse=true;/);
  assert.match(source,/setPending\(false\);if\(shouldScrollResponse\)scrollResponseIntoView\(\)/);
});

test('AI request failures do not trigger the success auto-scroll',()=>{
  const catchBody=source.match(/\}catch\(error\)\{([\s\S]*?)\}finally\{/)?.[1]||'';
  assert.doesNotMatch(catchBody,/shouldScrollResponse=true/);
});
