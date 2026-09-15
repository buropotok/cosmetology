export function createSoloImageHistory({
  createUrl = URL.createObjectURL,
  revokeUrl = URL.revokeObjectURL,
} = {}) {
  let versions = [];
  let activeIndex = -1;

  function initialize(file) {
    destroy();
    versions = [{ file, url: createUrl(file) }];
    activeIndex = 0;
    return current();
  }

  function append(file) {
    versions.push({ file, url: createUrl(file) });
    activeIndex = versions.length - 1;
    return current();
  }

  function select(index) {
    if (!Number.isInteger(index) || index < 0 || index >= versions.length)
      return null;
    activeIndex = index;
    return current();
  }

  function current() {
    return versions[activeIndex] || null;
  }
  function undo() {
    return select(activeIndex - 1);
  }
  function redo() {
    return select(activeIndex + 1);
  }
  function snapshot() {
    return {
      versions: versions.slice(),
      activeIndex,
      canUndo: activeIndex > 0,
      canRedo: activeIndex >= 0 && activeIndex < versions.length - 1,
    };
  }
  function destroy() {
    versions.forEach((version) => revokeUrl(version.url));
    versions = [];
    activeIndex = -1;
  }

  return { initialize, append, select, current, undo, redo, snapshot, destroy };
}
