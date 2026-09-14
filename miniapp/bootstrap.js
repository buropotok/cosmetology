const BOOTSTRAP_KEY='__CosmoMiniAppBootstrap';

function loadWorkspaceStyles(){
  if(!document.querySelector('link[data-cosmo-workspace-spacing]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='/compact-workspace.css';
    link.dataset.cosmoWorkspaceSpacing='';
    document.head.append(link);
  }
  document.head.insertAdjacentHTML('beforeend','<style>#flow-continue[hidden]{display:none!important}.cosmo-home-mark{width:228px!important;height:228px!important}</style>');
}

function loadComposerStyles(){
  if(document.querySelector('link[data-cosmo-telegram-quotes]'))return;
  const quoteLink=document.createElement('link');
  quoteLink.rel='stylesheet';
  quoteLink.href='/telegram-quote-preview.css';
  quoteLink.dataset.cosmoTelegramQuotes='';
  document.head.append(quoteLink);
}

function startRuntimeDiagnostics(){
  void import('/runtime-diagnostics.js')
    .then(diagnostics=>diagnostics.startRuntimeDiagnostics?.())
    .catch(error=>console.warn('Runtime diagnostics failed to start',error));
  void import('/diagnostic-trace-panel.js')
    .catch(error=>console.warn('Diagnostic trace panel failed to start',error));
}

function startBuildId(){
  void import('/build-id.js')
    .catch(error=>console.warn('Build id failed to start',error));
}

function startComposerGallery(){
  void import('/composer-media-gallery-bridge.js')
    .then(galleryBridge=>galleryBridge.initComposerMediaGalleryBridge?.())
    .catch(error=>console.warn('Composer gallery failed to start',error));
}

async function loadCriticalShell(){
  await import('/telegram-gateway.js');
  await import('/app-router.js');
  await import('/navigation.js');
}

async function loadFeaturePlatform(){
  await import('/app.js');
  await import('/account-state.js');
  await import('/onboarding-api.js');
  await import('/vk-destination-selection.js');
  await import('/onboarding-controller.js');
  await import('/onboarding-view.js');
  await import('/onboarding-router.js');
}

async function loadSettingsUi(){
  await import('/settings.js');
}

async function loadComposerUi(){
  loadComposerStyles();
  await import('/composer-mockup.js');
  window.CosmoNavigation?.ensureComposerBackButton?.();
  await import('/before-after-controller.js');
  await import('/publish-ai-wizard.js');
  await import('/ai-generation-status.js');
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
  startComposerGallery();
  await import('/draft-store.js');
  await import('/drafts.js');
  await import('/composer-actions.js');
  await import('/composer-vk-destination.js');
  await import('/onboarding-flow.js');
}

async function loadRuntimeIntegrations(){
  await Promise.all([
    import('/ai-post-editor-transfer.js'),
    import('/vk-return-confirmation.js')
  ]);
}

let featurePlatformPromise=null;
function ensureFeaturePlatform(){
  if(!featurePlatformPromise){
    featurePlatformPromise=loadFeaturePlatform().catch(error=>{
      featurePlatformPromise=null;
      throw error;
    });
  }
  return featurePlatformPromise;
}

let settingsRuntimePromise=null;
async function loadSettingsRuntime(){
  if(!settingsRuntimePromise){
    settingsRuntimePromise=(async()=>{
      await ensureFeaturePlatform();
      await loadSettingsUi();
      return Object.freeze({ready:true});
    })().catch(error=>{
      settingsRuntimePromise=null;
      throw error;
    });
  }
  return settingsRuntimePromise;
}

let composerRuntimePromise=null;
async function loadComposerFeatureRuntime(){
  if(!composerRuntimePromise){
    composerRuntimePromise=(async()=>{
      await loadSettingsRuntime();
      await loadComposerUi();
      await loadComposerRuntime();
      await loadRuntimeIntegrations();
      return Object.freeze({ready:true});
    })().catch(error=>{
      composerRuntimePromise=null;
      throw error;
    });
  }
  return composerRuntimePromise;
}

window.CosmoFeatureRuntime=Object.freeze({load:loadComposerFeatureRuntime,loadSettings:loadSettingsRuntime});

async function start(){
  loadWorkspaceStyles();
  startRuntimeDiagnostics();
  startBuildId();
  await loadCriticalShell();
  const webApp=window.Telegram?.WebApp;
  webApp?.expand?.();
  webApp?.ready?.();
  return Object.freeze({ready:true});
}

window[BOOTSTRAP_KEY]??=start();
window.CosmoMiniAppReady=window[BOOTSTRAP_KEY];
