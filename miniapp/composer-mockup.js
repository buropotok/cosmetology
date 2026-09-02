(()=>{
  const composer=document.querySelector('#composer-screen');
  const form=document.querySelector('#publish-form');
  const imageInput=document.querySelector('#image');
  const previewWrap=document.querySelector('#preview-wrap');
  const text=document.querySelector('#text');
  const publish=document.querySelector('#publish');
  const publishVk=document.querySelector('#publish-vk');
  const status=document.querySelector('#status');
  const settings=document.querySelector('#open-settings');
  if(!composer||!form||!imageInput||!text||!publish||!publishVk)return;

  composer.classList.add('approved-composer');
  const topbar=composer.querySelector('.topbar');
  if(topbar){
    topbar.className='composer-nav';
    topbar.querySelector('.eyebrow')?.remove();
    const h1=topbar.querySelector('h1');if(h1)h1.textContent='Новый пост';
    if(settings){settings.className='composer-gear';settings.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" fill="currentColor"/></svg>';}
  }

  const photoLabel=document.createElement('div');photoLabel.className='composer-label';photoLabel.textContent='Фото';form.before(photoLabel);
  const photoCard=document.createElement('section');photoCard.className='composer-card composer-photo-card';photoCard.innerHTML=`<label class="composer-image" for="image"><div><svg class="composer-photo-icon" viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="10" width="34" height="28" rx="5" fill="none" stroke="#555b64" stroke-width="2.2"/><circle cx="18" cy="20" r="3.5" fill="none" stroke="#555b64" stroke-width="2.2"/><path d="M10 34l9-9 7 7 5-5 7 7" fill="none" stroke="#555b64" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><b>Фото для поста</b><small>До 10 изображений для Telegram и VK</small></div></label><div class="composer-image-actions"><button type="button" id="composer-add-photo">＋ Добавить фото</button></div>`;
  form.before(photoCard);photoCard.after(imageInput);photoCard.querySelector('#composer-add-photo')?.addEventListener('click',()=>imageInput.click());
  if(previewWrap){previewWrap.classList.add('composer-preview-wrap');imageInput.after(previewWrap);}

  const publicationLabel=document.createElement('div');publicationLabel.className='composer-label';publicationLabel.textContent='Публикация';previewWrap.after(publicationLabel);
  const editor=document.createElement('section');editor.className='composer-card composer-editor';
  const toolbar=document.createElement('div');toolbar.className='composer-toolbar';toolbar.setAttribute('aria-label','Форматирование');toolbar.innerHTML=`<button type="button" class="composer-tool" title="Отменить"><svg viewBox="0 0 24 24"><path d="M9 7 4 12l5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/></svg></button><button type="button" class="composer-tool" title="Повторить"><svg viewBox="0 0 24 24"><path d="m15 7 5 5-5 5"/><path d="M19 12h-8a6 6 0 0 0-6 6"/></svg></button><div class="composer-tool-menu"><button type="button" class="composer-tool composer-menu-trigger">Aa</button><div class="composer-tool-panel"><button type="button" class="composer-menu-item"><span>T</span>Текст</button><button type="button" class="composer-menu-item"><span>H</span>Заголовок</button><button type="button" class="composer-menu-item"><span>“</span>Цитата</button></div></div><div class="composer-tool-menu"><button type="button" class="composer-tool composer-bold-tool composer-menu-trigger">B</button><div class="composer-tool-panel"><button type="button" class="composer-menu-item"><b>B</b>Жирный</button><button type="button" class="composer-menu-item"><i>I</i>Курсив</button><button type="button" class="composer-menu-item"><u>U</u>Подчёркнутый</button><button type="button" class="composer-menu-item"><s>S</s>Зачёркнутый</button><button type="button" class="composer-menu-item"><span>A⠿</span>Спойлер</button></div></div><div class="composer-tool-menu"><button type="button" class="composer-tool composer-menu-trigger" title="Списки"><svg viewBox="0 0 24 24"><path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="17" r="1" fill="currentColor" stroke="none"/></svg></button><div class="composer-tool-panel"><button type="button" class="composer-menu-item"><span>1.</span>Нумерованный список</button><button type="button" class="composer-menu-item"><span>•</span>Маркированный список</button><button type="button" class="composer-menu-item"><span>⌄</span>Выпадающий список</button></div></div><div class="composer-tool-menu"><button type="button" class="composer-tool composer-menu-trigger" title="Ссылка"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg></button><div class="composer-tool-panel composer-tool-panel-right"><button type="button" class="composer-menu-item"><span>🔗</span>Текстовая ссылка</button><button type="button" class="composer-menu-item"><span>•••</span>Кнопка</button></div></div><button type="button" class="composer-tool" title="Изображение"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.5"/><path d="m4 18 5-5 4 4 2-2 5 4"/></svg></button><button type="button" class="composer-tool" title="Emoji"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1 1.5 2.1 2.2 3.5 2.2s2.5-.7 3.5-2.2"/><path d="M9 9h.01M15 9h.01"/></svg></button>`;
  text.className='composer-bodytext';text.placeholder='Введите текст публикации…';
  const editorFooter=document.createElement('div');editorFooter.className='composer-editor-footer';editorFooter.innerHTML='<button type="button" class="composer-clear">Очистить</button><div class="composer-count">0 символов</div>';
  publicationLabel.after(editor);editor.append(toolbar,text,editorFooter);
  editorFooter.querySelector('.composer-clear').addEventListener('click',()=>{text.value='';text.dispatchEvent(new Event('input',{bubbles:true}));});
  const count=editorFooter.querySelector('.composer-count');const updateCount=()=>count.textContent=`${text.value.length} символов`;text.addEventListener('input',updateCount);updateCount();

  const bottom=document.createElement('div');bottom.className='composer-bottom';editor.after(bottom);
  const telegramPreview=document.createElement('button');telegramPreview.type='button';telegramPreview.className='composer-telegram-preview';telegramPreview.textContent='Предпросмотр в Telegram';
  bottom.append(telegramPreview,publish,publishVk);if(status)bottom.after(status);
  publish.type='submit';publish.setAttribute('form','publish-form');publish.hidden=false;publishVk.hidden=false;

  telegramPreview.addEventListener('click',async()=>{
    const webApp=window.Telegram?.WebApp;
    if(!webApp?.initData){status.textContent='Откройте Mini App внутри Telegram.';status.className='error';return}
    const images=Array.from(imageInput.files||[]).slice(0,10);
    if(!text.value.trim()&&!images.length){status.textContent='Добавьте текст или изображение.';status.className='error';return}
    telegramPreview.disabled=true;telegramPreview.textContent='Проверяем…';
    const guard=window.CosmoSofaAccount?.requireTelegramPreview;
    if(typeof guard==='function'){const state=await guard();if(!state){telegramPreview.disabled=false;telegramPreview.textContent='Предпросмотр в Telegram';return}}
    telegramPreview.textContent='Отправляем предпросмотр…';status.textContent='Отправляем в личный чат с персональным ботом…';status.className='';
    const body=new FormData();body.set('text',text.value);images.forEach(file=>body.append('images',file,file.name));
    try{const response=await fetch('/api/miniapp/preview',{method:'POST',headers:{Authorization:`tma ${webApp.initData}`},body});const result=await response.json().catch(()=>null);if(!response.ok)throw new Error(result?.error?.message||'Не удалось отправить предпросмотр.');status.textContent='Предпросмотр отправлен в личный чат с персональным ботом.';status.className='success';webApp.HapticFeedback?.notificationOccurred('success')}
    catch(error){status.textContent=error instanceof Error?error.message:'Не удалось отправить предпросмотр.';status.className='error';webApp.HapticFeedback?.notificationOccurred('error')}
    finally{telegramPreview.disabled=false;telegramPreview.textContent='Предпросмотр в Telegram'}
  });

  toolbar.querySelectorAll('.composer-menu-trigger').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();const menu=btn.closest('.composer-tool-menu');toolbar.querySelectorAll('.composer-tool-menu.open').forEach(x=>{if(x!==menu)x.classList.remove('open')});menu.classList.toggle('open')}));
  toolbar.querySelectorAll('.composer-tool-panel').forEach(panel=>panel.addEventListener('click',e=>e.stopPropagation()));
  document.addEventListener('click',()=>toolbar.querySelectorAll('.composer-tool-menu.open').forEach(x=>x.classList.remove('open')));
})();
