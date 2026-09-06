import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const doc=await readFile(new URL('../docs/ai-post-generation-flow.md',import.meta.url),'utf8');

test('AI post generation UX contract preserves selected idea and retry flow',()=>{
  for(const phrase of [
    'selectedIdea',
    'generation_error',
    'Попробовать ещё раз',
    'Discovery is not repeated',
    'Редактировать и опубликовать',
    'Composer receives the canonical PostDocument directly'
  ]) assert.ok(doc.includes(phrase),`missing documented UX invariant: ${phrase}`);
});
