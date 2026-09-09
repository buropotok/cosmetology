const RICH_LOADER_VERSION='2026-09-03.16';
window.CosmoDiagnostics?.log?.('rich-loader-start',{version:RICH_LOADER_VERSION,module:'/composer-tiptap.js'});
import(`/composer-tiptap.js?v=${encodeURIComponent(RICH_LOADER_VERSION)}`)
 .then(()=>import(`/composer-tiptap-draft-bridge.js?v=${encodeURIComponent(RICH_LOADER_VERSION)}`))
 .then(()=>{
   window.CosmoDiagnostics?.log?.('rich-loader-ok',{version:RICH_LOADER_VERSION,apiReady:!!window.CosmoRichEditor,engine:'tiptap'});
   return import(`/composer-tiptap-fixes.js?v=${encodeURIComponent(RICH_LOADER_VERSION)}`)
     .then(()=>window.CosmoDiagnostics?.log?.('details-nodeview-loader-ok',{version:RICH_LOADER_VERSION}))
     .catch(error=>{window.CosmoDiagnostics?.log?.('details-nodeview-loader-error',{version:RICH_LOADER_VERSION,error:error?.message||String(error)});console.warn('Details NodeView load failed',error)});
 })
 .catch(error=>{window.CosmoDiagnostics?.log?.('rich-loader-error',{version:RICH_LOADER_VERSION,error:error?.message||String(error)});console.warn('Tiptap editor load failed',error)});
