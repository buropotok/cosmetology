export function createEditor({ $, editor, stage, editImage, wmImage, rotation, opacity, opacityControl, photos, state, geometry, composite, loadImage, onRender }) {
  let editing = null, mode = 'photo', snapshot = null;
  const pointers = new Map(); let gesture = null;
  const point = e => ({ x: e.clientX, y: e.clientY });
  const activeState = () => mode === 'watermark' ? state.watermarkState : photos[editing];

  function transform() {
    const g = Number(stage.dataset.geometryScale || 1);
    if (mode === 'watermark') {
      const p = state.watermarkState;
      wmImage.style.opacity = String(p.opacity);
      wmImage.style.transform = `translate(calc(-50% + ${p.x * g}px),calc(-50% + ${p.y * g}px)) scale(${p.scale * g}) rotate(${p.rotation}deg)`;
      return;
    }
    if (!editing) return;
    const p = photos[editing];
    editImage.style.width = `${p.img.naturalWidth}px`; editImage.style.height = `${p.img.naturalHeight}px`;
    editImage.style.transform = `translate(calc(-50% + ${p.x * g}px),calc(-50% + ${p.y * g}px)) scale(${p.scale * g}) rotate(${p.rotation}deg)`;
  }
  function close() { editor.hidden = true; editing = null; snapshot = null; mode = 'photo'; opacityControl.hidden = true; pointers.clear(); gesture = null; }
  function openPhoto(role) {
    mode = 'photo'; editing = role; opacityControl.hidden = true; wmImage.hidden = true; editImage.hidden = false;
    const p = photos[role], rect = document.querySelector(`[data-slot=${role}]`).getBoundingClientRect();
    snapshot = { ...p }; if (!p.fitted) geometry.fit(p, rect); editor.hidden = false;
    $('editorTitle').textContent = role === 'before' ? 'До' : 'После';
    $('editorHint').textContent = 'Двигайте фото одним пальцем. Масштабируйте двумя.'; editImage.src = p.url;
    requestAnimationFrame(() => { geometry.setEditorGeometry(role); rotation.value = String(p.rotation); $('angle').textContent = `${p.rotation}°`; transform(); });
  }
  async function openWatermark() {
    if (!state.selectedWatermark) return;
    const baseBlob = await composite.blob(), baseUrl = URL.createObjectURL(baseBlob), wm = await loadImage(state.selectedWatermark.url);
    const rect = $('slots').getBoundingClientRect(); mode = 'watermark'; editing = null; snapshot = { ...state.watermarkState };
    editor.hidden = false; opacityControl.hidden = false; $('editorTitle').textContent = 'Водяной знак';
    $('editorHint').textContent = 'Двигайте водяной знак одним пальцем. Масштабируйте двумя.';
    editImage.hidden = false; editImage.src = baseUrl; wmImage.hidden = false; wmImage.src = state.selectedWatermark.url;
    requestAnimationFrame(() => {
      geometry.setEditorGeometryFromRect(rect); const g = Number(stage.dataset.geometryScale || 1);
      editImage.style.width = `${rect.width}px`; editImage.style.height = `${rect.height}px`;
      editImage.style.transform = `translate(-50%,-50%) scale(${g})`; wmImage.style.width = `${wm.naturalWidth}px`; wmImage.style.height = `${wm.naturalHeight}px`;
      if (state.watermarkState.scale === 1) state.watermarkState.scale = Math.min(rect.width * .35 / wm.naturalWidth, rect.height * .35 / wm.naturalHeight);
      rotation.value = String(state.watermarkState.rotation); opacity.value = String(Math.round(state.watermarkState.opacity * 100));
      $('opacityValue').textContent = `${opacity.value}%`; $('angle').textContent = `${state.watermarkState.rotation}°`; transform(); URL.revokeObjectURL(baseUrl);
    });
  }
  function beginGesture() {
    const p = activeState(); if (!p) return; const a = [...pointers.values()], g = Number(stage.dataset.geometryScale || 1);
    if (a.length === 1) gesture = { type: 'pan', start: a[0], x: p.x, y: p.y, g };
    else if (a.length >= 2) gesture = { type: 'pinch', distance: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), scale: p.scale };
  }
  stage.onpointerdown = e => { stage.setPointerCapture(e.pointerId); pointers.set(e.pointerId, point(e)); beginGesture(); };
  stage.onpointermove = e => {
    const p = activeState(); if (!p || !pointers.has(e.pointerId)) return; pointers.set(e.pointerId, point(e)); const a = [...pointers.values()];
    if (a.length === 1) { if (!gesture || gesture.type !== 'pan') beginGesture(); p.x = gesture.x + (a[0].x - gesture.start.x) / gesture.g; p.y = gesture.y + (a[0].y - gesture.start.y) / gesture.g; }
    else if (a.length >= 2) { if (!gesture || gesture.type !== 'pinch') beginGesture(); const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); p.scale = Math.max(.05, Math.min(10, gesture.scale * d / Math.max(1, gesture.distance))); }
    transform();
  };
  const end = e => { pointers.delete(e.pointerId); beginGesture(); state.notify(); };
  stage.onpointerup = end; stage.onpointercancel = end;
  rotation.oninput = () => { const p = activeState(); if (!p) return; p.rotation = Number(rotation.value); $('angle').textContent = `${rotation.value}°`; transform(); state.notify(); };
  opacity.oninput = () => { state.watermarkState.opacity = Number(opacity.value) / 100; $('opacityValue').textContent = `${opacity.value}%`; transform(); state.notify(); };
  $('gridToggle').onclick = () => { const grid = $('grid'); grid.hidden = !grid.hidden; $('gridToggle').textContent = grid.hidden ? 'Показать сетку' : 'Скрыть сетку'; };
  $('editorCancel').onclick = () => {
    if (mode === 'photo' && editing && snapshot) Object.assign(photos[editing], snapshot);
    if (mode === 'watermark' && snapshot) state.watermarkState = { ...snapshot };
    close(); onRender(); return true;
  };
  $('editorSave').onclick = async () => {
    if (mode === 'watermark') await composite.commitWatermark(state.selectedWatermark, state.watermarkState, loadImage);
    close(); onRender(); return true;
  };
  return { openPhoto, openWatermark, close, transform };
}
