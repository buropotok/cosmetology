import{recordRuntimeDiagnostic}from'/runtime-diagnostics.js';

(()=>{
  const addButton=document.querySelector('#composer-add-photo');
  const text=document.querySelector('#text');
  const status=document.querySelector('#status');
  const composerState=window.CosmoComposerState;
  if(!addButton||!text||!composerState)return;
  if(!document.querySelector('link[data-cosmo-image-search-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/composer-image-search.css';link.dataset.cosmoImageSearchStyle='1';document.head.append(link)}

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
  const trace=(operation,event,statusValue,details,error)=>recordRuntimeDiagnostic({event,stage:'composer.image_acquisition',module:'composer-image-generation',status:statusValue,details:{traceId:operation?.traceId,...details},error});

  const generateButton=document.createElement('button');
  generateButton.type='button';
  generateButton.id='composer-generate-photo';
  addButton.after(generateButton);

  const searchResults=document.createElement('section');
  searchResults.id='composer-image-search-results';
  searchResults.className='composer-image-search-results';
  searchResults.hidden=true;
  generateButton.after(searchResults);

  let requestSequence=0;
  let activeRequest=null;

  function syncButtonLabel(){if(!generateButton.disabled)generateButton.textContent=buttonLabel(currentImageOptions())}
  function isCurrentRequest(operation){return activeRequest===operation&&operation.id===requestSequence&&!operation.controller.signal.aborted}
  function cancelledError(){const error=new Error('Запрос изображения отменён.');error.name='AbortError';return error}
  function assertCurrentRequest(operation){if(!isCurrentRequest(operation))throw cancelledError()}
  function beginRequest(){
    if(activeRequest)activeRequest.controller.abort();
    const id=++requestSequence;
    const operation={id,traceId:`image-${Date.now()}-${id}`,controller:new AbortController()};
    activeRequest=operation;
    return operation;
  }
  function clearSearchResults(){searchResults.replaceChildren();searchResults.hidden=true}
  function cancelActiveRequest({clearResults=false}={}){
    requestSequence+=1;
    const operation=activeRequest;
    activeRequest=null;
    if(operation)trace(operation,'image.cancelled','cancelled');
    operation?.controller.abort();
    if(clearResults)clearSearchResults();
    if(generateButton.disabled){generateButton.disabled=false;syncButtonLabel()}
    if(status){status.textContent='';status.className=''}
  }
  function isExpectedCancellation(error,operation){return operation.controller.signal.aborted||!isCurrentRequest(operation)||error?.name==='AbortError'}
  function sourceHost(value){try{return value?new URL(value).hostname.replace(/^www\./,''):''}catch{return''}}

  syncButtonLabel();
  composerState.subscribe?.(change=>{if(change.fields?.includes?.('imageOptions')){clearSearchResults();syncButtonLabel()}});
  window.addEventListener('cosmo-composer-restore',()=>{clearSearchResults();syncButtonLabel()});
  window.addEventListener('cosmo-new-post',()=>cancelActiveRequest({clearResults:true}));
  window.addEventListener('cosmo-publish-mode',event=>{if(event.detail?.mode!=='compose')cancelActiveRequest({clearResults:true})});
  window.addEventListener('pagehide',()=>cancelActiveRequest({clearResults:true}));

  async function request(path,body,operation,responseType){
    const webApp=window.Telegram?.WebApp;
    const started=performance.now();
    trace(operation,'http.request','started',{method:'POST',path,textLength:String(body.text||'').length,searchProfile:body.searchProfile||'',sourcePolicy:body.sourcePolicy||''});
    let response;
    try{
      response=await fetch(path,{
        method:'POST',
        headers:{Authorization:`tma ${webApp?.initData||''}`,'content-type':'application/json','x-cosmo-trace-id':operation.traceId},
        body:JSON.stringify(body),
        signal:operation.controller.signal,
      });
    }catch(error){
      trace(operation,'http.request','failed',{method:'POST',path,durationMs:Math.round(performance.now()-started)},error);
      throw error;
    }
    trace(operation,'http.response',response.ok?'ok':'error',{method:'POST',path,httpStatus:response.status,durationMs:Math.round(performance.now()-started),contentType:response.headers.get('content-type')||''});
    if(!response.ok){
      const result=await response.json().catch(()=>null);
      const error=new Error(result?.error?.message||'Не удалось получить изображение.');
      error.code=result?.error?.code||'IMAGE_REQUEST_FAILED';
      trace(operation,'http.error_payload','error',{path,errorCode:error.code},error);
      throw error;
    }
    if(responseType==='json')return response.json();
    const blob=await response.blob();
    trace(operation,'http.image_payload','received',{path,mimeType:blob.type,sizeBytes:blob.size});
    if(!blob.type.startsWith('image/'))throw new Error('Сервер вернул некорректное изображение.');
    return blob;
  }

  function addImage(blob,prefix){
    const operation=activeRequest;
    const images=window.CosmoComposerImages;
    const beforeCount=images?.getFiles?.().length||0;
    trace(operation,'image.add','started',{beforeCount,mimeType:blob.type,sizeBytes:blob.size});
    if(beforeCount>=10){
      const error=new Error('Уже добавлено 10 изображений. Удалите одно, чтобы добавить новое.');
      error.code='IMAGE_LIMIT_REACHED';
      throw error;
    }
    const extension=extensionFor(blob.type);
    const file=new File([blob],`${prefix}-${Date.now()}.${extension}`,{type:blob.type,lastModified:Date.now()});
    images?.addFiles?.([file]);
    const afterCount=images?.getFiles?.().length||0;
    if(afterCount<=beforeCount){
      const error=new Error('Не удалось добавить изображение к публикации.');
      error.code='IMAGE_ADD_FAILED';
      throw error;
    }
    trace(operation,'image.add','completed',{beforeCount,afterCount});
  }

  async function generateImage(postText,operation){
    assertCurrentRequest(operation);
    trace(operation,'generation.started','started',{textLength:postText.length});
    if(status){status.textContent='Gemini создаёт изображение по тексту публикации…';status.className=''}
    const blob=await request('/api/miniapp/ai/image',{text:postText},operation,'blob');
    assertCurrentRequest(operation);
    addImage(blob,'gemini');
    assertCurrentRequest(operation);
    if(status){status.textContent='Изображение сгенерировано и добавлено к публикации.';status.className='success'}
    trace(operation,'generation.completed','success');
  }

  function validSearchResult(value){
    if(!value||typeof value!=='object')return false;
    try{
      const imageUrl=new URL(value.imageUrl),thumbnailUrl=new URL(value.thumbnailUrl||value.imageUrl),sourceUrl=new URL(value.sourceUrl);
      return imageUrl.protocol==='https:'&&thumbnailUrl.protocol==='https:'&&sourceUrl.protocol==='https:'&&typeof value.importToken==='string'&&Boolean(value.importToken);
    }catch{return false}
  }

  function setSearchButtonsDisabled(disabled){searchResults.querySelectorAll('button').forEach(button=>{button.disabled=disabled})}

  async function selectSearchResult(result){
    const webApp=window.Telegram?.WebApp;
    if((window.CosmoComposerImages?.getFiles?.().length||0)>=10){
      if(status){status.textContent='Уже добавлено 10 изображений. Удалите одно, чтобы добавить новое.';status.className='error'}
      return;
    }
    const operation=beginRequest();
    generateButton.disabled=true;
    generateButton.textContent='Добавляем…';
    setSearchButtonsDisabled(true);
    if(status){status.textContent='Добавляю выбранное изображение…';status.className=''}
    trace(operation,'search.selection.started','started',{sourceHost:sourceHost(result.sourceUrl)});
    try{
      const blob=await request('/api/miniapp/ai/image/search',{imageUrl:result.imageUrl,importToken:result.importToken},operation,'blob');
      assertCurrentRequest(operation);
      addImage(blob,'web');
      assertCurrentRequest(operation);
      clearSearchResults();
      if(status){status.textContent='Фото добавлено к публикации.';status.className='success'}
      trace(operation,'search.selection.completed','success',{sourceHost:sourceHost(result.sourceUrl)});
      webApp?.HapticFeedback?.notificationOccurred('success');
    }catch(error){
      if(isExpectedCancellation(error,operation)){trace(operation,'search.selection.completed','cancelled',{},error);return}
      trace(operation,'search.selection.completed','failed',{errorCode:error?.code||''},error);
      if(status){status.textContent=error instanceof Error?error.message:'Не удалось добавить выбранное изображение.';status.className='error'}
      webApp?.HapticFeedback?.notificationOccurred('error');
      setSearchButtonsDisabled(false);
    }finally{
      if(activeRequest===operation){activeRequest=null;generateButton.disabled=false;syncButtonLabel()}
    }
  }

  function renderSearchResults(rawImages){
    const images=Array.isArray(rawImages)?rawImages.filter(validSearchResult).slice(0,8):[];
    if(!images.length)return false;
    const head=document.createElement('div');head.className='composer-image-search-head';
    const title=document.createElement('strong');title.textContent='Выберите фото';
    const close=document.createElement('button');close.type='button';close.className='composer-image-search-close';close.setAttribute('aria-label','Закрыть результаты поиска');close.textContent='×';close.addEventListener('click',clearSearchResults);
    head.append(title,close);
    const grid=document.createElement('div');grid.className='composer-image-search-grid';
    images.forEach((result,index)=>{
      const button=document.createElement('button');button.type='button';button.className='composer-image-search-item';button.setAttribute('aria-label',`Выбрать изображение ${index+1}`);
      const image=document.createElement('img');image.loading='lazy';image.alt=result.caption||`Фото ${index+1}`;image.src=result.thumbnailUrl||result.imageUrl;
      if(result.thumbnailUrl&&result.thumbnailUrl!==result.imageUrl)image.addEventListener('error',()=>{if(image.src!==result.imageUrl)image.src=result.imageUrl},{once:true});
      const meta=document.createElement('span');meta.textContent=sourceHost(result.sourceUrl)||'Источник';
      button.append(image,meta);button.addEventListener('click',()=>void selectSearchResult(result));grid.append(button);
    });
    searchResults.replaceChildren(head,grid);searchResults.hidden=false;
    return true;
  }

  async function searchImages(postText,options,operation){
    assertCurrentRequest(operation);
    if(!options.searchProfile||!options.sourcePolicy)throw new Error('Не настроен профиль поиска изображения.');
    clearSearchResults();
    trace(operation,'search.started','started',{textLength:postText.length,internetSearch:true,searchProfile:options.searchProfile,sourcePolicy:options.sourcePolicy});
    if(status){status.textContent=options.sourcePolicy==='official'?'Ищу официальные изображения…':'Ищу изображения в интернете…';status.className=''}
    const result=await request('/api/miniapp/ai/image/search',{text:postText,searchProfile:options.searchProfile,sourcePolicy:options.sourcePolicy},operation,'json');
    assertCurrentRequest(operation);
    if(!renderSearchResults(result?.images)){
      const error=new Error('Подходящие изображения не найдены.');error.code='AI_IMAGE_SEARCH_NOT_FOUND';throw error;
    }
    if(status){status.textContent='Выберите фотографию из найденных вариантов.';status.className='success'}
    trace(operation,'search.completed','success',{resultCount:Array.isArray(result?.images)?result.images.length:0});
  }

  generateButton.addEventListener('click',async()=>{
    const postText=currentPostText();
    if(!postText){if(status){status.textContent='Сначала введите текст публикации.';status.className='error'}focusComposer();return}
    const webApp=window.Telegram?.WebApp;
    if(!webApp?.initData){if(status){status.textContent='Откройте Mini App внутри Telegram.';status.className='error'}return}
    if((window.CosmoComposerImages?.getFiles?.().length||0)>=10){if(status){status.textContent='Уже добавлено 10 изображений. Удалите одно, чтобы добавить новое.';status.className='error'}return}

    const options=currentImageOptions();
    const operation=beginRequest();
    trace(operation,'image.click','started',{internetSearch:options.internetSearch===true,searchProfile:options.searchProfile||'',sourcePolicy:options.sourcePolicy||'',textLength:postText.length,imageCount:window.CosmoComposerImages?.getFiles?.().length||0});
    generateButton.disabled=true;
    generateButton.textContent=options.internetSearch===true?'Ищем…':'Генерируем…';
    try{
      if(options.internetSearch===true)await searchImages(postText,options,operation);
      else await generateImage(postText,operation);
      assertCurrentRequest(operation);
      trace(operation,'image.completed','success');
      webApp.HapticFeedback?.notificationOccurred('success');
    }catch(error){
      if(isExpectedCancellation(error,operation)){trace(operation,'image.completed','cancelled',{},error);return}
      trace(operation,'image.completed','failed',{errorCode:error?.code||''},error);
      if(status){status.textContent=error instanceof Error?error.message:'Не удалось получить изображение.';status.className='error'}
      webApp.HapticFeedback?.notificationOccurred('error');
    }finally{
      if(activeRequest===operation){activeRequest=null;generateButton.disabled=false;syncButtonLabel();trace(operation,'image.ui_restored','completed',{buttonLabel:generateButton.textContent,statusText:status?.textContent||'',statusClass:status?.className||''})}
    }
  });
})();
