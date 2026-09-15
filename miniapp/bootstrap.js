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
    splash.innerHTML='<img class="cosmo-startup-splash__logo" src="/icons/sofa-animated.svg" alt="" aria-hidden="true"><pre id="cosmo-startup-log" class="cosmo-startup-splash__log" hidden></pre>';
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

function recordStartupRuntimeDiagnostic({module,status,durationMs,error}={}){
  void import('/runtime-diagnostics.js')
    .then(diagnostics=>diagnostics.recordRuntimeDiagnostic?.({
      event:'module_load',
      stage:'application.startup',
      module,
      status,
      durationMs,
      error
    }))
    .catch(()=>undefined);
}

async function loadStartupModule(moduleName,loader){
  const startedAt=Date.now();
  appendStartupLog('START',moduleName);
  recordStartupRuntimeDiagnostic({module:moduleName,status:'loading'});
  try{
    const module=await loader();
    const durationMs=Date.now()-startedAt;
    appendStartupLog('OK',moduleName,`${durationMs}ms`);
    recordStartupRuntimeDiagnostic({module:moduleName,status:'loaded',durationMs});
    return module;
  }catch(error){
    const durationMs=Date.now()-startedAt;
    appendStartupLog('ERROR',moduleName,`${durationMs}ms; ${startupErrorMessage(error)}`);
    recordStartupRuntimeDiagnostic({module:moduleName,status:'failed',durationMs,error});
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
    .then(diagnostics=>diagnostics.startRuntimeDiagnostics?.())
    .then(()=>appendStartupLog('OK','runtime-diagnostics',`${Date.now()-runtimeDiagnosticsStartedAt}ms`))
    .catch(error=>{
      appendStartupLog('ERROR','runtime-diagnostics',`${Date.now()-runtimeDiagnosticsStartedAt}ms; ${startupErrorMessage(error)}`);
      console.warn('Runtime diagnostics failed to start',error);
    });
  const runtimeDiagnosticsStartedAt=Date.now();
  appendStartupLog('START','runtime-diagnostics');

  void import('/diagnostic-trace-panel.js')
    .then(()=>appendStartupLog('OK','diagnostic-trace-panel',`${Date.now()-diagnosticTraceStartedAt}ms`))
    .catch(error=>{
      appendStartupLog('ERROR','diagnostic-trace-panel',`${Date.now()-diagnosticTraceStartedAt}ms; ${startupErrorMessage(error)}`);
      console.warn('Diagnostic trace panel failed to start',error);
    });
  const diagnosticTraceStartedAt=Date.now();
  appendStartupLog('START','diagnostic-trace-panel');
}

function startComposerGallery(){
  void import('/composer-media-gallery-bridge.js')
    .then(galleryBridge=>{
      appendStartupLog('OK','composer-media-gallery-bridge',`${Date.now()-galleryStartedAt}ms`);
      return galleryBridge.initComposerMediaGalleryBridge?.();
    })
    .catch(error=>{
      appendStartupLog('ERROR','composer-media-gallery-bridge',`${Date.now()-galleryStartedAt}ms; ${startupErrorMessage(error)}`);
      console.warn('Composer gallery failed to start',error);
    });
  const galleryStartedAt=Date.now();
  appendStartupLog('START','composer-media-gallery-bridge');
}

async function loadPlatform(){
  await loadStartupModule('telegram-gateway',()=>import('/telegram-gateway.js'));
  await loadStartupModule('app-router',()=>import('/app-router.js'));
  await loadStartupModule('app',()=>import('/app.js'));
  await loadStartupModule('account-state',()=>import('/account-state.js'));
}

async function loadOnboardingAndSettings(){
  await loadStartupModule('onboarding-api',()=>import('/onboarding-api.js'));
  await loadStartupModule('vk-destination-selection',()=>import('/vk-destination-selection.js'));
  await loadStartupModule('onboarding-controller',()=>import('/onboarding-controller.js'));
  await loadStartupModule('onboarding-view',()=>import('/onboarding-view.js'));
  await loadStartupModule('onboarding-router',()=>import('/onboarding-router.js'));
  await loadStartupModule('settings',()=>import('/settings.js'));
  await loadStartupModule('composer-mockup',()=>import('/composer-mockup.js'));
}

async function loadAppShell(){
  await loadStartupModule('before-after-controller',()=>import('/before-after-controller.js'));
  await loadStartupModule('publish-ai-wizard',()=>import('/publish-ai-wizard.js'));
  await loadStartupModule('ai-generation-status',()=>import('/ai-generation-status.js'));
  await loadStartupModule('navigation',()=>import('/navigation.js'));
  await loadStartupModule('draft-loading-overlay',()=>import('/draft-loading-overlay.js'));
  await loadStartupModule('ai-response-ui',()=>import('/ai-response-ui.js'));
}

async function loadComposerRuntime(){
  await Promise.all([
    loadStartupModule('composer-screen',()=>import('/composer-screen.js')),
    loadStartupModule('composer-editor-stability',()=>import('/composer-editor-stability.js')),
    loadStartupModule('composer-image-manager',()=>import('/composer-image-manager.js')),
    loadStartupModule('before-after-bridge',()=>import('/before-after-bridge.js'))
  ]);
  await loadStartupModule('diagnostics-fetch',()=>import('/diagnostics-fetch.js'));
  await loadStartupModule('composer-state',()=>import('/composer-state.js'));
  await loadStartupModule('composer-image-generation',()=>import('/composer-image-generation.js'));
  startComposerGallery();
  await loadStartupModule('draft-store',()=>import('/draft-store.js'));
  await loadStartupModule('drafts',()=>import('/drafts.js'));
  await loadStartupModule('composer-actions',()=>import('/composer-actions.js'));
  await loadStartupModule('composer-vk-destination',()=>import('/composer-vk-destination.js'));
  await loadStartupModule('onboarding-flow',()=>import('/onboarding-flow.js'));
}

async function loadRuntimeIntegrations(){
  await Promise.all([
    loadStartupModule('ai-post-editor-transfer',()=>import('/ai-post-editor-transfer.js')),
    loadStartupModule('build-id',()=>import('/build-id.js')),
    loadStartupModule('vk-return-confirmation',()=>import('/vk-return-confirmation.js'))
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
