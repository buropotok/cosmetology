export function createResize({ handle, slots, state, geometry, composite, onRender }) {
  // Telegram iOS/WKWebView is reliable with window-level pointer tracking here; avoid pointer capture.
  let active = null;
  let renderFrame = 0;

  function cancelRender() {
    if (!renderFrame) return;
    cancelAnimationFrame(renderFrame);
    renderFrame = 0;
  }

  function scheduleRender() {
    if (renderFrame) return;
    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0;
      onRender();
    });
  }

  function cleanupPointerListeners() {
    window.removeEventListener('pointerdown', onForeignPointerDown, true);
    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('pointerup', onPointerEnd, true);
    window.removeEventListener('pointercancel', onPointerEnd, true);
    window.removeEventListener('touchend', onTouchEnd, true);
    window.removeEventListener('touchcancel', onTouchEnd, true);
    active = null;
  }

  function applyPointer(event) {
    if (!active || event.pointerId !== active.pointerId) return false;
    if (event.cancelable) event.preventDefault();
    const anchors = geometry.captureViewportAnchors();
    const width = slots.getBoundingClientRect().width;
    const minHeight = width / (16 / 9);
    const maxHeight = Math.max(minHeight, window.innerHeight - 120);
    const next = Math.max(minHeight, Math.min(maxHeight, active.startHeight + event.clientY - active.startY));
    state.cropHeight = next;
    state.selectedRatio = 'custom';
    slots.style.height = `${next}px`;
    slots.style.aspectRatio = 'auto';
    geometry.preserveViewportAnchors(anchors);
    composite.clearCommitted();
    scheduleRender();
    return true;
  }

  function onPointerMove(event) {
    applyPointer(event);
  }

  function onPointerEnd(event) {
    if (!active || event.pointerId !== active.pointerId) return;
    // Pointer-up ends the gesture only. WebKit can deliver a delayed or unreliable
    // release coordinate, so the crop may only be mutated by pointermove.
    cleanupPointerListeners();
  }

  function onTouchEnd() {
    if (!active) return;
    // iOS/WKWebView fallback when the matching pointerup/pointercancel is lost.
    cleanupPointerListeners();
  }

  function onForeignPointerDown(event) {
    if (!active) return;
    const target = event.target;
    if (target === handle || (target && handle.contains?.(target))) return;
    cleanupPointerListeners();
  }

  function onPointerDown(event) {
    if (event.button != null && event.button !== 0) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    cleanupPointerListeners();
    active = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: slots.getBoundingClientRect().height,
    };
    window.addEventListener('pointerdown', onForeignPointerDown, true);
    window.addEventListener('pointermove', onPointerMove, { capture: true, passive: false });
    window.addEventListener('pointerup', onPointerEnd, true);
    window.addEventListener('pointercancel', onPointerEnd, true);
    window.addEventListener('touchend', onTouchEnd, true);
    window.addEventListener('touchcancel', onTouchEnd, true);
  }

  handle.addEventListener('pointerdown', onPointerDown, { passive: false });

  function destroy() {
    handle.removeEventListener('pointerdown', onPointerDown);
    cleanupPointerListeners();
    cancelRender();
  }

  return Object.freeze({ destroy });
}
