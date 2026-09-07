import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const service=await readFile(new URL('./services/ai-generation-status.ts',import.meta.url),'utf8');
const ai=await readFile(new URL('./services/miniapp-ai.ts',import.meta.url),'utf8');
const entry=await readFile(new URL('./entry.ts',import.meta.url),'utf8');
const migration=await readFile(new URL('../migrations/0019_ai_generation_status.sql',import.meta.url),'utf8');

test('news generation lifecycle is persisted for the authenticated Mini App user',()=>{
  assert.match(migration,/CREATE TABLE IF NOT EXISTS miniapp_ai_generation_status/);
  assert.match(service,/resolveOrCreateTelegramIdentity/);
  assert.match(ai,/setAiGenerationStatus\(env, userId, kind, 'queued'\)/);
  assert.match(ai,/setAiGenerationStatus\(env, userId, kind, 'running'\)/);
  assert.match(ai,/setAiGenerationStatus\(env, userId, kind, 'succeeded'\)/);
  assert.match(ai,/setAiGenerationStatus\(env, userId, kind, 'failed', 'AI_GENERATION_FAILED'\)/);
});

test('news status is exposed as an authenticated no-store Mini App endpoint',()=>{
  assert.match(entry,/GET' && url\.pathname === '\/api\/miniapp\/news\/status'/);
  assert.match(service,/WHERE user_id=\? AND kind='news'/);
  assert.match(service,/status: 'idle'/);
});
