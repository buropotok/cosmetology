(()=>{
  const controlPanel=document.querySelector('#publish-ai-wizard [data-ai-control-panel]');
  if(!controlPanel)return;
  const DRAFT_PREFIX='\u2063COSMO_DRAFT_V3:';
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
    return editor&&typeof editor.restoreDraft==='function'?editor:null;
  }

  async function waitForEditor(){
    const ready=editorReady();
    if(ready)return ready;
    const started=Date.now();
    return await new Promise(resolve=>{
      const timer=setInterval(()=>{
        const editor=editorReady();
        if(editor||Date.now()-started>=EDITOR_READY_TIMEOUT_MS){
          clearInterval(timer);
          resolve(editor);
        }
      },50);
    });
  }

  async function loadPostDocument(doc){
    const editor=await waitForEditor();
    if(!editor)return false;
    const value=DRAFT_PREFIX+JSON.stringify({version:3,document:doc});
    return editor.restoreDraft(value)===true;
  }

  action.addEventListener('click',async()=>{
    if(!currentDocument||action.disabled)return;
    action.disabled=true;
    try{
      if(!await loadPostDocument(currentDocument)){
        window.Telegram?.WebApp?.showAlert?.('Не удалось загрузить публикацию в редактор. Попробуйте ещё раз.');
        return;
      }
      const screen=document.querySelector('#composer-screen');
      const wizard=document.querySelector('#publish-ai-wizard');
      const composerContent=document.querySelector('#composer-content');
      if(wizard)wizard.hidden=true;
      if(composerContent)composerContent.hidden=false;
      if(screen)screen.dataset.publishMode='compose';
      window.dispatchEvent(new CustomEvent('cosmo-publish-mode',{detail:{mode:'compose'}}));
      window.CosmoRichEditor?.element?.focus?.();
      await window.CosmoSofaDraft?.flush?.('ai-post-to-editor');
    }finally{
      action.disabled=false;
    }
  });

  window.addEventListener('cosmo-ai-post-document',event=>setDocument(event.detail?.document));
  window.CosmoAiPostEditorTransfer=Object.freeze({loadPostDocument});
})();
