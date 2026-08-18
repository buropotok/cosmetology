import {describe, expect, it, vi} from 'vitest';
import {canvasToPng, HALF_HEIGHT, HALF_WIDTH, OUTPUT_SIZE, renderBeforeAfter} from './compositor';
import {WATERMARK_TEXT} from './watermark';
import type {BeforeAfterState, EditablePhoto} from './types';

function context() {
  return {
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), fillText: vi.fn(), clearRect: vi.fn(),
    beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn(),
    fillStyle: '', font: '', textAlign: '', textBaseline: '', globalAlpha: 1,
    imageSmoothingEnabled: false, imageSmoothingQuality: 'low'
  } as unknown as CanvasRenderingContext2D;
}

function photo(width: number, height: number): EditablePhoto {
  return {file: {} as File, image: {naturalWidth: width, naturalHeight: height} as HTMLImageElement, objectUrl: '', transform: {zoom: 1, offsetX: 0, offsetY: 0}};
}

describe('Before/After compositor', () => {
  it('renders undistorted left/right crops, divider, labels and one diagonal watermark', () => {
    const ctx = context();
    const state: BeforeAfterState = {layout: 'horizontal', before: photo(1200, 800), after: photo(800, 1200)};
    renderBeforeAfter(ctx, state);

    expect(OUTPUT_SIZE).toBe(1080);
    expect(HALF_WIDTH).toBe(540);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 1080, 1080);
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    const beforeDraw = vi.mocked(ctx.drawImage).mock.calls[0];
    const afterDraw = vi.mocked(ctx.drawImage).mock.calls[1];
    expect(Number(beforeDraw[3]) / Number(beforeDraw[4])).toBeCloseTo(1200 / 800);
    expect(Number(afterDraw[3]) / Number(afterDraw[4])).toBeCloseTo(800 / 1200);
    expect(vi.mocked(ctx.fillText).mock.calls.map(call => call[0])).toEqual(['ДО', 'ПОСЛЕ', WATERMARK_TEXT]);
    expect(ctx.rotate).toHaveBeenCalledTimes(1);
    expect(ctx.rotate).toHaveBeenCalledWith(-25 * Math.PI / 180);
    expect(ctx.fillRect).toHaveBeenCalledWith(538, 0, 4, 1080);
  });

  it('exports a PNG Blob', async () => {
    const blob = new Blob(['png'], {type: 'image/png'});
    const canvas = {toBlob: (callback: BlobCallback, type?: string) => { expect(type).toBe('image/png'); callback(blob); }} as HTMLCanvasElement;
    await expect(canvasToPng(canvas)).resolves.toBe(blob);
  });

  it('renders BEFORE above AFTER in the vertical layout', () => {
    const ctx = context();
    renderBeforeAfter(ctx, {layout: 'vertical', before: photo(1200, 800), after: photo(800, 1200)});

    expect(HALF_HEIGHT).toBe(540);
    expect(ctx.rect).toHaveBeenNthCalledWith(1, 0, 0, 1080, 540);
    expect(ctx.rect).toHaveBeenNthCalledWith(2, 0, 540, 1080, 540);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 538, 1080, 4);
    expect(vi.mocked(ctx.fillText).mock.calls.map(call => call[0])).toEqual(['ДО', 'ПОСЛЕ', WATERMARK_TEXT]);
  });
});
