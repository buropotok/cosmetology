const RICH_EDITOR_VERSION='20260825a';
let runtimePromise;

export async function loadComposerRichEditor(){
  if(window.CosmoRichEditor)return window.CosmoRichEditor;
  if(!runtimePromise){
    runtimePromise=(async()=>{
      window.CosmoDiagnostics?.log?.('rich-loader-start',{version:RICH_EDITOR_VERSION,module:'/composer-tiptap.js'});
      await import(`./composer-tiptap.js?v=${encodeURIComponent(RICH_EDITOR_VERSION)}`)
        .then(()=>import(`./composer-tiptap-draft-bridge.js?v=${encodeURIComponent(RICH_EDITOR_VERSION)}`))
        .then(()=>import(`./composer-tiptap-fixes.js?v=${encodeURIComponent(RICH_EDITOR_VERSION)}`))
        .catch(async error=>{
          window.CosmoDiagnostics?.log?.('rich-loader-fallback',{version:RICH_EDITOR_VERSION,error:error?.message||String(error)});
          await import('./composer-rich-text.js');
        });
      if(!window.CosmoRichEditor)throw new Error('Composer rich editor did not initialize');
      window.CosmoDiagnostics?.log?.('rich-loader-ok',{version:RICH_EDITOR_VERSION,apiReady:true,engine:'tiptap'});
      return window.CosmoRichEditor;
    })().catch(error=>{runtimePromise=undefined;throw error});
  }
  return runtimePromise;
}
