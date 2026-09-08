import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGeometry } from './before-after/geometry.js';
import { createResize } from './before-after/resize.js';

class FakeTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    this.listeners.set(type, listeners.filter(value => value !== listener));
  }
  emit(type, event) {
    for (const listener of [...(this.listeners.get(type) || [])]) listener(event);
  }
  contains(target) { return target === this; }
  count(type) { return (this.listeners.get(type) || []).length; }
}

const pointerEvent = values => ({
  button: 0,
  cancelable: true,
  preventDefault() {},
  stopPropagation() {},
  ...values,
});

test('viewport anchor rebasing keeps the photo at the same screen position when crop height changes', () => {
  const previousDocument = globalThis.document;
  const rects = { before: { left: 0, top: 0, width: 400, height: 400 } };
  const beforeSlot = { getBoundingClientRect: () => rects.before };
  globalThis.document = {
    querySelector(selector) {
      if (selector === '[data-slot=before]') return beforeSlot;
      if (selector === '[data-slot=after]') return null;
      return null;
    },
  };
  try {
    const photo = { x: 12, y: -7 };
    const geometry = createGeometry({ slots: {}, editor: {}, stage: {}, photos: { before: photo, after: null } });
    const anchors = geometry.captureViewportAnchors();
    const oldScreenCenter = { x: 200 + photo.x, y: 200 + photo.y };

    rects.before = { left: 0, top: 0, width: 400, height: 200 };
    geometry.preserveViewportAnchors(anchors);

    assert.equal(photo.x, 12);
    assert.equal(photo.y, 93);
    assert.deepEqual({ x: 200 + photo.x, y: 100 + photo.y }, oldScreenCenter);
  } finally {
    globalThis.document = previousDocument;
  }
});

test('a new tap outside the crop handle cancels a stale resize session before pointerup can resize again', () => {
  const previousWindow = globalThis.window;
  const previousRaf = globalThis.requestAnimationFrame;
  const previousCancelRaf = globalThis.cancelAnimationFrame;
  const fakeWindow = new FakeTarget();
  fakeWindow.innerHeight = 900;
  globalThis.window = fakeWindow;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};

  let height = 300;
  const style = { aspectRatio: '' };
  Object.defineProperty(style, 'height', {
    get: () => `${height}px`,
    set: value => { height = Number.parseFloat(value); },
  });
  const handle = new FakeTarget();
  const slots = { style, getBoundingClientRect: () => ({ width: 400, height }) };
  const state = { cropHeight: null, selectedRatio: '16/9' };
  let captures = 0, preserves = 0;
  const geometry = {
    captureViewportAnchors() { captures += 1; return { before: { x: 200, y: height / 2 } }; },
    preserveViewportAnchors() { preserves += 1; },
  };
  const composite = { clearCommitted() {} };

  try {
    const resize = createResize({ handle, slots, state, geometry, composite, onRender() {} });
    handle.emit('pointerdown', pointerEvent({ pointerId: 1, clientY: 200, target: handle }));
    fakeWindow.emit('pointermove', pointerEvent({ pointerId: 1, clientY: 250, target: handle }));
    assert.equal(height, 350);
    assert.equal(state.cropHeight, 350);
    assert.equal(captures, 1);
    assert.equal(preserves, 1);
    assert.equal(fakeWindow.count('pointerup'), 1);

    const photo = {};
    fakeWindow.emit('pointerdown', pointerEvent({ pointerId: 1, clientY: 120, target: photo }));
    assert.equal(fakeWindow.count('pointerup'), 0);
    fakeWindow.emit('pointerup', pointerEvent({ pointerId: 1, clientY: 20, target: photo }));

    assert.equal(height, 350);
    assert.equal(state.cropHeight, 350);
    resize.destroy();
  } finally {
    globalThis.window = previousWindow;
    globalThis.requestAnimationFrame = previousRaf;
    globalThis.cancelAnimationFrame = previousCancelRaf;
  }
});

test('pointerup only ends crop resize and never reapplies its release coordinate', () => {
  const previousWindow = globalThis.window;
  const previousRaf = globalThis.requestAnimationFrame;
  const previousCancelRaf = globalThis.cancelAnimationFrame;
  const fakeWindow = new FakeTarget();
  fakeWindow.innerHeight = 900;
  globalThis.window = fakeWindow;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};

  let height = 300;
  const style = { aspectRatio: '' };
  Object.defineProperty(style, 'height', {
    get: () => `${height}px`,
    set: value => { height = Number.parseFloat(value); },
  });
  const handle = new FakeTarget();
  const slots = { style, getBoundingClientRect: () => ({ width: 400, height }) };
  const state = { cropHeight: null, selectedRatio: '16/9' };
  let captures = 0, preserves = 0;
  const geometry = {
    captureViewportAnchors() { captures += 1; return { before: { x: 200, y: height / 2 } }; },
    preserveViewportAnchors() { preserves += 1; },
  };
  const composite = { clearCommitted() {} };

  try {
    const resize = createResize({ handle, slots, state, geometry, composite, onRender() {} });
    handle.emit('pointerdown', pointerEvent({ pointerId: 7, clientY: 200, target: handle }));
    fakeWindow.emit('pointermove', pointerEvent({ pointerId: 7, clientY: 250, target: handle }));
    assert.equal(height, 350);
    assert.equal(state.cropHeight, 350);
    assert.equal(captures, 1);
    assert.equal(preserves, 1);

    fakeWindow.emit('pointerup', pointerEvent({ pointerId: 7, clientY: -500, target: handle }));

    assert.equal(height, 350);
    assert.equal(state.cropHeight, 350);
    assert.equal(captures, 1);
    assert.equal(preserves, 1);
    assert.equal(fakeWindow.count('pointermove'), 0);
    assert.equal(fakeWindow.count('touchend'), 0);
    resize.destroy();
  } finally {
    globalThis.window = previousWindow;
    globalThis.requestAnimationFrame = previousRaf;
    globalThis.cancelAnimationFrame = previousCancelRaf;
  }
});

test('touchend is a WebKit fallback that only cleans up an active resize', () => {
  const previousWindow = globalThis.window;
  const previousRaf = globalThis.requestAnimationFrame;
  const previousCancelRaf = globalThis.cancelAnimationFrame;
  const fakeWindow = new FakeTarget();
  fakeWindow.innerHeight = 900;
  globalThis.window = fakeWindow;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};

  let height = 300;
  const style = { aspectRatio: '' };
  Object.defineProperty(style, 'height', {
    get: () => `${height}px`,
    set: value => { height = Number.parseFloat(value); },
  });
  const handle = new FakeTarget();
  const slots = { style, getBoundingClientRect: () => ({ width: 400, height }) };
  const state = { cropHeight: null, selectedRatio: '16/9' };
  const geometry = {
    captureViewportAnchors() { return { before: { x: 200, y: height / 2 } }; },
    preserveViewportAnchors() {},
  };
  const composite = { clearCommitted() {} };

  try {
    const resize = createResize({ handle, slots, state, geometry, composite, onRender() {} });
    handle.emit('pointerdown', pointerEvent({ pointerId: 3, clientY: 200, target: handle }));
    fakeWindow.emit('pointermove', pointerEvent({ pointerId: 3, clientY: 240, target: handle }));
    assert.equal(height, 340);
    assert.equal(fakeWindow.count('pointermove'), 1);
    assert.equal(fakeWindow.count('touchend'), 1);

    fakeWindow.emit('touchend', { target: handle });
    fakeWindow.emit('pointermove', pointerEvent({ pointerId: 3, clientY: 20, target: handle }));

    assert.equal(height, 340);
    assert.equal(state.cropHeight, 340);
    assert.equal(fakeWindow.count('pointermove'), 0);
    resize.destroy();
  } finally {
    globalThis.window = previousWindow;
    globalThis.requestAnimationFrame = previousRaf;
    globalThis.cancelAnimationFrame = previousCancelRaf;
  }
});

test('ratio presets preserve viewport anchors instead of refitting the photo', async () => {
  const source = await readFile(new URL('./before-after.js', import.meta.url), 'utf8');
  const start = source.indexOf('function applyRatio(value)');
  const end = source.indexOf('function restoreLayoutStyles()', start);
  assert.ok(start >= 0 && end > start);
  const body = source.slice(start, end);
  assert.match(body, /geometry\.captureViewportAnchors\(\)/);
  assert.match(body, /geometry\.preserveViewportAnchors\(anchors\)/);
  assert.doesNotMatch(body, /refitForComposite/);
});
