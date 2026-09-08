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
    const url = URL.createObjectURL(fileValue);
    try {
      const img = await loadImage(url);
      return {
        file: fileValue, url, img,
        x: Number(saved.x) || 0, y: Number(saved.y) || 0,
        scale: Number(saved.scale) || 1, rotation: Number(saved.rotation) || 0,
        fitted: saved.fitted !== false,
      };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }

  async function restore(saved, files = [], findWatermark) {
    if (!saved || typeof saved !== 'object') return false;
    restoring = true;
    const nextPhotos = { before: null, after: null };
    try {
      for (const role of ['before', 'after']) {
        const savedPhoto = saved[role];
        if (!savedPhoto) continue;
        const index = savedPhoto.imageIndex;
        if (!Number.isInteger(index) || index < 0 || !files[index]) {
          throw new Error(`Missing ${role} image for Before/After restore`);
        }
        nextPhotos[role] = await restorePhoto(files[index], savedPhoto);
      }

      const nextLayout = saved.layout === 'vertical' ? 'vertical' : 'horizontal';
      const nextRatio = typeof saved.ratio === 'string' ? saved.ratio : '16/9';
      const nextCropHeight = saved.cropHeight == null ? null : Number.isFinite(Number(saved.cropHeight)) ? Number(saved.cropHeight) : null;
      const nextWatermarkState = saved.watermarkState && typeof saved.watermarkState === 'object'
        ? { ...watermarkState, ...saved.watermarkState }
        : { ...watermarkState };
      const nextWatermark = saved.watermark?.id ? findWatermark?.(saved.watermark.id) || null : null;

      for (const role of ['before', 'after']) {
        if (photos[role]?.url) URL.revokeObjectURL(photos[role].url);
        photos[role] = nextPhotos[role];
      }
      layout = nextLayout;
      selectedRatio = nextRatio;
      cropHeight = nextCropHeight;
      watermarkState = nextWatermarkState;
      selectedWatermark = nextWatermark;
      return true;
    } catch (error) {
      for (const role of ['before', 'after']) if (nextPhotos[role]?.url) URL.revokeObjectURL(nextPhotos[role].url);
      throw error;
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
