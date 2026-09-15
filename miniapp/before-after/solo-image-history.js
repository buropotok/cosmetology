export function createSoloImageHistory({
  createUrl = URL.createObjectURL,
  revokeUrl = URL.revokeObjectURL,
} = {}) {
  let versions = [];
  let activeIndex = -1;

  const cloneGeometry = (geometry) =>
    geometry
      ? {
          ratio: geometry.ratio,
          cropHeight: geometry.cropHeight ?? null,
          x: Number(geometry.x) || 0,
          y: Number(geometry.y) || 0,
          scale: Number(geometry.scale) || 1,
          rotation: Number(geometry.rotation) || 0,
          fitted: geometry.fitted !== false,
        }
      : null;

  function makeVersion(file, geometry) {
    return { file, url: createUrl(file), geometry: cloneGeometry(geometry) };
  }

  function initialize(file, geometry = null) {
    destroy();
    versions = [makeVersion(file, geometry)];
    activeIndex = 0;
    return current();
  }

  function append(file, geometry = null) {
    versions.push(makeVersion(file, geometry));
    activeIndex = versions.length - 1;
    return current();
  }

  function get(index) {
    if (!Number.isInteger(index) || index < 0 || index >= versions.length)
      return null;
    return versions[index];
  }

  function select(index) {
    const version = get(index);
    if (!version) return null;
    activeIndex = index;
    return version;
  }

  function current() {
    return versions[activeIndex] || null;
  }

  function updateActiveGeometry(geometry) {
    const version = current();
    if (!version) return null;
    version.geometry = cloneGeometry(geometry);
    return version;
  }

  function snapshot() {
    return {
      versions: versions.map((version) => ({
        ...version,
        geometry: cloneGeometry(version.geometry),
      })),
      activeIndex,
    };
  }

  function destroy() {
    versions.forEach((version) => revokeUrl(version.url));
    versions = [];
    activeIndex = -1;
  }

  return {
    initialize,
    append,
    get,
    select,
    current,
    updateActiveGeometry,
    snapshot,
    destroy,
  };
}
