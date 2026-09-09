import {loadRuntimeModule,recordRuntimeDiagnostic,skipRuntimeModule} from './runtime-diagnostics.js';

const RICH_LOADER_VERSION='2026-09-09.17';
const STAGE='new-post.editor-runtime';
let runtimePromise,runtimeReady=false;

export function loadComposerEditorRuntime(){
  if(runtimeReady)return Promise.resolve({ok:true,editor:window.CosmoRichEditor,cached:true});
  if(!runtimePromise){
    runtimePromise=(async()=>{
      const started=typeof performance?.now==='function'?performance.now():Date.now();
      recordRuntimeDiagnostic({event:'stage_started',stage:STAGE,module:'composer-editor-runtime',status:'loading'});

      const tiptap=await loadRuntimeModule({
        stage:STAGE,
        module:'composer-tiptap',
        load:()=>import(`/composer-tiptap.js?v=${encodeURIComponent(RICH_LOADER_VERSION)}`),
        validate:()=>Boolean(window.CosmoRichEditor),
        validationError:'Tiptap editor did not initialize'
      });

      const bridge=tiptap.ok
        ?await loadRuntimeModule({stage:STAGE,module:'composer-tiptap-draft-bridge',load:()=>import(`/composer-tiptap-draft-bridge.js?v=${encodeURIComponent(RICH_LOADER_VERSION)}`)})
        :skipRuntimeModule({stage:STAGE,module:'composer-tiptap-draft-bridge',dependency:'composer-tiptap'});

      const placeholder=tiptap.ok
        ?await loadRuntimeModule({stage:STAGE,module:'composer-tiptap-placeholder',load:()=>import(`/composer-tiptap-placeholder.js?v=${encodeURIComponent(RICH_LOADER_VERSION)}`)})
        :skipRuntimeModule({stage:STAGE,module:'composer-tiptap-placeholder',dependency:'composer-tiptap'});

      const fixes=tiptap.ok
        ?await loadRuntimeModule({stage:STAGE,module:'composer-tiptap-fixes',load:()=>import(`/composer-tiptap-fixes.js?v=${encodeURIComponent(RICH_LOADER_VERSION)}`)})
        :skipRuntimeModule({stage:STAGE,module:'composer-tiptap-fixes',dependency:'composer-tiptap'});

      const ok=tiptap.ok&&bridge.ok;
      runtimeReady=ok;
      const durationMs=(typeof performance?.now==='function'?performance.now():Date.now())-started;
      const failure=!tiptap.ok?tiptap.error:!bridge.ok?bridge.error:null;
      recordRuntimeDiagnostic({event:'stage_completed',stage:STAGE,module:'composer-editor-runtime',status:ok?'loaded':'failed',durationMs,error:failure});
      if(!ok)runtimePromise=undefined;
      return{ok,editor:window.CosmoRichEditor||null,modules:{tiptap,bridge,placeholder,fixes}};
    })();
  }
  return runtimePromise;
}
