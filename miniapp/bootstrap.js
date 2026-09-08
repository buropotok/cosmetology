const BOOTSTRAP_KEY='__CosmoMiniAppBootstrap';

async function startShell(){
  await import('./telegram-gateway.js');
  const webApp=window.Telegram?.WebApp;
  webApp?.ready();
  webApp?.expand();
  await import('./app-router.js');
  await import('./navigation.js');

  // Build metadata is diagnostic-only and must never delay or break Home.
  import('./build-id.js').catch(error=>console.warn('Build metadata failed to load',error));
  return Object.freeze({ready:true});
}

if(!window[BOOTSTRAP_KEY])window[BOOTSTRAP_KEY]=startShell();
window.CosmoMiniAppReady=window[BOOTSTRAP_KEY];
