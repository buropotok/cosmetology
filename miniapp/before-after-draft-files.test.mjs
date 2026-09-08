import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function createDraftApi() {
  const before = { name: 'before-old.jpg' }, after = { name: 'after-old.jpg' };
  const storeState = {
    beforeAfterState: { before: { imageIndex: 0 }, after: { imageIndex: 1 } },
    beforeAfterImages: [{ role: 'before', file: before }, { role: 'after', file: after }],
  };
  const store = {
    load: async () => ({}), clear: async () => true, getState: () => storeState,
    scheduleSave() {}, flush: async () => true, cancelRestore() {}, setScreen() {}, setBeforeAfterState() {},
  };
  const window = {
    Telegram: { WebApp: { initData: 'test' } }, CosmoComposerState: {}, CosmoAiWizardState: {},
    CosmoDraftStoreFactory: { create: () => store }, CosmoDiagnosticsFetch: { create: () => () => {} },
    fetch() {}, addEventListener() {},
  };
  const document = { addEventListener() {}, hidden: false };
  vm.runInNewContext(fs.readFileSync(new URL('./drafts.js', import.meta.url), 'utf8'), { window, document, Map, Promise });
  return { api: window.CosmoSofaDraft, before, after };
}

test('BA draft file cache tracks replace, swap and remove without waiting for a full draft reload', async () => {
  const { api, before, after } = createDraftApi();
  await api.whenReady();
  let images = api.getBeforeAfterDraft().images;
  assert.equal(images[0], before);
  assert.equal(images[1], after);

  const replacement = { name: 'before-new.jpg' };
  api.setBeforeAfterImage('before', replacement);
  images = api.getBeforeAfterDraft().images;
  assert.equal(images[0], replacement);
  assert.equal(images[1], after);

  api.swapBeforeAfterImages();
  images = api.getBeforeAfterDraft().images;
  assert.equal(images[0], after);
  assert.equal(images[1], replacement);

  api.setBeforeAfterImage('after', null);
  images = api.getBeforeAfterDraft().images;
  assert.equal(images[0], after);
  assert.equal(images[1], undefined);
});
