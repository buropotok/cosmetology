import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8');
const wizard=read('./publish-ai-wizard.js');
const composerImages=read('./composer-image-generation.js');
const soloAi=read('./before-after/solo-ai.js');

const resultCopy=[
  'Генерация не удалась',
  'Попробовать ещё раз',
  'Отмена',
  'Генерация завершена',
  'Продолжить',
];

test('every AI generation owner shows the required success and failure modal actions',()=>{
  for(const source of [wizard,composerImages,soloAi]){
    for(const text of resultCopy)assert.ok(source.includes(text),`missing ${text}`);
    assert.match(source,/showPopup/);
  }
});

test('AI wizard preserves the previous result, invalidates stale retries and repeats the exact owned request',()=>{
  const start=wizard.indexOf('async function requestAi(');
  const end=wizard.indexOf('  function confirmIdea(',start);
  const body=wizard.slice(start,end);
  assert.match(body,/const requestId=\+\+generationSequence/);
  assert.match(body,/failed=true/);
  assert.doesNotMatch(body,/setResponse\(error/);
  assert.match(body,/requestId!==generationSequence/);
  assert.match(body,/showGenerationResult\(false\)/);
  assert.match(body,/requestAi\(message,mode,requestImageOptions,selectedIdea\)/);
  assert.match(wizard,/function cancelAiMessage\(\)\{generationSequence\+\+/);
});

test('Composer image acquisition reports result after the owned request and does not retry cancellation',()=>{
  assert.match(composerImages,/async function runImageAcquisition\(postText,options,webApp\)/);
  assert.match(composerImages,/await showGenerationResult\(webApp,operation,true\)/);
  assert.match(composerImages,/retry=await showGenerationResult\(webApp,operation,false\)==='retry'/);
  const cancellationStart=composerImages.indexOf('if(isExpectedCancellation(error,operation))');
  const failureStart=composerImages.indexOf("trace(operation,'image.completed','failed'",cancellationStart);
  const cancellationBranch=composerImages.slice(cancellationStart,failureStart);
  assert.match(cancellationBranch,/return/);
  assert.doesNotMatch(cancellationBranch,/showGenerationResult/);
  assert.match(composerImages,/if\(retry&&!operation\.controller\.signal\.aborted\)void runImageAcquisition\(postText,options,webApp\)/);
});

test('Before/After solo AI keeps cancellation distinct and retries the same instruction',()=>{
  assert.match(soloAi,/error\?\.name !== "AbortError"/);
  assert.match(soloAi,/showGenerationResult\(false\)/);
  assert.match(soloAi,/void run\(prompt\)/);
  assert.match(soloAi,/if \(completed\) await showGenerationResult\(true\)/);
  assert.match(soloAi,/operation \+= 1;[\s\S]*if \(controller\) \{[\s\S]*controller\.abort\(\)/);
});
