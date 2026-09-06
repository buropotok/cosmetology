(()=>{
  const addButton=document.querySelector('#composer-add-photo');
  const text=document.querySelector('#text');
  const status=document.querySelector('#status');
  if(!addButton||!text)return;

  const generateButton=document.createElement('button');
  generateButton.type='button';
  generateButton.id='composer-generate-photo';
  generateButton.textContent='✨ Сгенерировать фото';
  addButton.after(generateButton);

  generateButton.addEventListener('click',async()=>{
    const postText=text.value.trim();
    if(!postText){
      if(status){status.textContent='Сначала введите текст публикации.';status.className='error'}
      text.focus();
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

    const original=generateButton.textContent;
    generateButton.disabled=true;
    generateButton.textContent='Генерируем…';
    if(status){status.textContent='Gemini создаёт изображение по тексту публикации…';status.className=''}
    try{
      const response=await fetch('/api/miniapp/ai/image',{
        method:'POST',
        headers:{Authorization:`tma ${webApp.initData}`,'content-type':'application/json'},
        body:JSON.stringify({text:postText}),
      });
      if(!response.ok){
        const result=await response.json().catch(()=>null);
        throw new Error(result?.error?.message||'Не удалось сгенерировать изображение.');
      }
      const blob=await response.blob();
      if(!blob.type.startsWith('image/'))throw new Error('Gemini вернул некорректное изображение.');
      const extension=blob.type==='image/jpeg'?'jpg':blob.type==='image/webp'?'webp':'png';
      const file=new File([blob],`gemini-${Date.now()}.${extension}`,{type:blob.type,lastModified:Date.now()});
      window.CosmoComposerImages?.addFiles?.([file]);
      if(status){status.textContent='Изображение сгенерировано и добавлено к публикации.';status.className='success'}
      webApp.HapticFeedback?.notificationOccurred('success');
    }catch(error){
      if(status){status.textContent=error instanceof Error?error.message:'Не удалось сгенерировать изображение.';status.className='error'}
      webApp.HapticFeedback?.notificationOccurred('error');
    }finally{
      generateButton.disabled=false;
      generateButton.textContent=original;
    }
  });
})();
