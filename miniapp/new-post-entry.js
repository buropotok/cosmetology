(()=>{
  const screen=document.querySelector('#composer-screen');
  const wizard=document.querySelector('#publish-ai-wizard');
  const composerContent=document.querySelector('#composer-content');
  if(!screen||!wizard||!composerContent||document.querySelector('#new-post-entry'))return;

  wizard.querySelectorAll('.publish-ai-wizard__manual,.publish-ai-wizard__before-after').forEach(node=>node.remove());

  const style=document.createElement('style');
  style.textContent=`
  .new-post-entry{margin:16px;padding:18px;border-radius:18px;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.08);color:#1c1c1e;text-align:center}
  .new-post-entry[hidden]{display:none!important}
  .new-post-entry__title{margin:0 0 6px;font:700 22px/1.25 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;text-align:center}
  .new-post-entry__subtitle{margin:0 0 18px;color:#8e8e93;font:14px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;text-align:center}
  .new-post-entry__actions{display:grid;gap:10px}
  .new-post-entry__button{width:100%;min-height:56px;position:relative;display:flex;align-items:center;justify-content:center;border:0;border-radius:13px;padding:13px 56px;background:#2d8fd3;color:#fff;font:700 16px/1.25 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;text-align:center}
  .new-post-entry__icon{position:absolute;left:18px;top:50%;transform:translateY(-50%);width:26px;display:flex;align-items:center;justify-content:center;flex:0 0 26px;pointer-events:none}
  .new-post-entry__icon--ai{font-size:25px;line-height:1}
  .new-post-entry__icon img{width:24px;height:24px;display:block}
  .new-post-entry__button--manual .new-post-entry__icon img{width:23px;height:23px}
  .new-post-entry__pair{gap:1px;width:34px}
  .new-post-entry__pair img{width:17px;height:17px;filter:brightness(0) invert(1)}
  @media(max-width:520px){.new-post-entry{margin:12px;padding:15px}.new-post-entry__button{min-height:54px;padding:12px 52px}.new-post-entry__icon{left:15px}}
  `;
  document.head.append(style);

  const entry=document.createElement('section');
  entry.id='new-post-entry';
  entry.className='new-post-entry';
  entry.hidden=true;
  entry.setAttribute('aria-label','Создание нового поста');
  entry.innerHTML=`<h2 class="new-post-entry__title">Новый пост</h2><p class="new-post-entry__subtitle">Выберите способ создания публикации</p><div class="new-post-entry__actions"><button type="button" class="new-post-entry__button" data-new-post-choice="ai"><span class="new-post-entry__icon new-post-entry__icon--ai" aria-hidden="true">✨</span><span>Создать пост с помощью AI</span></button><button type="button" class="new-post-entry__button new-post-entry__button--manual" data-new-post-choice="manual"><span class="new-post-entry__icon" aria-hidden="true"><img src="/assets/icons/manual-edit.svg" alt=""></span><span>Создать пост вручную с нуля</span></button><button type="button" class="new-post-entry__button new-post-entry__button--before-after" data-new-post-choice="before-after"><span class="new-post-entry__icon new-post-entry__pair" aria-hidden="true"><img src="/assets/icons/account-box.svg" alt=""><img src="/assets/icons/account-box.svg" alt=""></span><span>ДО / ПОСЛЕ</span></button></div>`;
  wizard.insertAdjacentElement('beforebegin',entry);

  function showEntry(){
    wizard.hidden=true;
    composerContent.hidden=true;
    entry.hidden=false;
    screen.dataset.publishMode='entry';
    window.dispatchEvent(new CustomEvent('cosmo-publish-mode',{detail:{mode:'entry'}}));
  }
  function hideEntry(){entry.hidden=true}
  function openAi(){
    hideEntry();
    const state=window.CosmoAiWizardState;
    if(state?.restore&&state?.getSnapshot){state.restore({...state.getSnapshot(),screen:'ai'});return}
    wizard.hidden=false;composerContent.hidden=true;screen.dataset.publishMode='wizard';
    window.dispatchEvent(new CustomEvent('cosmo-publish-mode',{detail:{mode:'wizard'}}));
  }
  function openManual(){
    hideEntry();
    wizard.hidden=true;composerContent.hidden=false;screen.dataset.publishMode='compose';
    window.dispatchEvent(new CustomEvent('cosmo-publish-mode',{detail:{mode:'compose'}}));
    window.dispatchEvent(new CustomEvent('cosmo-ai-wizard-manual'));
    document.querySelector('#text')?.focus();
  }
  function openBeforeAfter(){
    hideEntry();
    window.CosmoBeforeAfter?.open?.();
  }

  entry.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-new-post-choice]');
    if(!button)return;
    const choice=button.dataset.newPostChoice;
    if(choice==='ai')openAi();
    else if(choice==='manual')openManual();
    else if(choice==='before-after')openBeforeAfter();
  });

  window.addEventListener('cosmo-ai-wizard-reset',()=>queueMicrotask(showEntry));
  window.addEventListener('cosmo-publish-mode',event=>{if(event.detail?.mode!=='entry')hideEntry()});
  window.addEventListener('cosmo-before-after-close',event=>{if(event.detail?.action==='back')showEntry();else if(event.detail?.action==='save')hideEntry()});
  window.CosmoNewPostEntry=Object.freeze({show:showEntry,hide:hideEntry});
})();
