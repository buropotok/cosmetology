(()=>{
  const screen=document.querySelector('#composer-screen');
  const wizard=document.querySelector('#publish-ai-wizard');
  const composerContent=document.querySelector('#composer-content');
  if(!screen||!wizard||!composerContent||window.CosmoComposerView)return;

  wizard.querySelectorAll('.publish-ai-wizard__manual,.publish-ai-wizard__before-after').forEach(node=>node.remove());

  const style=document.createElement('style');
  style.textContent=`
  .new-post-entry{margin:16px;padding:6px 18px;border-radius:18px;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.08);color:#1c1c1e;text-align:center}
  .new-post-entry[hidden]{display:none!important}
  .new-post-entry__title{margin:0 0 6px;font:700 22px/1.25 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;text-align:center}
  .new-post-entry__subtitle{margin:0 0 18px;color:#8e8e93;font:14px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;text-align:center}
  .new-post-entry__actions{display:grid;gap:10px}
  .new-post-entry__button{width:100%;min-height:56px;position:relative;display:flex;align-items:center;justify-content:center;border:0;border-radius:13px;padding:13px 56px;background:#2d8fd3;color:#fff;font:700 16px/1.25 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;text-align:center}
  .new-post-entry__icon{position:absolute;left:18px;top:50%;transform:translateY(-50%);width:26px;display:flex;align-items:center;justify-content:center;flex:0 0 26px;pointer-events:none}
  .new-post-entry__icon--ai{font-size:25px;line-height:1}
  .new-post-entry__icon img{width:24px;height:24px;display:block}
  .new-post-entry__button--manual .new-post-entry__icon img{width:23px;height:23px}
  .new-post-entry__pair{gap:2px;width:54px}
  .new-post-entry__pair img{width:26px;height:26px;filter:brightness(0) invert(1)}
  @media(max-width:520px){.new-post-entry{margin:12px;padding:5px 15px}.new-post-entry__button{min-height:54px;padding:12px 52px}.new-post-entry__icon{left:15px}}
  `;
  document.head.append(style);

  const controls=document.createElement('section');
  controls.id='new-post-entry';
  controls.className='new-post-entry';
  controls.hidden=true;
  controls.setAttribute('aria-label','Создание нового поста');
  controls.innerHTML=`<h2 class="new-post-entry__title">Новый пост</h2><p class="new-post-entry__subtitle">Выберите способ создания публикации</p><div class="new-post-entry__actions"><button type="button" class="new-post-entry__button" data-new-post-choice="ai"><span class="new-post-entry__icon new-post-entry__icon--ai" aria-hidden="true">✨</span><span>Создать пост с помощью AI</span></button><button type="button" class="new-post-entry__button new-post-entry__button--manual" data-new-post-choice="manual"><span class="new-post-entry__icon" aria-hidden="true"><img src="/assets/icons/manual-edit.svg" alt=""></span><span>Создать пост вручную с нуля</span></button><button type="button" class="new-post-entry__button new-post-entry__button--before-after" data-new-post-choice="before-after"><span class="new-post-entry__icon new-post-entry__pair" aria-hidden="true"><img src="/assets/icons/account-box.svg" alt=""><img src="/assets/icons/account-box.svg" alt=""></span><span>ДО / ПОСЛЕ</span></button></div>`;
  wizard.insertAdjacentElement('beforebegin',controls);

  function publishMode(mode){
    screen.dataset.publishMode=mode;
    window.dispatchEvent(new CustomEvent('cosmo-publish-mode',{detail:{mode}}));
  }

  function showEntry(){
    wizard.hidden=true;
    composerContent.hidden=true;
    controls.hidden=false;
    publishMode('entry');
  }

  function showAi(){
    controls.hidden=true;
    const state=window.CosmoAiWizardState;
    if(state?.restore&&state?.getSnapshot){
      state.restore({...state.getSnapshot(),screen:'ai'});
      return;
    }
    wizard.hidden=false;
    composerContent.hidden=true;
    publishMode('wizard');
  }

  function showEditor({manual=false,focus=true}={}){
    controls.hidden=true;
    wizard.hidden=true;
    composerContent.hidden=false;
    publishMode('compose');
    if(manual)window.dispatchEvent(new CustomEvent('cosmo-ai-wizard-manual'));
    if(focus)queueMicrotask(()=>document.querySelector('#text')?.focus());
  }

  controls.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-new-post-choice]');
    if(!button)return;
    const navigation=window.CosmoNavigation;
    if(!navigation)return;
    const choice=button.dataset.newPostChoice;
    if(choice==='ai')void navigation.push(navigation.STATES.AI);
    else if(choice==='manual')void navigation.push(navigation.STATES.PUBLISH,{manual:true});
    else if(choice==='before-after')void navigation.push(navigation.STATES.BEFORE_AFTER);
  });

  window.CosmoComposerView=Object.freeze({showEntry,showAi,showEditor});
})();
