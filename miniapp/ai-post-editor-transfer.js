(()=>{
  const controlPanel=document.querySelector('#publish-ai-wizard [data-ai-control-panel]');
  if(!controlPanel)return;
  const EDITOR_READY_TIMEOUT_MS=10000;
  const DEFAULT_IMAGE_OPTIONS=Object.freeze({internetSearch:false});
  let currentDocument=window.CosmoAiPostDocument||null;
  let currentImageOptions={...DEFAULT_IMAGE_OPTIONS};

  const action=document.createElement('button');
  action.type='button';
  action.className='publish-ai-wizard__edit-publish';
  action.textContent='Редактировать и опубликовать';
  action.hidden=!currentDocument;
  controlPanel.append(action);

  function normalizeImageOptions(value){
    if(value?.internetSearch!==true)return{...DEFAULT_IMAGE_OPTIONS};
    return{
      internetSearch:true,
      searchProfile:typeof value.searchProfile==='string'?value.searchProfile.trim():'',
      sourcePolicy:typeof value.sourcePolicy==='string'?value.sourcePolicy.trim():'',
    };
  }

  function setDocument(doc,imageOptions){
    currentDocument=doc?.schemaVersion===2&&Array.isArray(doc.blocks)?doc:null;
    currentImageOptions=currentDocument?normalizeImageOptions(imageOptions):{...DEFAULT_IMAGE_OPTIONS};
    action.hidden=!currentDocument;
  }

  function editorReady(){
    const editor=window.CosmoRichEditor;
    return editor&&typeof editor.setDocument==='function'?editor:null;
  }

  async function waitForEditor(){
    const ready=editorReady();
    if(ready)return ready;
    return await new Promise(resolve=>{
      let settled=false,timer=0;
      const finish=editor=>{
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        window.removeEventListener('cosmo-rich-ready',onReady);
        resolve(editor);
      };
      const onReady=()=>{const editor=editorReady();if(editor)finish(editor)};
      window.addEventListener('cosmo-rich-ready',onReady);
      timer=setTimeout(()=>finish(null),EDITOR_READY_TIMEOUT_MS);
    });
  }

  async function loadPostDocument(doc,imageOptions=currentImageOptions){
    const editor=await waitForEditor();
    if(!editor)return false;
    if(editor.setDocument(doc)!==true)return false;
    window.CosmoComposerState?.setImageOptions?.(normalizeImageOptions(imageOptions));
    return true;
  }

  action.addEventListener('click',async()=>{
    if(!currentDocument||action.disabled)return;
    action.disabled=true;
    try{
      if(!await loadPostDocument(currentDocument,currentImageOptions)){
        window.Telegram?.WebApp?.showAlert?.('Не удалось загрузить публикацию в редактор. Попробуйте ещё раз.');
        return;
      }
      window.CosmoComposerView?.showEditor?.({focus:false});
      window.CosmoRichEditor?.element?.focus?.();
      await window.CosmoSofaDraft?.flush?.('ai-post-to-editor');
    }finally{
      action.disabled=false;
    }
  });

  window.addEventListener('cosmo-ai-post-document',event=>setDocument(event.detail?.document,event.detail?.imageOptions));
  window.CosmoAiPostEditorTransfer=Object.freeze({loadPostDocument});
})();