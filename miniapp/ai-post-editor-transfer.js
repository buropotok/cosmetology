(()=>{
  const controlPanel=document.querySelector('#publish-ai-wizard [data-ai-control-panel]');
  if(!controlPanel)return;
  const DRAFT_PREFIX='\u2063COSMO_DRAFT_V2:';
  let currentDocument=window.CosmoAiPostDocument||null;

  const action=document.createElement('button');
  action.type='button';
  action.className='publish-ai-wizard__edit-publish';
  action.textContent='Редактировать и опубликовать';
  action.hidden=!currentDocument;
  controlPanel.append(action);

  function setDocument(doc){
    currentDocument=doc?.schemaVersion===1&&Array.isArray(doc.blocks)?doc:null;
    action.hidden=!currentDocument;
  }

  function loadPostDocument(doc){
    const editor=window.CosmoRichEditor;
    if(!editor?.restoreDraft)return false;
    const value=DRAFT_PREFIX+JSON.stringify({version:2,document:doc});
    return editor.restoreDraft(value)===true;
  }

  action.addEventListener('click',()=>{
    if(!currentDocument)return;
    if(!loadPostDocument(currentDocument)){
      window.Telegram?.WebApp?.showAlert?.('Редактор ещё не готов. Попробуйте ещё раз.');
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
    window.CosmoSofaDraft?.flush?.('ai-post-to-editor');
  });

  window.addEventListener('cosmo-ai-post-document',event=>setDocument(event.detail?.document));
  window.CosmoAiPostEditorTransfer=Object.freeze({loadPostDocument});
})();
