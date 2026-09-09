import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const diagnostics=await readFile(new URL('./runtime-diagnostics.js',import.meta.url),'utf8');
const editorRuntime=await readFile(new URL('./composer-editor-runtime.js',import.meta.url),'utf8');

test('runtime diagnostics keeps one session snapshot and sends cumulative events without blocking loads',()=>{
  assert.match(diagnostics,/const ENDPOINT='\/api\/miniapp\/runtime-diagnostics'/);
  assert.match(diagnostics,/const sessionNumber=String\(Date\.now\(\)\)/);
  assert.match(diagnostics,/sessionStartedAt/);
  assert.match(diagnostics,/deviceType/);
  assert.match(diagnostics,/telegramPlatform/);
  assert.match(diagnostics,/telegramVersion/);
  assert.match(diagnostics,/buildId/);
  assert.match(diagnostics,/userAgent/);
  assert.match(diagnostics,/viewport:/);
  assert.match(diagnostics,/keepalive:true/);
  assert.match(diagnostics,/deliveryQueue=deliveryQueue\.catch/);

  const snapshot=diagnostics.slice(diagnostics.indexOf('function snapshot()'),diagnostics.indexOf('async function deliver'));
  assert.doesNotMatch(snapshot,/initData/);
});

test('generic runtime loader records loading, loaded, failed and dependency skips as explicit stages',()=>{
  assert.match(diagnostics,/export async function loadRuntimeModule/);
  assert.match(diagnostics,/status:'loading'/);
  assert.match(diagnostics,/status:'loaded'/);
  assert.match(diagnostics,/status:'failed'/);
  assert.match(diagnostics,/export function skipRuntimeModule/);
  assert.match(diagnostics,/status:'skipped_dependency'/);
  assert.match(diagnostics,/stage:String\(stage\)/);
  assert.match(diagnostics,/module:String\(module\)/);
  assert.match(diagnostics,/durationMs/);
  assert.match(diagnostics,/errorText/);
});

test('editor runtime continues independent work after a bridge failure and skips only true dependents',()=>{
  assert.match(editorRuntime,/const bridge=tiptap\.ok\s*\?await loadRuntimeModule/s);
  assert.match(editorRuntime,/const fixes=tiptap\.ok\s*\?await loadRuntimeModule/s);
  assert.match(editorRuntime,/skipRuntimeModule\(\{stage:STAGE,module:'composer-tiptap-draft-bridge',dependency:'composer-tiptap'\}\)/);
  assert.match(editorRuntime,/skipRuntimeModule\(\{stage:STAGE,module:'composer-tiptap-fixes',dependency:'composer-tiptap'\}\)/);
  assert.match(editorRuntime,/const ok=tiptap\.ok&&bridge\.ok/);
});
