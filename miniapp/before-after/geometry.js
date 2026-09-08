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
  return { setEditorGeometryFromRect, setEditorGeometry, fit, refitForComposite };
}
