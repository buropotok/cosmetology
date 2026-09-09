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
  function rotatedSize(photo) {
    const width = photo.img.naturalWidth, height = photo.img.naturalHeight;
    const angle = (Number(photo.rotation) || 0) * Math.PI / 180;
    const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
    return { width: width * cos + height * sin, height: width * sin + height * cos };
  }
  function centerAtScale(photo, scale) {
    photo.scale = scale;
    photo.x = photo.y = 0;
    photo.fitted = true;
  }
  function fit(photo, rect) {
    photo.scale = Math.max(rect.width / photo.img.naturalWidth, rect.height / photo.img.naturalHeight);
    photo.x = photo.y = 0;
    photo.fitted = true;
  }
  function fitWidth(photo, rect) {
    const size = rotatedSize(photo);
    centerAtScale(photo, rect.width / size.width);
  }
  function fitHeight(photo, rect) {
    const size = rotatedSize(photo);
    centerAtScale(photo, rect.height / size.height);
  }
  function fitContain(photo, rect) {
    const size = rotatedSize(photo);
    centerAtScale(photo, Math.min(rect.width / size.width, rect.height / size.height));
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
  return { setEditorGeometryFromRect, setEditorGeometry, fit, fitWidth, fitHeight, fitContain, refitForComposite, captureViewportAnchors, preserveViewportAnchors };
}
