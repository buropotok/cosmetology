const BOOTSTRAP_KEY='__CosmoMiniAppBootstrap';

function loadWorkspaceStyles(){
  if(!document.querySelector('link[data-cosmo-workspace-spacing]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/compact-workspace.css';
    link.dataset.cosmoWorkspaceSpacing='';
    document.head.append(link);
  }
  if(!document.querySelector('link[data-cosmo-telegram-quotes]')){
    const quoteLink=document.createElement('link');
    quoteLink.rel='stylesheet';
    quoteLink.href='/telegram-quote-preview.css';
    quoteLink.dataset.cosmoTelegramQuotes='';
    document.head.append(quoteLink);
  }
  document.head.insertAdjacentHTML('beforeend','<style>#flow-continue[hidden]{display:none!important}.cosmo-home-mark{width:228px!important;height:228px!important}</style>');
}

function startRuntimeDiagnostics(){
  void import('/runtime-diagnostics.js')
    .then(diagnostics=>diagnostics.startRuntimeDiagnostics?.())
    .catch(error=>console.warn('Runtime diagnostics failed to start',error));
  void import('/diagnostic-trace-panel.js')
    .catch(error=>console.warn('Diagnostic trace panel failed to start',error));
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
  await import('/publish-ai-wizard.js');
  await import('/ai-generation-status.js');
  await import('/navigation.js');
  void import('/d1-diagnostic.js').catch(error=>console.warn('D1 diagnostic failed to load',error));
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
  await import('/composer-image-generation.js');
  await import('/draft-store.js');
  await import('/drafts.js');
  await import('/composer-actions.js');
  await import('/onboarding-flow.js');
}

async function loadRuntimeIntegrations(){
  await Promise.all([
    import('/ai-post-editor-transfer.js'),
    import('/build-id.js'),
    import('/vk-return-confirmation.js')
  ]);
}

async function start(){
  loadWorkspaceStyles();
  startRuntimeDiagnostics();
  await loadPlatform();
  await loadOnboardingAndSettings();
  await loadAppShell();
  await loadComposerRuntime();
  await loadRuntimeIntegrations();
  return Object.freeze({ready:true});
}

window[BOOTSTRAP_KEY]??=start();
window.CosmoMiniAppReady=window[BOOTSTRAP_KEY];
