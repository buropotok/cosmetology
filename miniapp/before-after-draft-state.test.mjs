import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('Before/After draft is a real third state with editable payload', () => {
  const migration = fs.readFileSync(new URL('../worker/migrations/0018_before_after_draft_state.sql', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../worker/src/services/miniapp-drafts.ts', import.meta.url), 'utf8');
  const draftStore = read('./draft-store.js');
  const beforeAfter = read('./before-after.js');
  const bridge = read('./before-after-bridge.js');
  const controller = read('./before-after-controller.js');

  assert.match(migration, /before_after_state/);
  assert.match(service, /before_after_state AS beforeAfterStateJson/);
  assert.match(service, /beforeAfterState/);
  assert.match(draftStore, /beforeAfterState=draft\.beforeAfterState/);
  assert.match(draftStore, /setBeforeAfterState/);
  assert.match(beforeAfter, /getDraftSnapshot/);
  assert.match(beforeAfter, /restoreDraft/);
  assert.match(beforeAfter, /imageIndex/);
  assert.match(bridge, /cosmo-before-after-change/);
  assert.match(bridge, /saveOverlay/);
  assert.match(bridge, /saveStage/);
  assert.doesNotMatch(bridge, /saveLoader/);
  assert.match(controller, /saveDraft/);
  assert.match(controller, /restoreIntoFrame/);
  assert.match(controller, /setScreen\?\.\('publish'\)/);
});
