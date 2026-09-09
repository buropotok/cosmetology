import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeometry } from './before-after/geometry.js';

const geometry = createGeometry({ slots: null, editor: null, stage: null, photos: {} });
const rect = { width: 300, height: 500 };
const makePhoto = rotation => ({
  img: { naturalWidth: 4000, naturalHeight: 3000 },
  x: 42,
  y: -17,
  scale: 2,
  rotation,
  fitted: false,
});

function assertCentered(photo) {
  assert.equal(photo.x, 0);
  assert.equal(photo.y, 0);
  assert.equal(photo.fitted, true);
}

test('fit width, fit height and contain center the image deterministically', () => {
  const widthPhoto = makePhoto(0);
  geometry.fitWidth(widthPhoto, rect);
  assert.equal(widthPhoto.scale, 300 / 4000);
  assertCentered(widthPhoto);

  const heightPhoto = makePhoto(0);
  geometry.fitHeight(heightPhoto, rect);
  assert.equal(heightPhoto.scale, 500 / 3000);
  assertCentered(heightPhoto);

  const containPhoto = makePhoto(0);
  geometry.fitContain(containPhoto, rect);
  assert.equal(containPhoto.scale, Math.min(300 / 4000, 500 / 3000));
  assertCentered(containPhoto);
});

test('Solo fit geometry uses the rotated visual bounds', () => {
  const widthPhoto = makePhoto(90);
  geometry.fitWidth(widthPhoto, rect);
  assert.ok(Math.abs(widthPhoto.scale - 300 / 3000) < 1e-12);
  assertCentered(widthPhoto);

  const heightPhoto = makePhoto(90);
  geometry.fitHeight(heightPhoto, rect);
  assert.ok(Math.abs(heightPhoto.scale - 500 / 4000) < 1e-12);
  assertCentered(heightPhoto);

  const containPhoto = makePhoto(90);
  geometry.fitContain(containPhoto, rect);
  assert.ok(Math.abs(containPhoto.scale - Math.min(300 / 3000, 500 / 4000)) < 1e-12);
  assertCentered(containPhoto);
});
