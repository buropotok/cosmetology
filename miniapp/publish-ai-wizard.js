(()=>{
  const screen=document.querySelector('#composer-screen');
  const composerContent=document.querySelector('#composer-content');
  if(!screen||!composerContent||document.querySelector('#publish-ai-wizard'))return;

  const tg=window.Telegram?.WebApp;
  const root=document.createElement('section');
  root.id='publish-ai-wizard';
  root.className='publish-ai-wizard';
  root.setAttribute('aria-label','Cosmo Sofa AI');
  root.innerHTML=`
    <div class="publish-ai-wizard__header">
      <span class="publish-ai-wizard__logo" aria-hidden="true">✦</span>
      <div><strong>Cosmo Sofa AI</strong><span>Подготовит идею, текст и изображение</span></div>
    </div>
    <div class="publish-ai-wizard__presets" role="group" aria-label="Темы">
      <button type="button" class="is-active">✨ Идея дня</button>
      <button type="button">Новости</button>
      <button type="button">Мифы</button>
      <button type="button">Интересные факты</button>
      <button type="button">Научпоп</button>
      <button type="button">Разбор препарата</button>
      <button type="button">Уход</button>
    </div>
    <form class="publish-ai-wizard__prompt">
      <input type="text" placeholder="Введите свою идею" aria-label="Своя идея" autocomplete="off">
      <button type="submit" aria-label="Отправить идею">↑</button>
    </form>
    <div class="publish-ai-wizard__response" aria-live="polite" aria-label="Ответ Cosmo Sofa AI">
      <div class="publish-ai-wizard__response-label">Ответ Cosmo Sofa AI</div>
      <div class="publish-ai-wizard__response-body" data-ai-response>
        <span class="publish-ai-wizard__response-placeholder">Здесь появится ответ AI</span>
      </div>
    </div>
    <button type="button" class="publish-ai-wizard__manual">
      <img src="/assets/icons/manual-edit.svg" alt="" aria-hidden="true">
      <span>Ручное создание публикации</span>
    </button>`;

  composerContent.insertAdjacentElement('beforebegin',root);

  const responseBody=root.querySelector('[data-ai-response]');
  const promptForm=root.querySelector('.publish-ai-wizard__prompt');
  const promptInput=promptForm?.querySelector('input');
  const promptButton=promptForm?.querySelector('button');

  function setResponse(value){
    if(!responseBody)return;
    const text=typeof value==='string'?value.trim():'';
    responseBody.replaceChildren();
    if(!text){
      const placeholder=document.createElement('span');
      placeholder.className='publish-ai-wizard__response-placeholder';
      placeholder.textContent='Здесь появится ответ AI';
      responseBody.append(placeholder);
      return;
    }
    const content=document.createElement('div');
    content.className='publish-ai-wizard__response-text';
    content.textContent=text;
    responseBody.append(content);
  }

  function setPending(pending){
    if(promptInput)promptInput.disabled=pending;
    if(promptButton)promptButton.disabled=pending;
    root.classList.toggle('is-pending',pending);
  }

  async function sendAiMessage(message){
    if(!message)return;
    tg?.HapticFeedback?.impactOccurred?.('light');
    setPending(true);
    setResponse('Генерирую ответ…');
    try{
      const response=await fetch('/api/miniapp/ai/chat',{
        method:'POST',
        headers:{Authorization:`tma ${tg?.initData||''}`,'content-type':'application/json'},
        body:JSON.stringify({message})
      });
      const result=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(result?.error?.message||'Не удалось получить ответ AI.');
      if(typeof result?.text!=='string'||!result.text.trim())throw new Error('AI вернул пустой ответ.');
      setResponse(result.text);
      window.dispatchEvent(new CustomEvent('cosmo-ai-wizard-response',{detail:{text:result.text}}));
      tg?.HapticFeedback?.notificationOccurred?.('success');
    }catch(error){
      setResponse(error instanceof Error?error.message:'Не удалось получить ответ AI.');
      tg?.HapticFeedback?.notificationOccurred?.('error');
    }finally{
      setPending(false);
    }
  }

  function setMode(mode){
    const wizardMode=mode==='wizard';
    root.hidden=!wizardMode;
    composerContent.hidden=wizardMode;
    screen.dataset.publishMode=mode;
    window.dispatchEvent(new CustomEvent('cosmo-publish-mode',{detail:{mode}}));
  }

  const presetButtons=[...root.querySelectorAll('.publish-ai-wizard__presets button')];
  presetButtons.forEach(button=>button.addEventListener('click',()=>{
    presetButtons.forEach(item=>item.classList.toggle('is-active',item===button));
  }));

  promptForm?.addEventListener('submit',event=>{
    event.preventDefault();
    const message=promptInput?.value.trim();
    if(!message){promptInput?.focus();return;}
    window.dispatchEvent(new CustomEvent('cosmo-ai-wizard-submit',{detail:{message}}));
    void sendAiMessage(message);
  });

  root.querySelector('.publish-ai-wizard__manual')?.addEventListener('click',()=>{
    setMode('compose');
    document.querySelector('#text')?.focus();
    window.dispatchEvent(new CustomEvent('cosmo-ai-wizard-manual'));
  });

  window.addEventListener('cosmo-ai-wizard-response',event=>setResponse(event.detail?.text));
  window.addEventListener('cosmo-ai-wizard-use-post',()=>setMode('compose'));
  window.addEventListener('cosmo-ai-wizard-reset',()=>{
    setResponse('');
    setPending(false);
    setMode('wizard');
  });
  setMode('wizard');
})();
