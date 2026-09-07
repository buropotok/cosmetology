(()=>{
  const AI_CHAT_PATH='/api/miniapp/ai/chat';
  let generationController=null;
  let generationModal=null;

  function ensureStyles(){
    if(document.querySelector('style[data-cosmo-composer-ux]'))return;
    const style=document.createElement('style');
    style.dataset.cosmoComposerUx='';
    style.textContent=`
      .composer-tiptap-editor{position:relative}
      .composer-tiptap-editor.is-cosmo-empty::before{content:'ВВЕДИТЕ ТЕКСТ ПУБЛИКАЦИИ СЮДА...';position:absolute;z-index:1;top:12px;left:12px;right:12px;color:#8e8e93;pointer-events:none;font:500 14px/1.4 inherit}
      .cosmo-ai-generation-modal{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.42)}
      .cosmo-ai-generation-modal[hidden]{display:none!important}
      .cosmo-ai-generation-card{width:min(100%,360px);box-sizing:border-box;padding:24px 20px 18px;border-radius:18px;background:var(--tg-theme-bg-color,#fff);color:var(--tg-theme-text-color,#111);box-shadow:0 20px 60px rgba(0,0,0,.24);text-align:center}
      .cosmo-ai-generation-message{margin:0;font:600 18px/1.35 system-ui,sans-serif}
      .cosmo-ai-generation-dots{display:inline-block;min-width:1.5em;font-weight:800;text-align:left}
      .cosmo-ai-generation-dot{display:inline-block;opacity:.15;animation:cosmo-ai-dot 1.2s infinite steps(1,end)}
      .cosmo-ai-generation-dot:nth-child(2){animation-delay:.3s}.cosmo-ai-generation-dot:nth-child(3){animation-delay:.6s}
      @keyframes cosmo-ai-dot{0%,24%{opacity:.15}25%,74%{opacity:1}75%,100%{opacity:.15}}
      .cosmo-ai-generation-action{width:100%;margin-top:20px;min-height:44px;border:0;border-radius:12px;background:#f1f2f4;color:#333;font:600 16px/1 system-ui,sans-serif;cursor:pointer}
      .cosmo-ai-generation-modal[data-state="error"] .cosmo-ai-generation-dots{display:none}
    `;
    document.head.append(style);
  }

  function activeGenerationCopy(){
    const active=[...document.querySelectorAll('#publish-ai-wizard .publish-ai-wizard__presets button')]
      .find(button=>button.classList.contains('is-active'))?.textContent.trim()||'';
    return active==='Новости'?'Ищем актуальные новости':'Идёт генерация';
  }

  function cancelWizardGeneration(){
    const button=document.querySelector('#publish-ai-wizard.is-pending .publish-ai-wizard__prompt button');
    if(!button)return false;
    button.click();
    return true;
  }

  function ensureModal(){
    if(generationModal)return generationModal;
    const overlay=document.createElement('div');
    overlay.className='cosmo-ai-generation-modal';
    overlay.hidden=true;
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-live','polite');
    overlay.innerHTML=`<div class="cosmo-ai-generation-card"><p class="cosmo-ai-generation-message"><span data-generation-copy>Идёт генерация</span><span class="cosmo-ai-generation-dots" aria-hidden="true"><span class="cosmo-ai-generation-dot">.</span><span class="cosmo-ai-generation-dot">.</span><span class="cosmo-ai-generation-dot">.</span></span></p><button type="button" class="cosmo-ai-generation-action">Отмена</button></div>`;
    const action=overlay.querySelector('.cosmo-ai-generation-action');
    action.addEventListener('click',()=>{
      if(overlay.dataset.state==='error'){hideGenerationModal();return}
      if(cancelWizardGeneration()){hideGenerationModal();return}
      generationController?.abort();
    });
    document.body.append(overlay);
    generationModal=overlay;
    return overlay;
  }

  function showGenerating(controller){
    const modal=ensureModal();
    generationController=controller;
    modal.dataset.state='loading';
    modal.querySelector('[data-generation-copy]').textContent=activeGenerationCopy();
    modal.querySelector('.cosmo-ai-generation-action').textContent='Отмена';
    modal.hidden=false;
  }

  function showGenerationError(){
    const modal=ensureModal();
    generationController=null;
    modal.dataset.state='error';
    modal.querySelector('[data-generation-copy]').textContent='Произошла ошибка генерации 🙁';
    modal.querySelector('.cosmo-ai-generation-action').textContent='Закрыть';
    modal.hidden=false;
  }

  function hideGenerationModal(){
    if(!generationModal)return;
    generationController=null;
    generationModal.hidden=true;
  }

  function isAiChatRequest(input){
    const raw=typeof input==='string'?input:input?.url;
    if(!raw)return false;
    try{return new URL(raw,location.href).pathname===AI_CHAT_PATH}catch{return raw.includes(AI_CHAT_PATH)}
  }

  const nativeFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    if(!isAiChatRequest(input))return nativeFetch(input,init);
    const controller=new AbortController();
    const upstream=init?.signal;
    const abortFromUpstream=()=>controller.abort(upstream?.reason);
    if(upstream){
      if(upstream.aborted)abortFromUpstream();
      else upstream.addEventListener('abort',abortFromUpstream,{once:true});
    }
    showGenerating(controller);
    try{
      const response=await nativeFetch(input,{...init,signal:controller.signal});
      if(response.ok)hideGenerationModal();
      else showGenerationError();
      return response;
    }catch(error){
      if(error?.name==='AbortError')hideGenerationModal();
      else showGenerationError();
      throw error;
    }finally{
      upstream?.removeEventListener?.('abort',abortFromUpstream);
    }
  };

  function syncRichPlaceholder(){
    const host=document.querySelector('.composer-tiptap-editor');
    const editor=host?.querySelector('.tiptap');
    if(!host||!editor)return false;
    const empty=!editor.textContent?.trim();
    host.classList.toggle('is-cosmo-empty',empty);
    return true;
  }

  function watchRichEditor(){
    if(!syncRichPlaceholder()){
      const rootObserver=new MutationObserver(()=>{if(syncRichPlaceholder()){rootObserver.disconnect();watchRichEditor()}});
      rootObserver.observe(document.body,{childList:true,subtree:true});
      return;
    }
    const editor=document.querySelector('.composer-tiptap-editor .tiptap');
    if(!editor)return;
    const observer=new MutationObserver(syncRichPlaceholder);
    observer.observe(editor,{childList:true,subtree:true,characterData:true});
    editor.addEventListener('input',syncRichPlaceholder);
  }

  ensureStyles();
  watchRichEditor();
})();
