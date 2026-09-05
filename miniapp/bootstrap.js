const BOOTSTRAP_KEY='__CosmoMiniAppBootstrap';

async function loadPlatform(){
  await import('/telegram-gateway.js');
  await import('/app-router.js');
  await import('/app.js');
  await import('/account-state.js');
}

async function loadOnboardingAndSettings(){
  await import('/onboarding-api.js');
  await import('/onboarding-controller.js');
  await import('/onboarding-view.js');
  await import('/onboarding-router.js');
  await import('/settings.js');
  await import('/composer-mockup.js');
  await import('/vk-group-publish-guard.js');
}

async function loadAppShell(){
  await import('/navigation.js');
  await import('/ai-response-ui.js');
  await import('/settings-button.js');
}

async function loadComposerRuntime(){
  await Promise.all([
    import('/composer-screen.js'),
    import('/composer-editor-stability.js'),
    import('/composer-image-manager.js'),
    import('/before-after-bridge.js')
  ]);
  await import('/diagnostics-fetch.js');
  await import('/composer-state.js');
  await import('/draft-store.js');
  await import('/drafts.js');
  await import('/composer-actions.js');
  await import('/onboarding-flow.js');
  await import('/publish-ai-wizard.js');
}

async function loadRuntimeIntegrations(){
  await Promise.all([
    import('/ai-mock-transfer.js'),
    import('/build-id.js'),
    import('/vk-return-confirmation.js')
  ]);
}

async function start(){
  // Startup phases preserve the legacy index.html dependency order while
  // keeping bootstrap as the single first-party Mini App composition root.
  await loadPlatform();
  await loadOnboardingAndSettings();
  await loadAppShell();
  await loadComposerRuntime();
  await loadRuntimeIntegrations();
  return Object.freeze({ready:true});
}

window[BOOTSTRAP_KEY]??=start();
window.CosmoMiniAppReady=window[BOOTSTRAP_KEY];
