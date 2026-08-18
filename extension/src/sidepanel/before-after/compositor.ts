import {imageDrawRect, type DrawRect} from './geometry';
import type {BeforeAfterState, EditablePhoto} from './types';
import {drawWatermark} from './watermark';

export const OUTPUT_SIZE = 1080;
export const HALF_WIDTH = OUTPUT_SIZE / 2;

function drawPhoto(ctx: CanvasRenderingContext2D, photo: EditablePhoto | null, viewport: DrawRect) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
  ctx.clip();
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(viewport.x, viewport.y, viewport.width, viewport.height);
  if (photo) {
    const rect = imageDrawRect({width: photo.image.naturalWidth, height: photo.image.naturalHeight}, viewport, photo.transform);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(photo.image, rect.x, rect.y, rect.width, rect.height);
  }
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(x + 22, 22, 116, 58);
  ctx.fillStyle = '#fff';
  ctx.font = '600 32px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 80, 51);
  ctx.restore();
}

export function renderBeforeAfter(ctx: CanvasRenderingContext2D, state: BeforeAfterState) {
  if (state.layout !== 'horizontal') throw new Error('Unsupported Before/After layout');
  ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  drawPhoto(ctx, state.before, {x: 0, y: 0, width: HALF_WIDTH, height: OUTPUT_SIZE});
  drawPhoto(ctx, state.after, {x: HALF_WIDTH, y: 0, width: HALF_WIDTH, height: OUTPUT_SIZE});
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.fillRect(HALF_WIDTH - 2, 0, 4, OUTPUT_SIZE);
  ctx.restore();
  drawLabel(ctx, 'ДО', 0);
  drawLabel(ctx, 'ПОСЛЕ', HALF_WIDTH);
  drawWatermark(ctx, OUTPUT_SIZE, OUTPUT_SIZE);
}

export function canvasToPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не удалось создать PNG')), 'image/png'));
}
