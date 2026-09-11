import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('./publish-ai-wizard.js',import.meta.url),'utf8');
const css=await readFile(new URL('./publish-ai-wizard.css',import.meta.url),'utf8');

test('AI generation uses a blocking search modal with animated bold dots',()=>{
  assert.match(source,/data-ai-search-modal/);
  assert.match(source,/Ищу материалы<span class="publish-ai-wizard__search-dots"/);
  assert.match(source,/data-ai-search-cancel>Отмена<\/button>/);
  assert.match(source,/dotCount=dotCount%3\+1;searchDots\.textContent='\.'\.repeat\(dotCount\)/);
  assert.match(css,/\.publish-ai-wizard__search-dots\{[^}]*font-weight:800/);
  assert.match(css,/\.publish-ai-wizard__search-modal\{[^}]*position:fixed;inset:0;[^}]*z-index:1000/);
});

test('cancel aborts the active fetch and preserves the previous AI result',()=>{
  const cancelBody=source.match(/function cancelAiMessage\(\)\{([^}]*)\}/)?.[1]||'';
  assert.match(cancelBody,/controller\.abort\(\)/);
  assert.match(cancelBody,/setPending\(false\)/);
  assert.doesNotMatch(cancelBody,/setResponse\(/);
  assert.doesNotMatch(source,/setResponse\('Генерирую ответ…'\)/);
  assert.match(source,/if\(controller\.signal\.aborted\|\|activeController!==controller\)return/);
});

test('the modal cancel button owns cancellation for every requestAi call',()=>{
  const requestAiStart=source.indexOf('async function requestAi(');
  const requestAiEnd=source.indexOf('  function confirmIdea(',requestAiStart);
  const requestAiBody=requestAiStart>=0&&requestAiEnd>requestAiStart?source.slice(requestAiStart,requestAiEnd):'';
  assert.match(source,/searchCancel\?\.addEventListener\('click',event=>\{event\.preventDefault\(\);cancelAiMessage\(\)\}\)/);
  assert.match(requestAiBody,/new AbortController\(\)/);
  assert.match(requestAiBody,/setPending\(true\)/);
  assert.match(requestAiBody,/signal:controller\.signal/);
});
