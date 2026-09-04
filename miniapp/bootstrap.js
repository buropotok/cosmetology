const BOOTSTRAP_KEY='__CosmoMiniAppBootstrap';
async function start(){
  await import('/vk-diagnostics.js');
  await import('/navigation.js');
  await Promise.all([import('/composer-screen.js'),import('/composer-editor-stability.js'),import('/composer-image-manager.js'),import('/before-after-bridge.js')]);
  await import('/diagnostics-fetch.js');
  await import('/composer-state.js');
  await import('/draft-store.js');
  await import('/drafts.js');
  await import('/composer-actions.js');
  await Promise.all([import('/ai-mock-transfer.js'),import('/build-id.js'),import('/vk-return-confirmation.js')]);
  return Object.freeze({ready:true});
}
window[BOOTSTRAP_KEY]??=start();
window.CosmoMiniAppReady=window[BOOTSTRAP_KEY];
