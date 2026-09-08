import { createBeforeAfterState } from './before-after/state.js';
import { createGeometry } from './before-after/geometry.js';
import { createComposite } from './before-after/composite.js';
import { createEditor } from './before-after/editor.js';
import { createWatermarks } from './before-after/watermarks.js';

const $ = id => document.getElementById(id);
const slots = $('slots'), file = $('file'), editorElement = $('editor'), stage = $('stage'), editImage = $('editImage'), wmImage = $('watermarkImage');
const rotation = $('rotation'), opacity = $('opacity'), opacityControl = $('opacityControl'), compositeResult = $('compositeResult'), cropHandle = $('cropHandle');
const wmFile = $('watermarkFile'), wmCarousel = $('watermarkCarousel'), webApp = window.Telegram?.WebApp;
const authHeaders = () => webApp?.initData ? { Authorization: `tma ${webApp.initData}` } : {};
const loadImage = src => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; });
const showError = message => { $('error').textContent = message || ''; };
const transformFor = photo => `translate(calc(-50% + ${photo.x}px),calc(-50% + ${photo.y}px)) scale(${photo.scale}) rotate(${photo.rotation}deg)`;

const state = createBeforeAfterState({ loadImage, onChange: () => window.dispatchEvent(new CustomEvent('cosmo-before-after-change')) });
const geometry = createGeometry({ slots, editor: editorElement, stage, photos: state.photos });
const composite = createComposite({ slots, photos: state.photos, compositeResult, cropHandle, notify: state.notify });
let editor;
const watermarks = createWatermarks({ $, carousel: wmCarousel, fileInput: wmFile, state, getEditor: () => editor, composite, authHeaders, loadImage, showError });
editor = createEditor({ $, editor: editorElement, stage, editImage, wmImage, rotation, opacity, opacityControl, photos: state.photos, state, geometry, composite, loadImage, onRender: render });

function render() {
  slots.dataset.layout = state.layout;
  document.querySelectorAll('[data-layout]').forEach(button => button.classList.toggle('selected', button.dataset.layout === state.layout));
  document.querySelectorAll('[data-ratio]').forEach(button => button.classList.toggle('selected', button.dataset.ratio === state.selectedRatio));
  for (const role of ['before', 'after']) {
    const element = document.querySelector(`[data-slot=${role}]`), image = element.querySelector('img'), photo = state.photos[role];
    element.classList.toggle('loaded', !!photo);
    if (photo) { image.src = photo.url; image.style.width = `${photo.img.naturalWidth}px`; image.style.height = `${photo.img.naturalHeight}px`; image.style.transform = transformFor(photo); }
  }
  $('finish').disabled = !(state.photos.before || state.photos.after);
  state.notify();
}
function applyRatio(value) {
  state.selectedRatio = value; state.cropHeight = null; slots.style.height = ''; slots.style.aspectRatio = value; composite.clearCommitted();
  requestAnimationFrame(() => { geometry.refitForComposite(); render(); });
}
function restoreLayoutStyles() {
  if (state.selectedRatio === 'custom' && state.cropHeight) { slots.style.aspectRatio = 'auto'; slots.style.height = `${state.cropHeight}px`; }
  else { slots.style.height = ''; slots.style.aspectRatio = state.selectedRatio; }
}

document.querySelectorAll('[data-ratio]').forEach(button => button.onclick = () => applyRatio(button.dataset.ratio));
document.querySelectorAll('[data-layout]').forEach(button => button.onclick = () => { state.layout = button.dataset.layout; slots.dataset.layout = state.layout; applyRatio(state.selectedRatio); });
let pending = 'before';
file.onchange = () => {
  const selected = file.files?.[0]; file.value = ''; if (!selected) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) return showError('Поддерживаются JPEG, PNG и WebP.');
  const url = URL.createObjectURL(selected), image = new Image();
  image.onload = () => {
    if (state.photos[pending]) URL.revokeObjectURL(state.photos[pending].url);
    state.photos[pending] = { file: selected, url, img: image, x: 0, y: 0, scale: 1, rotation: 0, fitted: false };
    composite.clearCommitted(); render(); editor.openPhoto(pending);
  };
  image.src = url;
};
$('swap').onclick = () => { [state.photos.before, state.photos.after] = [state.photos.after, state.photos.before]; composite.clearCommitted(); render(); };

const previewPointers = new Map(); let previewGesture = null, previewSlot = null, previewMoved = false, previewStarted = 0;
const point = e => ({ x: e.clientX, y: e.clientY });
function previewBegin(role) {
  const photo = state.photos[role]; if (!photo) return; const points = [...previewPointers.values()];
  if (points.length === 1) previewGesture = { type: 'pan', start: points[0], x: photo.x, y: photo.y, scale: photo.scale };
  else if (points.length >= 2) previewGesture = { type: 'pinch', distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), scale: photo.scale };
}
document.querySelectorAll('[data-slot]').forEach(element => {
  element.onclick = null;
  element.onpointerdown = event => {
    if (event.button != null && event.button !== 0) return; const role = element.dataset.slot;
    if (!state.photos[role]) { pending = role; file.click(); return; }
    event.preventDefault(); element.setPointerCapture?.(event.pointerId); previewSlot = role; previewStarted = performance.now(); previewMoved = false;
    previewPointers.set(event.pointerId, point(event)); previewBegin(role);
  };
  element.onpointermove = event => {
    const role = previewSlot, photo = state.photos[role]; if (!photo || !previewPointers.has(event.pointerId)) return;
    event.preventDefault(); previewPointers.set(event.pointerId, point(event)); const points = [...previewPointers.values()];
    if (points.length === 1) {
      if (!previewGesture || previewGesture.type !== 'pan') previewBegin(role);
      const dx = points[0].x - previewGesture.start.x, dy = points[0].y - previewGesture.start.y; if (Math.hypot(dx, dy) > 5) previewMoved = true;
      photo.x = previewGesture.x + dx; photo.y = previewGesture.y + dy;
    } else if (points.length >= 2) {
      previewMoved = true; if (!previewGesture || previewGesture.type !== 'pinch') previewBegin(role);
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      photo.scale = Math.max(.05, Math.min(10, previewGesture.scale * distance / Math.max(1, previewGesture.distance)));
    }
    composite.clearCommitted(); render();
  };
  const end = event => {
    const role = previewSlot; previewPointers.delete(event.pointerId);
    if (previewPointers.size) { previewBegin(role); return; }
    const tap = !previewMoved && performance.now() - previewStarted < 350; previewGesture = null; previewSlot = null; state.notify();
    if (tap && role && state.photos[role]) editor.openPhoto(role);
  };
  element.onpointerup = end; element.onpointercancel = event => { previewPointers.delete(event.pointerId); previewGesture = null; previewSlot = null; };
});

let cropGesture = null;
cropHandle.onpointerdown = event => { event.preventDefault(); event.stopPropagation(); cropGesture = { startY: event.clientY, startHeight: slots.getBoundingClientRect().height }; cropHandle.setPointerCapture?.(event.pointerId); };
cropHandle.onpointermove = event => {
  if (!cropGesture) return; event.preventDefault(); const width = slots.getBoundingClientRect().width, minHeight = width / (16 / 9), maxHeight = Math.max(minHeight, window.innerHeight - 120);
  const next = Math.max(minHeight, Math.min(maxHeight, cropGesture.startHeight + event.clientY - cropGesture.startY));
  state.cropHeight = next; state.selectedRatio = 'custom'; slots.style.height = `${next}px`; slots.style.aspectRatio = 'auto'; composite.clearCommitted();
  requestAnimationFrame(() => { geometry.refitForComposite(); render(); });
};
cropHandle.onpointerup = cropHandle.onpointercancel = event => { cropGesture = null; cropHandle.releasePointerCapture?.(event.pointerId); state.notify(); };

window.cosmoBeforeAfterCompositeBlob = () => composite.publicBlob();
window.CosmoBeforeAfterState = Object.freeze({
  getDraftSnapshot: () => state.snapshot(),
  restoreDraft: async (saved, files = []) => { await state.restore(saved, files, watermarks.find); restoreLayoutStyles(); composite.clearCommitted(); render(); },
});
function returnToPublisher() { try { sessionStorage.setItem('cosmo-return-screen', 'composer'); } catch {} location.href = '/'; }
$('back').onclick = returnToPublisher; $('finish').onclick = returnToPublisher;
window.addEventListener('beforeunload', () => {
  for (const role of ['before', 'after']) if (state.photos[role]) URL.revokeObjectURL(state.photos[role].url);
  wmCarousel.querySelectorAll('[data-url]').forEach(button => URL.revokeObjectURL(button.dataset.url));
  if (compositeResult.dataset.url) URL.revokeObjectURL(compositeResult.dataset.url);
});
applyRatio(state.selectedRatio);
watermarks.load();
