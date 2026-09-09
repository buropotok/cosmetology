const RICH_LOADER_VERSION='2026-09-03.16';
let runtimePromise,runtimeReady=false;

export function loadComposerEditorRuntime(){
  if(runtimeReady)return Promise.resolve(window.CosmoRichEditor);
  if(!runtimePromise){
    window.CosmoDiagnostics?.log?.('rich-loader-start',{version:RICH_LOADER_VERSION,module:'/composer-tiptap.js'});
    runtimePromise=import(`/composer-tiptap.js?v=${encodeURIComponent(RICH_LOADER_VERSION)}`)
      .then(()=>import(`/composer-tiptap-draft-bridge.js?v=${encodeURIComponent(RICH_LOADER_VERSION)}`))
      .then(()=>{
        if(!window.CosmoRichEditor)throw new Error('Tiptap editor did not initialize');
        window.CosmoDiagnostics?.log?.('rich-loader-ok',{version:RICH_LOADER_VERSION,apiReady:true,engine:'tiptap'});
        return import(`/composer-tiptap-fixes.js?v=${encodeURIComponent(RICH_LOADER_VERSION)}`)
          .then(()=>window.CosmoDiagnostics?.log?.('details-nodeview-loader-ok',{version:RICH_LOADER_VERSION}))
          .catch(error=>{window.CosmoDiagnostics?.log?.('details-nodeview-loader-error',{version:RICH_LOADER_VERSION,error:error?.message||String(error)});console.warn('Details NodeView load failed',error)})
          .then(()=>{runtimeReady=true;return window.CosmoRichEditor});
      })
      .catch(error=>{
        runtimePromise=undefined;
        runtimeReady=false;
        window.CosmoDiagnostics?.log?.('rich-loader-error',{version:RICH_LOADER_VERSION,error:error?.message||String(error)});
        console.warn('Tiptap editor load failed',error);
        throw error;
      });
  }
  return runtimePromise;
}
