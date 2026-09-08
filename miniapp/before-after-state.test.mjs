import test from 'node:test';
import assert from 'node:assert/strict';
import { createBeforeAfterState } from './before-after/state.js';

const savedPhoto = imageIndex => ({ imageIndex, x: 4, y: 5, scale: .8, rotation: 2, fitted: true });
const savedState = before => ({
  version: 1,
  layout: 'horizontal',
  ratio: '16/9',
  cropHeight: null,
  before,
  after: null,
  watermark: null,
  watermarkState: { x: 0, y: 0, scale: 1, rotation: 0, opacity: .2 },
});

test('failed restore with a missing referenced file preserves the current photo', async () => {
  const state = createBeforeAfterState({ loadImage: async () => ({ naturalWidth: 100, naturalHeight: 100 }) });
  const file = new Blob(['before'], { type: 'image/jpeg' });
  await state.restore(savedState(savedPhoto(0)), [file]);
  const current = state.photos.before;

  await assert.rejects(state.restore(savedState(savedPhoto(0)), []), /Missing before image/);
  assert.equal(state.photos.before, current);
  assert.equal(state.photos.before.file, file);

  URL.revokeObjectURL(state.photos.before.url);
});

test('explicit null role is allowed to remove a restored photo', async () => {
  const state = createBeforeAfterState({ loadImage: async () => ({ naturalWidth: 100, naturalHeight: 100 }) });
  const file = new Blob(['before'], { type: 'image/jpeg' });
  await state.restore(savedState(savedPhoto(0)), [file]);
  await state.restore(savedState(null), []);
  assert.equal(state.photos.before, null);
});
