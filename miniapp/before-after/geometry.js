export function createGeometry({ slots, editor, stage, photos }) {
  function setEditorGeometryFromRect(rect) {
    const controls = document.querySelector('.editor-controls').getBoundingClientRect().height;
    const available = editor.clientHeight - 58 - controls;
    const scale = Math.min(window.innerWidth / rect.width, Math.max(1, available) / rect.height);
    stage.style.width = `${rect.width * scale}px`;
    stage.style.height = `${rect.height * scale}px`;
    stage.dataset.geometryScale = String(scale);
  }
  const setEditorGeometry = role => setEditorGeometryFromRect(document.querySelector(`[data-slot=${role}]`).getBoundingClientRect());
  function fit(photo, rect) {
    photo.scale = Math.max(rect.width / photo.img.naturalWidth, rect.height / photo.img.naturalHeight);
    photo.x = photo.y = 0;
    photo.fitted = true;
  }
  function refitForComposite() {
    for (const role of ['before', 'after']) {
      const photo = photos[role];
      const slot = document.querySelector(`[data-slot=${role}]`);
      if (!photo || !slot) continue;
      const rect = slot.getBoundingClientRect();
      const min = Math.max(rect.width / photo.img.naturalWidth, rect.height / photo.img.naturalHeight);
      if (photo.scale < min) photo.scale = min;
    }
  }
  function captureViewportAnchors() {
    const anchors = {};
    for (const role of ['before', 'after']) {
      if (!photos[role]) continue;
      const slot = document.querySelector(`[data-slot=${role}]`);
      if (!slot) continue;
      const rect = slot.getBoundingClientRect();
      anchors[role] = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return anchors;
  }
  function preserveViewportAnchors(anchors) {
    for (const role of ['before', 'after']) {
      const photo = photos[role], anchor = anchors?.[role];
      if (!photo || !anchor) continue;
      const slot = document.querySelector(`[data-slot=${role}]`);
      if (!slot) continue;
      const rect = slot.getBoundingClientRect();
      photo.x += anchor.x - (rect.left + rect.width / 2);
      photo.y += anchor.y - (rect.top + rect.height / 2);
    }
  }
  return { setEditorGeometryFromRect, setEditorGeometry, fit, refitForComposite, captureViewportAnchors, preserveViewportAnchors };
}
