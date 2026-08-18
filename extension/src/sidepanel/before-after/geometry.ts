import type {CropTransform} from './types';

export interface Size {width: number; height: number}
export interface DrawRect {x: number; y: number; width: number; height: number}

export function coverScale(source: Size, viewport: Size) {
  return Math.max(viewport.width / source.width, viewport.height / source.height);
}

export function clampTransform(transform: CropTransform): CropTransform {
  return {
    zoom: Math.min(4, Math.max(1, transform.zoom)),
    offsetX: Math.min(1, Math.max(-1, transform.offsetX)),
    offsetY: Math.min(1, Math.max(-1, transform.offsetY))
  };
}

export function imageDrawRect(source: Size, viewport: DrawRect, transform: CropTransform): DrawRect {
  const safe = clampTransform(transform);
  const scale = coverScale(source, viewport) * safe.zoom;
  const width = source.width * scale;
  const height = source.height * scale;
  const overflowX = Math.max(0, (width - viewport.width) / 2);
  const overflowY = Math.max(0, (height - viewport.height) / 2);
  return {
    x: viewport.x + (viewport.width - width) / 2 + safe.offsetX * overflowX,
    y: viewport.y + (viewport.height - height) / 2 + safe.offsetY * overflowY,
    width,
    height
  };
}

export function panTransform(transform: CropTransform, deltaX: number, deltaY: number, source: Size, viewport: Size): CropTransform {
  const safe = clampTransform(transform);
  const scale = coverScale(source, viewport) * safe.zoom;
  const overflowX = Math.max(0, (source.width * scale - viewport.width) / 2);
  const overflowY = Math.max(0, (source.height * scale - viewport.height) / 2);
  return clampTransform({
    ...safe,
    offsetX: overflowX ? safe.offsetX + deltaX / overflowX : 0,
    offsetY: overflowY ? safe.offsetY + deltaY / overflowY : 0
  });
}
