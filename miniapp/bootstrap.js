const BOOTSTRAP_KEY='__CosmoMiniAppBootstrap';

function loadWorkspaceStyles(){
  if(document.querySelector('link[data-cosmo-workspace-spacing]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='/compact-workspace.css';
  link.dataset.cosmoWorkspaceSpacing='';
  document.head.append(link);
}

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
  await import('/before-after-controller.js');
  await import('/new-post-lifecycle.js');
  await import('/publish-ai-wizard.js');
  await import('/navigation.js');
  await import('/draft-loading-overlay.js');
  await import('/ai-response-ui.js');
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
  await import('/draft-resume-router.js');
  await import('/composer-actions.js');
  await import('/onboarding-flow.js');
}

async function loadRuntimeIntegrations(){
  await Promise.all([
    import('/ai-mock-transfer.js'),
    import('/build-id.js'),
    import('/vk-return-confirmation.js')
  ]);
}

async function start(){
  loadWorkspaceStyles();
  await loadPlatform();
  await loadOnboardingAndSettings();
  await loadAppShell();
  await loadComposerRuntime();
  await loadRuntimeIntegrations();
  return Object.freeze({ready:true});
}

window[BOOTSTRAP_KEY]??=start();
window.CosmoMiniAppReady=window[BOOTSTRAP_KEY];
