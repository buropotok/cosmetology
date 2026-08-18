import {describe, expect, it} from 'vitest';
import {clampTransform, coverScale, imageDrawRect, panTransform} from './geometry';
import {isAcceptedImage, swapPhotos, type BeforeAfterState, type EditablePhoto} from './types';

function photo(name: string, zoom: number): EditablePhoto {
  return {file: {name} as File, image: {} as HTMLImageElement, objectUrl: name, transform: {zoom, offsetX: 0, offsetY: 0}};
}

describe('Before/After crop geometry', () => {
  it('calculates minimum cover and initializes a centered crop', () => {
    expect(coverScale({width: 1000, height: 500}, {width: 540, height: 1080})).toBe(2.16);
    expect(imageDrawRect({width: 500, height: 1000}, {x: 0, y: 0, width: 540, height: 1080}, {zoom: 1, offsetX: 0, offsetY: 0}))
      .toEqual({x: 0, y: 0, width: 540, height: 1080});
  });

  it('clamps zoom and pan so no empty area can be exposed', () => {
    expect(clampTransform({zoom: 0, offsetX: 4, offsetY: -3})).toEqual({zoom: 1, offsetX: 1, offsetY: -1});
    const moved = panTransform({zoom: 2, offsetX: 0, offsetY: 0}, 10000, -10000,
      {width: 1000, height: 1000}, {width: 540, height: 1080});
    expect(moved).toEqual({zoom: 2, offsetX: 1, offsetY: -1});
    const rect = imageDrawRect({width: 1000, height: 1000}, {x: 0, y: 0, width: 540, height: 1080}, moved);
    expect(rect.x).toBeLessThanOrEqual(0);
    expect(rect.x + rect.width).toBeGreaterThanOrEqual(540);
    expect(rect.y).toBeLessThanOrEqual(0);
    expect(rect.y + rect.height).toBeGreaterThanOrEqual(1080);
  });

  it('keeps transforms independent and swaps complete photo states', () => {
    const before = photo('before.jpg', 1.25);
    const after = photo('after.png', 2.5);
    const state: BeforeAfterState = {layout: 'horizontal', before, after};
    before.transform.offsetX = .4;
    expect(after.transform.offsetX).toBe(0);
    swapPhotos(state);
    expect(state.before).toBe(after);
    expect(state.after).toBe(before);
    expect(state.after?.transform.offsetX).toBe(.4);
  });

  it('accepts JPEG, PNG and WebP but rejects unsupported files', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) expect(isAcceptedImage({type})).toBe(true);
    expect(isAcceptedImage({type: 'image/gif'})).toBe(false);
    expect(isAcceptedImage({type: 'text/plain'})).toBe(false);
  });
});
