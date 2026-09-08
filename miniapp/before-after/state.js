export function createBeforeAfterState({ loadImage, onChange }) {
  const photos = { before: null, after: null };
  let layout = 'horizontal';
  let cropHeight = null;
  let selectedRatio = '16/9';
  let selectedWatermark = null;
  let watermarkState = { x: 0, y: 0, scale: 1, rotation: 0, opacity: .2 };
  let restoring = false;

  const notify = () => { if (!restoring) onChange?.(); };
  const photoState = (photo, imageIndex) => photo ? ({
    imageIndex, x: photo.x, y: photo.y, scale: photo.scale,
    rotation: photo.rotation, fitted: photo.fitted,
  }) : null;

  function snapshot() {
    const files = [];
    let beforeIndex = null, afterIndex = null;
    if (photos.before) { beforeIndex = files.length; files.push(photos.before.file); }
    if (photos.after) { afterIndex = files.length; files.push(photos.after.file); }
    return {
      state: {
        version: 1, layout, ratio: selectedRatio, cropHeight,
        before: photoState(photos.before, beforeIndex),
        after: photoState(photos.after, afterIndex),
        watermark: selectedWatermark ? { id: selectedWatermark.id } : null,
        watermarkState: { ...watermarkState },
      },
      files,
    };
  }

  async function restorePhoto(fileValue, saved) {
    if (!fileValue || !saved) return null;
    const url = URL.createObjectURL(fileValue);
    const img = await loadImage(url);
    return {
      file: fileValue, url, img,
      x: Number(saved.x) || 0, y: Number(saved.y) || 0,
      scale: Number(saved.scale) || 1, rotation: Number(saved.rotation) || 0,
      fitted: saved.fitted !== false,
    };
  }

  async function restore(saved, files = [], findWatermark) {
    if (!saved || typeof saved !== 'object') return;
    restoring = true;
    try {
      for (const role of ['before', 'after']) {
        if (photos[role]?.url) URL.revokeObjectURL(photos[role].url);
        photos[role] = null;
      }
      layout = saved.layout === 'vertical' ? 'vertical' : 'horizontal';
      selectedRatio = typeof saved.ratio === 'string' ? saved.ratio : '16/9';
      cropHeight = Number.isFinite(Number(saved.cropHeight)) ? Number(saved.cropHeight) : null;
      photos.before = await restorePhoto(files[saved.before?.imageIndex], saved.before);
      photos.after = await restorePhoto(files[saved.after?.imageIndex], saved.after);
      if (saved.watermarkState && typeof saved.watermarkState === 'object') {
        watermarkState = { ...watermarkState, ...saved.watermarkState };
      }
      selectedWatermark = saved.watermark?.id ? findWatermark?.(saved.watermark.id) || null : null;
    } finally {
      restoring = false;
    }
  }

  return {
    photos,
    notify,
    snapshot,
    restore,
    isRestoring: () => restoring,
    get layout() { return layout; }, set layout(value) { layout = value; },
    get cropHeight() { return cropHeight; }, set cropHeight(value) { cropHeight = value; },
    get selectedRatio() { return selectedRatio; }, set selectedRatio(value) { selectedRatio = value; },
    get selectedWatermark() { return selectedWatermark; }, set selectedWatermark(value) { selectedWatermark = value; },
    get watermarkState() { return watermarkState; }, set watermarkState(value) { watermarkState = value; },
  };
}
