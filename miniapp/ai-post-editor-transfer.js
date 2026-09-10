(()=>{
  const controlPanel=document.querySelector('#publish-ai-wizard [data-ai-control-panel]');
  if(!controlPanel)return;
  const EDITOR_READY_TIMEOUT_MS=10000;
  let currentDocument=window.CosmoAiPostDocument||null;

  const action=document.createElement('button');
  action.type='button';
  action.className='publish-ai-wizard__edit-publish';
  action.textContent='Редактировать и опубликовать';
  action.hidden=!currentDocument;
  controlPanel.append(action);

  function setDocument(doc){
    currentDocument=doc?.schemaVersion===2&&Array.isArray(doc.blocks)?doc:null;
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

  async function loadPostDocument(doc){
    const editor=await waitForEditor();
    if(!editor)return false;
    return editor.setDocument(doc)===true;
  }

  action.addEventListener('click',async()=>{
    if(!currentDocument||action.disabled)return;
    action.disabled=true;
    try{
      if(!await loadPostDocument(currentDocument)){
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

  window.addEventListener('cosmo-ai-post-document',event=>setDocument(event.detail?.document));
  window.CosmoAiPostEditorTransfer=Object.freeze({loadPostDocument});
})();
