import {loadRuntimeModule,recordRuntimeDiagnostic,skipRuntimeModule} from './runtime-diagnostics.js';

const RICH_LOADER_VERSION='2026-09-11.3';
const STAGE='new-post.editor-runtime';
let runtimePromise,runtimeReady=false;

function prepareEditorHost(){
  const existing=document.querySelector('#composer-editor-host');
  if(existing instanceof HTMLElement)return{host:existing,legacyText:null,created:false};
  const legacyText=document.querySelector('#text');
  if(!(legacyText instanceof HTMLTextAreaElement)||!legacyText.parentNode)return null;
  const host=document.createElement('div');
  host.id='composer-editor-host';
  host.className='composer-bodytext composer-rich-editor composer-tiptap-editor';
  legacyText.parentNode.insertBefore(host,legacyText);
  return{host,legacyText,created:true};
}

export function loadComposerEditorRuntime(){
  if(runtimeReady)return Promise.resolve({ok:true,editor:window.CosmoRichEditor,cached:true});
  if(!runtimePromise){
    runtimePromise=(async()=>{
      const started=typeof performance?.now==='function'?performance.now():Date.now();
      recordRuntimeDiagnostic({event:'stage_started',stage:STAGE,module:'composer-editor-runtime',status:'loading'});

      const mount=prepareEditorHost();
      if(!mount){
        const error='Composer editor host is unavailable';
        recordRuntimeDiagnostic({event:'stage_completed',stage:STAGE,module:'composer-editor-runtime',status:'failed',error});
        runtimePromise=undefined;
        return{ok:false,editor:null,modules:{},error};
      }

      const tiptap=await loadRuntimeModule({
        stage:STAGE,
        module:'composer-tiptap',
        load:()=>import(`/composer-tiptap.js?v=${encodeURIComponent(RICH_LOADER_VERSION)}`),
        validate:()=>Boolean(window.CosmoRichEditor),
        validationError:'Tiptap editor did not initialize'
      });
      if(tiptap.ok)mount.legacyText?.remove();
      else if(mount.created)mount.host.remove();

      const placeholder=tiptap.ok
        ?await loadRuntimeModule({stage:STAGE,module:'composer-tiptap-placeholder',load:()=>import(`/composer-tiptap-placeholder.js?v=${encodeURIComponent(RICH_LOADER_VERSION)}`)})
        :skipRuntimeModule({stage:STAGE,module:'composer-tiptap-placeholder',dependency:'composer-tiptap'});

      if(tiptap.ok){
        await loadRuntimeModule({
          stage:STAGE,
          module:'composer-editor-keyboard-layout',
          load:async()=>{
            const module=await import(`/composer-editor-keyboard-layout.js?v=${encodeURIComponent(RICH_LOADER_VERSION)}`);
            return module.initComposerEditorKeyboardLayout();
          },
          validate:value=>Boolean(value),
          validationError:'Composer keyboard layout did not initialize'
        });
      }else{
        skipRuntimeModule({stage:STAGE,module:'composer-editor-keyboard-layout',dependency:'composer-tiptap'});
      }

      const fixes=tiptap.ok
        ?await loadRuntimeModule({stage:STAGE,module:'composer-tiptap-fixes',load:()=>import(`/composer-tiptap-fixes.js?v=${encodeURIComponent(RICH_LOADER_VERSION)}`)})
        :skipRuntimeModule({stage:STAGE,module:'composer-tiptap-fixes',dependency:'composer-tiptap'});

      const ok=tiptap.ok;
      runtimeReady=ok;
      const durationMs=(typeof performance?.now==='function'?performance.now():Date.now())-started;
      const failure=!tiptap.ok?tiptap.error:null;
      recordRuntimeDiagnostic({event:'stage_completed',stage:STAGE,module:'composer-editor-runtime',status:ok?'loaded':'failed',durationMs,error:failure});
      if(!ok)runtimePromise=undefined;
      return{ok,editor:window.CosmoRichEditor||null,modules:{tiptap,placeholder,fixes}};
    })();
  }
  return runtimePromise;
}
