const BOOTSTRAP_KEY='__CosmoMiniAppBootstrap';
const STARTUP_SPLASH_ID='cosmo-startup-splash';
const STARTUP_LOG_ID='cosmo-startup-log';
const startupStartedAt=Date.now();

function loadStartupSplashStyles(){
  if(document.querySelector('link[data-cosmo-startup-splash]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='/startup-splash.css';
  link.dataset.cosmoStartupSplash='';
  document.head.append(link);
}

function startupErrorMessage(error){
  if(error instanceof Error)return`${error.name}: ${error.message}`;
  return String(error);
}

function appendStartupLog(status,subject,detail=''){
  const output=document.querySelector(`#${STARTUP_LOG_ID}`);
  if(!output)return;
  const elapsed=Date.now()-startupStartedAt;
  const suffix=detail?` — ${detail}`:'';
  output.textContent+=`+${elapsed}ms [${status}] ${subject}${suffix}\n`;
  output.scrollTop=output.scrollHeight;
}

function showStartupSplash(){
  loadStartupSplashStyles();
  let splash=document.querySelector(`#${STARTUP_SPLASH_ID}`);
  if(!splash){
    splash=document.createElement('section');
    splash.id=STARTUP_SPLASH_ID;
    splash.className='cosmo-startup-splash';
    splash.setAttribute('aria-label','Загрузка приложения');
    splash.innerHTML='<p class="cosmo-startup-splash__title">Загрузка Cosmo Sofa…</p><pre id="cosmo-startup-log" class="cosmo-startup-splash__log" aria-live="polite"></pre>';
    document.body.appendChild(splash);
  }
  splash.hidden=false;
  appendStartupLog('START','/bootstrap.js');
  const webApp=window.Telegram?.WebApp;
  if(!webApp){
    appendStartupLog('INFO','Telegram.WebApp','API недоступен');
    return;
  }
  try{
    webApp.ready();
    appendStartupLog('OK','Telegram.WebApp.ready()');
  }catch(error){
    appendStartupLog('ERROR','Telegram.WebApp.ready()',startupErrorMessage(error));
  }
}

function hideStartupSplash(){
  const splash=document.querySelector(`#${STARTUP_SPLASH_ID}`);
  if(splash)splash.hidden=true;
}

async function loadStartupModule(modulePath){
  const startedAt=Date.now();
  appendStartupLog('START',modulePath);
  try{
    const module=await import(modulePath);
    appendStartupLog('OK',modulePath,`${Date.now()-startedAt}ms`);
    return module;
  }catch(error){
    appendStartupLog('ERROR',modulePath,`${Date.now()-startedAt}ms; ${startupErrorMessage(error)}`);
    throw error;
  }
}

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
  void loadStartupModule('/runtime-diagnostics.js')
    .then(diagnostics=>diagnostics.startRuntimeDiagnostics?.())
    .catch(error=>console.warn('Runtime diagnostics failed to start',error));
  void loadStartupModule('/diagnostic-trace-panel.js')
    .catch(error=>console.warn('Diagnostic trace panel failed to start',error));
}

function startComposerGallery(){
  void loadStartupModule('/composer-media-gallery-bridge.js')
    .then(galleryBridge=>galleryBridge.initComposerMediaGalleryBridge?.())
    .catch(error=>console.warn('Composer gallery failed to start',error));
}

async function loadPlatform(){
  await loadStartupModule('/telegram-gateway.js');
  await loadStartupModule('/app-router.js');
  await loadStartupModule('/app.js');
  await loadStartupModule('/account-state.js');
}

async function loadOnboardingAndSettings(){
  await loadStartupModule('/onboarding-api.js');
  await loadStartupModule('/vk-destination-selection.js');
  await loadStartupModule('/onboarding-controller.js');
  await loadStartupModule('/onboarding-view.js');
  await loadStartupModule('/onboarding-router.js');
  await loadStartupModule('/settings.js');
  await loadStartupModule('/composer-mockup.js');
}

async function loadAppShell(){
  await loadStartupModule('/before-after-controller.js');
  await loadStartupModule('/publish-ai-wizard.js');
  await loadStartupModule('/ai-generation-status.js');
  await loadStartupModule('/navigation.js');
  await loadStartupModule('/draft-loading-overlay.js');
  await loadStartupModule('/ai-response-ui.js');
}

async function loadComposerRuntime(){
  await Promise.all([
    loadStartupModule('/composer-screen.js'),
    loadStartupModule('/composer-editor-stability.js'),
    loadStartupModule('/composer-image-manager.js'),
    loadStartupModule('/before-after-bridge.js')
  ]);
  await loadStartupModule('/diagnostics-fetch.js');
  await loadStartupModule('/composer-state.js');
  await loadStartupModule('/composer-image-generation.js');
  startComposerGallery();
  await loadStartupModule('/draft-store.js');
  await loadStartupModule('/drafts.js');
  await loadStartupModule('/composer-actions.js');
  await loadStartupModule('/composer-vk-destination.js');
  await loadStartupModule('/onboarding-flow.js');
}

async function loadRuntimeIntegrations(){
  await Promise.all([
    loadStartupModule('/ai-post-editor-transfer.js'),
    loadStartupModule('/build-id.js'),
    loadStartupModule('/vk-return-confirmation.js')
  ]);
}

async function start(){
  showStartupSplash();
  try{
    loadWorkspaceStyles();
    startRuntimeDiagnostics();
    await loadPlatform();
    await loadOnboardingAndSettings();
    await loadAppShell();
    await loadComposerRuntime();
    await loadRuntimeIntegrations();
    appendStartupLog('OK','/bootstrap.js',`${Date.now()-startupStartedAt}ms total`);
    hideStartupSplash();
    return Object.freeze({ready:true});
  }catch(error){
    appendStartupLog('ERROR','/bootstrap.js',startupErrorMessage(error));
    throw error;
  }
}

window[BOOTSTRAP_KEY]??=start();
window.CosmoMiniAppReady=window[BOOTSTRAP_KEY];
