export function createComposite({ slots, photos, compositeResult, cropHandle, notify, getWatermark, loadImage }) {
  function drawPhoto(ctx, photo, rect, scale) {
    if (!photo) return;
    ctx.save(); ctx.beginPath();
    ctx.rect(rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale); ctx.clip();
    ctx.translate((rect.x + rect.width / 2 + photo.x) * scale, (rect.y + rect.height / 2 + photo.y) * scale);
    ctx.rotate(photo.rotation * Math.PI / 180); ctx.scale(photo.scale * scale, photo.scale * scale);
    ctx.drawImage(photo.img, -photo.img.naturalWidth / 2, -photo.img.naturalHeight / 2); ctx.restore();
  }
  function baseCanvas() {
    const sr = slots.getBoundingClientRect();
    const k = Math.min(3, Math.max(1, 1080 / sr.width));
    const c = document.createElement('canvas'); c.width = Math.round(sr.width * k); c.height = Math.round(sr.height * k);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
    for (const role of ['before', 'after']) {
      const r = document.querySelector(`[data-slot=${role}]`).getBoundingClientRect();
      drawPhoto(ctx, photos[role], { x: r.left - sr.left, y: r.top - sr.top, width: r.width, height: r.height }, k);
    }
    return { c, ctx, sr, k };
  }
  async function canvasBlob(c) {
    return new Promise(resolve => c.toBlob(resolve, 'image/jpeg', .94));
  }
  async function photoBlob() {
    const { c } = baseCanvas();
    return canvasBlob(c);
  }
  async function blob() {
    const { c, ctx, sr, k } = baseCanvas(), current = getWatermark?.() || {}, selectedWatermark = current.selectedWatermark, watermarkState = current.watermarkState;
    if (selectedWatermark && watermarkState) {
      const wm = await loadImage(selectedWatermark.url), p = watermarkState;
      ctx.save(); ctx.globalAlpha = p.opacity;
      ctx.translate((sr.width / 2 + p.x) * k, (sr.height / 2 + p.y) * k);
      ctx.rotate(p.rotation * Math.PI / 180); ctx.scale(p.scale * k, p.scale * k);
      ctx.drawImage(wm, -wm.naturalWidth / 2, -wm.naturalHeight / 2); ctx.restore();
    }
    return canvasBlob(c);
  }
  function clearCommitted() {
    if (compositeResult.dataset.url) { URL.revokeObjectURL(compositeResult.dataset.url); delete compositeResult.dataset.url; }
    compositeResult.hidden = true;
  }
  async function commitWatermark() {
    clearCommitted();
    notify();
  }
  async function publicBlob() {
    return blob();
  }
  return { baseCanvas, photoBlob, blob, clearCommitted, commitWatermark, publicBlob };
}
