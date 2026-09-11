(()=>{
  const addButton=document.querySelector('#composer-add-photo');
  const text=document.querySelector('#text');
  const status=document.querySelector('#status');
  const composerState=window.CosmoComposerState;
  if(!addButton||!text||!composerState)return;

  const currentPostText=()=>{
    try{return (window.CosmoRichEditor?.getPlainText?.()??text.value).trim()}
    catch{return text.value.trim()}
  };
  const focusComposer=()=>{
    const richEditor=window.CosmoRichEditor;
    if(typeof richEditor?.focus==='function')richEditor.focus();
    else text.focus();
  };
  const currentImageOptions=()=>composerState.getSnapshot?.().imageOptions||{internetSearch:false};
  const buttonLabel=options=>options?.internetSearch===true
    ?(options.sourcePolicy==='official'?'🔎 Найти официальное фото':'🔎 Найти фото')
    :'✨ Сгенерировать фото';
  const extensionFor=mimeType=>mimeType==='image/jpeg'?'jpg':mimeType==='image/webp'?'webp':mimeType==='image/gif'?'gif':'png';

  const generateButton=document.createElement('button');
  generateButton.type='button';
  generateButton.id='composer-generate-photo';
  addButton.after(generateButton);

  let requestSequence=0;
  let activeRequest=null;

  function syncButtonLabel(){if(!generateButton.disabled)generateButton.textContent=buttonLabel(currentImageOptions())}
  function isCurrentRequest(operation){return activeRequest===operation&&operation.id===requestSequence&&!operation.controller.signal.aborted}
  function cancelledError(){const error=new Error('Запрос изображения отменён.');error.name='AbortError';return error}
  function assertCurrentRequest(operation){if(!isCurrentRequest(operation))throw cancelledError()}
  function beginRequest(){
    if(activeRequest)activeRequest.controller.abort();
    const operation={id:++requestSequence,controller:new AbortController()};
    activeRequest=operation;
    return operation;
  }
  function cancelActiveRequest(){
    requestSequence+=1;
    const operation=activeRequest;
    activeRequest=null;
    operation?.controller.abort();
    if(generateButton.disabled){generateButton.disabled=false;syncButtonLabel()}
    if(status){status.textContent='';status.className=''}
  }
  function isExpectedCancellation(error,operation){return operation.controller.signal.aborted||!isCurrentRequest(operation)||error?.name==='AbortError'}

  syncButtonLabel();
  composerState.subscribe?.(change=>{if(change.fields?.includes?.('imageOptions'))syncButtonLabel()});
  window.addEventListener('cosmo-composer-restore',syncButtonLabel);
  window.addEventListener('cosmo-new-post',cancelActiveRequest);
  window.addEventListener('cosmo-publish-mode',event=>{if(event.detail?.mode!=='compose')cancelActiveRequest()});
  window.addEventListener('pagehide',cancelActiveRequest);

  async function requestImage(path,body,signal){
    const webApp=window.Telegram?.WebApp;
    const response=await fetch(path,{
      method:'POST',
      headers:{Authorization:`tma ${webApp?.initData||''}`,'content-type':'application/json'},
      body:JSON.stringify(body),
      signal,
    });
    if(!response.ok){
      const result=await response.json().catch(()=>null);
      const error=new Error(result?.error?.message||'Не удалось получить изображение.');
      error.code=result?.error?.code||'IMAGE_REQUEST_FAILED';
      throw error;
    }
    const blob=await response.blob();
    if(!blob.type.startsWith('image/'))throw new Error('Сервер вернул некорректное изображение.');
    return{blob,source:response.headers.get('x-cosmo-image-source')||''};
  }

  function confirmGeneratedFallback(webApp){
    const title='Официальное изображение не найдено';
    const message='Не удалось найти подходящее изображение на официальном сайте производителя, бренда или официального дистрибьютора.';
    if(typeof webApp?.showPopup==='function'){
      return new Promise(resolve=>webApp.showPopup({
        title,
        message,
        buttons:[
          {id:'generate',type:'default',text:'Сгенерировать изображение'},
          {id:'cancel',type:'cancel',text:'Отмена'},
        ],
      },buttonId=>resolve(buttonId==='generate')));
    }
    return Promise.resolve(window.confirm(`${title}\n\n${message}\n\nСгенерировать изображение?`));
  }

  function addImage(blob,prefix){
    const images=window.CosmoComposerImages;
    const beforeCount=images?.getFiles?.().length||0;
    if(beforeCount>=10){
      const error=new Error('Уже добавлено 10 изображений. Удалите одно, чтобы добавить новое.');
      error.code='IMAGE_LIMIT_REACHED';
      throw error;
    }
    const extension=extensionFor(blob.type);
    const file=new File([blob],`${prefix}-${Date.now()}.${extension}`,{type:blob.type,lastModified:Date.now()});
    images?.addFiles?.([file]);
    if((images?.getFiles?.().length||0)<=beforeCount){
      const error=new Error('Не удалось добавить изображение к публикации.');
      error.code='IMAGE_ADD_FAILED';
      throw error;
    }
  }

  async function generateImage(postText,operation){
    assertCurrentRequest(operation);
    if(status){status.textContent='Gemini создаёт изображение по тексту публикации…';status.className=''}
    const {blob}=await requestImage('/api/miniapp/ai/image',{text:postText},operation.controller.signal);
    assertCurrentRequest(operation);
    addImage(blob,'gemini');
    assertCurrentRequest(operation);
    if(status){status.textContent='Изображение сгенерировано и добавлено к публикации.';status.className='success'}
  }

  async function searchImage(postText,options,operation){
    assertCurrentRequest(operation);
    if(!options.searchProfile||!options.sourcePolicy)throw new Error('Не настроен профиль поиска изображения.');
    if(status){status.textContent=options.sourcePolicy==='official'?'Ищу официальное изображение…':'Ищу изображение в интернете…';status.className=''}
    const {blob,source}=await requestImage('/api/miniapp/ai/image/search',{
      text:postText,
      searchProfile:options.searchProfile,
      sourcePolicy:options.sourcePolicy,
    },operation.controller.signal);
    assertCurrentRequest(operation);
    addImage(blob,'official');
    assertCurrentRequest(operation);
    if(status){
      let sourceHost='';
      try{sourceHost=source?new URL(source).hostname.replace(/^www\./,''):''}catch{}
      status.textContent=sourceHost?`Официальное фото найдено на ${sourceHost} и добавлено к публикации.`:'Официальное фото найдено и добавлено к публикации.';
      status.className='success';
    }
  }

  generateButton.addEventListener('click',async()=>{
    const postText=currentPostText();
    if(!postText){
      if(status){status.textContent='Сначала введите текст публикации.';status.className='error'}
      focusComposer();
      return;
    }
    const webApp=window.Telegram?.WebApp;
    if(!webApp?.initData){
      if(status){status.textContent='Откройте Mini App внутри Telegram.';status.className='error'}
      return;
    }
    if((window.CosmoComposerImages?.getFiles?.().length||0)>=10){
      if(status){status.textContent='Уже добавлено 10 изображений. Удалите одно, чтобы сгенерировать новое.';status.className='error'}
      return;
    }

    const options=currentImageOptions();
    const operation=beginRequest();
    generateButton.disabled=true;
    generateButton.textContent=options.internetSearch===true?'Ищем…':'Генерируем…';
    try{
      if(options.internetSearch===true){
        try{
          await searchImage(postText,options,operation);
        }catch(error){
          assertCurrentRequest(operation);
          if(error?.code!=='AI_IMAGE_SEARCH_NOT_FOUND')throw error;
          if(!await confirmGeneratedFallback(webApp)){
            assertCurrentRequest(operation);
            if(status){status.textContent='Поиск изображения отменён.';status.className=''}
            return;
          }
          assertCurrentRequest(operation);
          await generateImage(postText,operation);
        }
      }else{
        await generateImage(postText,operation);
      }
      assertCurrentRequest(operation);
      webApp.HapticFeedback?.notificationOccurred('success');
    }catch(error){
      if(isExpectedCancellation(error,operation))return;
      if(status){status.textContent=error instanceof Error?error.message:'Не удалось получить изображение.';status.className='error'}
      webApp.HapticFeedback?.notificationOccurred('error');
    }finally{
      if(activeRequest===operation){
        activeRequest=null;
        generateButton.disabled=false;
        syncButtonLabel();
      }
    }
  });
})();
