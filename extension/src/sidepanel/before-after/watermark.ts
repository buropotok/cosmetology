export const WATERMARK_TEXT = 'Galina Galina';

export function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-25 * Math.PI / 180);
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#fff';
  ctx.font = `600 ${Math.round(width * 0.105)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(WATERMARK_TEXT, 0, 0);
  ctx.restore();
}
