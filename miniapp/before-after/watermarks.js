export function createWatermarks({ $, carousel, fileInput, state, getEditor, composite, authHeaders, loadImage, showError }) {
  async function fetchBlob(id) {
    const response = await fetch(`/api/miniapp/watermarks/${encodeURIComponent(id)}`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Не удалось загрузить водяной знак');
    return response.blob();
  }
  async function append(wm) {
    if (carousel.querySelector(`[data-watermark="${CSS.escape(wm.id)}"]`)) return;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'watermark-item'; button.dataset.watermark = wm.id;
    const blob = await fetchBlob(wm.id), url = URL.createObjectURL(blob); button.dataset.url = url;
    button.innerHTML = '<img alt=""><span hidden></span>'; button.querySelector('img').src = url; button.onclick = () => select(button); carousel.append(button);
  }
  async function select(button) {
    carousel.querySelectorAll('.watermark-item').forEach(x => x.classList.toggle('selected', x === button));
    if (button.dataset.watermark === 'none') { state.selectedWatermark = null; composite.clearCommitted(); state.notify(); return; }
    state.selectedWatermark = { id: button.dataset.watermark, url: button.dataset.url };
    state.watermarkState = { x: 0, y: 0, scale: 1, rotation: 0, opacity: .2 };
    await getEditor().openWatermark();
  }
  async function processed(file) {
    const src = URL.createObjectURL(file);
    try {
      const img = await loadImage(src), max = 1200, scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d'); ctx.filter = 'grayscale(1)'; ctx.globalAlpha = 1; ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return new Promise(resolve => canvas.toBlob(blob => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.png'), { type: 'image/png' })), 'image/png'));
    } finally { URL.revokeObjectURL(src); }
  }
  async function load() {
    if (!window.Telegram?.WebApp?.initData) return;
    try {
      const response = await fetch('/api/miniapp/watermarks', { headers: authHeaders() }), data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || 'Не удалось загрузить водяные знаки');
      for (const wm of data.watermarks || []) await append(wm);
    } catch (error) { showError(error.message); }
  }
  function find(id) {
    const button = carousel.querySelector(`[data-watermark="${CSS.escape(id)}"]`);
    return button ? { id: button.dataset.watermark, url: button.dataset.url } : null;
  }
  carousel.querySelector('[data-watermark="none"]').onclick = () => select(carousel.querySelector('[data-watermark="none"]'));
  $('addWatermark').onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const file = fileInput.files?.[0]; fileInput.value = ''; if (!file) return;
    try {
      $('addWatermark').disabled = true; const image = await processed(file), body = new FormData(); body.set('image', image);
      const response = await fetch('/api/miniapp/watermarks', { method: 'POST', headers: authHeaders(), body }), wm = await response.json();
      if (!response.ok) throw new Error(wm?.error?.message || 'Не удалось сохранить водяной знак');
      await append(wm); await select(carousel.querySelector(`[data-watermark="${CSS.escape(wm.id)}"]`));
    } catch (error) { showError(error.message); } finally { $('addWatermark').disabled = false; }
  };
  return { load, find };
}
