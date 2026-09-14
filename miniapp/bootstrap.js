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
  const splash=output.parentElement;
  if(splash)splash.scrollTop=splash.scrollHeight;
}

function showStartupSplash(){
  loadStartupSplashStyles();
  let splash=document.querySelector(`#${STARTUP_SPLASH_ID}`);
  if(!splash){
    splash=document.createElement('section');
    splash.id=STARTUP_SPLASH_ID;
    splash.className='cosmo-startup-splash';
    splash.setAttribute('aria-label','Загрузка приложения');
    splash.innerHTML='<p>Загрузка Cosmo Sofa…</p><pre id="cosmo-startup-log" class="cosmo-startup-splash__log" aria-live="polite"></pre>';
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

async function loadStartupModule(moduleName,loader){
  const startedAt=Date.now();
  appendStartupLog('START',moduleName);
  try{
    const module=await loader();
    appendStartupLog('OK',moduleName,`${Date.now()-startedAt}ms`);
    return module;
  }catch(error){
    appendStartupLog('ERROR',moduleName,`${Date.now()-startedAt}ms; ${startupErrorMessage(error)}`);
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
  void import('/runtime-diagnostics.js')
    .then(diagnostics=>{
      appendStartupLog('OK','runtime-diagnostics.js',`${Date.now()-runtimeDiagnosticsStartedAt}ms`);
      return diagnostics.startRuntimeDiagnostics?.();
    })
    .catch(error=>{
      appendStartupLog('ERROR','runtime-diagnostics.js',`${Date.now()-runtimeDiagnosticsStartedAt}ms; ${startupErrorMessage(error)}`);
      console.warn('Runtime diagnostics failed to start',error);
    });
  const runtimeDiagnosticsStartedAt=Date.now();
  appendStartupLog('START','runtime-diagnostics.js');

  void import('/diagnostic-trace-panel.js')
    .then(()=>appendStartupLog('OK','diagnostic-trace-panel.js',`${Date.now()-diagnosticTraceStartedAt}ms`))
    .catch(error=>{
      appendStartupLog('ERROR','diagnostic-trace-panel.js',`${Date.now()-diagnosticTraceStartedAt}ms; ${startupErrorMessage(error)}`);
      console.warn('Diagnostic trace panel failed to start',error);
    });
  const diagnosticTraceStartedAt=Date.now();
  appendStartupLog('START','diagnostic-trace-panel.js');
}

function startComposerGallery(){
  void import('/composer-media-gallery-bridge.js')
    .then(galleryBridge=>{
      appendStartupLog('OK','composer-media-gallery-bridge.js',`${Date.now()-galleryStartedAt}ms`);
      return galleryBridge.initComposerMediaGalleryBridge?.();
    })
    .catch(error=>{
      appendStartupLog('ERROR','composer-media-gallery-bridge.js',`${Date.now()-galleryStartedAt}ms; ${startupErrorMessage(error)}`);
      console.warn('Composer gallery failed to start',error);
    });
  const galleryStartedAt=Date.now();
  appendStartupLog('START','composer-media-gallery-bridge.js');
}

async function loadPlatform(){
  await loadStartupModule('telegram-gateway.js',()=>import('/telegram-gateway.js'));
  await loadStartupModule('app-router.js',()=>import('/app-router.js'));
  await loadStartupModule('app.js',()=>import('/app.js'));
  await loadStartupModule('account-state.js',()=>import('/account-state.js'));
}

async function loadOnboardingAndSettings(){
  await loadStartupModule('onboarding-api.js',()=>import('/onboarding-api.js'));
  await loadStartupModule('vk-destination-selection.js',()=>import('/vk-destination-selection.js'));
  await loadStartupModule('onboarding-controller.js',()=>import('/onboarding-controller.js'));
  await loadStartupModule('onboarding-view.js',()=>import('/onboarding-view.js'));
  await loadStartupModule('onboarding-router.js',()=>import('/onboarding-router.js'));
  await loadStartupModule('settings.js',()=>import('/settings.js'));
  await loadStartupModule('composer-mockup.js',()=>import('/composer-mockup.js'));
}

async function loadAppShell(){
  await loadStartupModule('before-after-controller.js',()=>import('/before-after-controller.js'));
  await loadStartupModule('publish-ai-wizard.js',()=>import('/publish-ai-wizard.js'));
  await loadStartupModule('ai-generation-status.js',()=>import('/ai-generation-status.js'));
  await loadStartupModule('navigation.js',()=>import('/navigation.js'));
  await loadStartupModule('draft-loading-overlay.js',()=>import('/draft-loading-overlay.js'));
  await loadStartupModule('ai-response-ui.js',()=>import('/ai-response-ui.js'));
}

async function loadComposerRuntime(){
  await Promise.all([
    loadStartupModule('composer-screen.js',()=>import('/composer-screen.js')),
    loadStartupModule('composer-editor-stability.js',()=>import('/composer-editor-stability.js')),
    loadStartupModule('composer-image-manager.js',()=>import('/composer-image-manager.js')),
    loadStartupModule('before-after-bridge.js',()=>import('/before-after-bridge.js'))
  ]);
  await loadStartupModule('diagnostics-fetch.js',()=>import('/diagnostics-fetch.js'));
  await loadStartupModule('composer-state.js',()=>import('/composer-state.js'));
  await loadStartupModule('composer-image-generation.js',()=>import('/composer-image-generation.js'));
  startComposerGallery();
  await loadStartupModule('draft-store.js',()=>import('/draft-store.js'));
  await loadStartupModule('drafts.js',()=>import('/drafts.js'));
  await loadStartupModule('composer-actions.js',()=>import('/composer-actions.js'));
  await loadStartupModule('composer-vk-destination.js',()=>import('/composer-vk-destination.js'));
  await loadStartupModule('onboarding-flow.js',()=>import('/onboarding-flow.js'));
}

async function loadRuntimeIntegrations(){
  await Promise.all([
    loadStartupModule('ai-post-editor-transfer.js',()=>import('/ai-post-editor-transfer.js')),
    loadStartupModule('build-id.js',()=>import('/build-id.js')),
    loadStartupModule('vk-return-confirmation.js',()=>import('/vk-return-confirmation.js'))
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
