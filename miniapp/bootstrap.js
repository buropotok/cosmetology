const BOOTSTRAP_KEY='__CosmoMiniAppBootstrap';
async function start(){
  // Preserve the legacy index.html execution order while making bootstrap the
  // single composition root for all first-party Mini App runtime code.
  await import('/telegram-gateway.js');
  await import('/app-router.js');
  await import('/app.js');
  await import('/account-state.js');
  await import('/onboarding-api.js');
  await import('/onboarding-controller.js');
  await import('/onboarding-view.js');
  await import('/onboarding-router.js');
  await import('/settings.js');
  await import('/composer-mockup.js');

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
