(()=>{
  const composer=document.querySelector('#composer-screen');
  const form=document.querySelector('#publish-form');
  const imageInput=document.querySelector('#image');
  const previewWrap=document.querySelector('#preview-wrap');
  const previews=document.querySelector('#previews');
  const removeImage=document.querySelector('#remove-image');
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
    const h1=topbar.querySelector('h1'); if(h1)h1.textContent='Новый пост';
    if(settings){settings.className='composer-gear';settings.innerHTML='⚙︎';}
  }

  composer.querySelector('#account')?.setAttribute('hidden','');
  composer.querySelector('.onboarding')?.setAttribute('hidden','');
  composer.querySelector('.managed-bot-poc')?.setAttribute('hidden','');

  const assistant=document.createElement('section');
  assistant.className='composer-assistant';
  assistant.innerHTML=`<div class="composer-assistant-head"><div class="composer-avatar">✦</div><div><strong>Что публикуем сегодня?</strong><span>Выберите тему или напишите свою</span></div></div><div class="composer-topics"><button type="button" class="composer-chip hot">✨ Идея дня</button><button type="button" class="composer-chip">Новости</button><button type="button" class="composer-chip">Мифы</button><button type="button" class="composer-chip">Интересные факты</button><button type="button" class="composer-chip">Научпоп</button><button type="button" class="composer-chip">Разбор препарата</button><button type="button" class="composer-chip">Уход</button></div><div class="composer-prompt"><input placeholder="Своя тема или пожелание…"><button type="button">↑</button></div>`;
  form.before(assistant);

  const photoLabel=document.createElement('div');photoLabel.className='composer-label';photoLabel.textContent='Фото';form.before(photoLabel);
  const photoCard=document.createElement('section');photoCard.className='composer-card composer-photo-card';
  photoCard.innerHTML=`<label class="composer-image" for="image"><div><svg class="composer-photo-icon" viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="10" width="34" height="28" rx="5" fill="none" stroke="#555b64" stroke-width="2.2"/><circle cx="18" cy="20" r="3.5" fill="none" stroke="#555b64" stroke-width="2.2"/><path d="M10 34l9-9 7 7 5-5 7 7" fill="none" stroke="#555b64" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><b>Фото для поста</b><small>До 10 изображений для Telegram и VK</small></div></label><div class="composer-image-actions"><button type="button" id="composer-add-photo">＋ Добавить фото</button><button type="button" class="composer-ai-photo">✦ Создать с AI</button></div>`;
  form.before(photoCard);photoCard.after(imageInput);imageInput.hidden=false;
  photoCard.querySelector('#composer-add-photo')?.addEventListener('click',()=>imageInput.click());

  if(previewWrap){previewWrap.classList.add('composer-preview-wrap');imageInput.after(previewWrap);}

  const tabs=document.createElement('div');tabs.className='composer-tabs';tabs.innerHTML=`<button type="button" class="composer-tab active" data-platform="telegram"><img class="composer-brand-logo" src="https://telegram.org/img/t_logo.png" alt="">Telegram</button><button type="button" class="composer-tab" data-platform="vk"><svg class="composer-brand-logo composer-vk-logo" viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="12" fill="#0077FF"/><path fill="#fff" d="M25.6 34.2C14.7 34.2 8.5 26.7 8.2 14.2h5.5c.2 9.2 4.2 13.1 7.3 13.9V14.2h5.2v7.9c3-.3 6.2-3.9 7.3-7.9h5.2c-.8 4.9-4.4 8.5-7 10 2.6 1.2 6.8 4.4 8.4 10h-5.8c-1.2-3.8-4.1-6.7-8.1-7.1v7.1h-.6Z"/></svg>ВКонтакте</button>`;previewWrap?.after(tabs);
  const publicationLabel=document.createElement('div');publicationLabel.className='composer-label';publicationLabel.textContent='Публикация';tabs.after(publicationLabel);

  const editor=document.createElement('section');editor.className='composer-card composer-editor';
  const toolbar=document.createElement('div');toolbar.className='composer-toolbar';toolbar.setAttribute('aria-label','Форматирование');
  toolbar.innerHTML=`<button type="button" class="composer-tool" title="Отменить"><svg viewBox="0 0 24 24"><path d="M9 7 4 12l5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/></svg></button><button type="button" class="composer-tool" title="Повторить"><svg viewBox="0 0 24 24"><path d="m15 7 5 5-5 5"/><path d="M19 12h-8a6 6 0 0 0-6 6"/></svg></button><div class="composer-tool-menu"><button type="button" class="composer-tool composer-text-tool composer-menu-trigger">Aa</button><div class="composer-tool-panel"><button type="button" class="composer-menu-item"><span>T</span>Текст</button><button type="button" class="composer-menu-item"><span>H</span>Заголовок</button><button type="button" class="composer-menu-item"><span>“</span>Цитата</button></div></div><div class="composer-tool-menu"><button type="button" class="composer-tool composer-bold-tool composer-menu-trigger">B</button><div class="composer-tool-panel composer-format-panel"><button type="button" class="composer-menu-item"><b>B</b>Жирный</button><button type="button" class="composer-menu-item"><i>I</i>Курсив</button><button type="button" class="composer-menu-item"><u>U</u>Подчёркнутый</button><button type="button" class="composer-menu-item"><s>S</s>Зачёркнутый</button><button type="button" class="composer-menu-item"><span>A⠿</span>Спойлер</button></div></div><div class="composer-tool-menu"><button type="button" class="composer-tool composer-menu-trigger" title="Списки"><svg viewBox="0 0 24 24"><path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="17" r="1" fill="currentColor" stroke="none"/></svg></button><div class="composer-tool-panel"><button type="button" class="composer-menu-item"><span>1.</span>Нумерованный список</button><button type="button" class="composer-menu-item"><span>•</span>Маркированный список</button><button type="button" class="composer-menu-item"><span>⌄</span>Выпадающий список</button></div></div><div class="composer-tool-menu"><button type="button" class="composer-tool composer-menu-trigger" title="Ссылка"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg></button><div class="composer-tool-panel composer-tool-panel-right"><button type="button" class="composer-menu-item"><span>🔗</span>Текстовая ссылка</button><button type="button" class="composer-menu-item"><span>•••</span>Кнопка</button></div></div><button type="button" class="composer-tool" title="Изображение"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.5"/><path d="m4 18 5-5 4 4 2-2 5 4"/></svg></button><button type="button" class="composer-tool" title="Emoji"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1 1.5 2.1 2.2 3.5 2.2s2.5-.7 3.5-2.2"/><path d="M9 9h.01M15 9h.01"/></svg></button>`;
  text.className='composer-bodytext';text.placeholder='Введите текст публикации…';
  const editorFooter=document.createElement('div');editorFooter.className='composer-editor-footer';editorFooter.innerHTML='<button type="button" class="composer-clear">Очистить</button><div class="composer-count">0 символов</div>';
  publicationLabel.after(editor);editor.append(toolbar,text,editorFooter);
  editorFooter.querySelector('.composer-clear')?.addEventListener('click',()=>{text.value='';text.dispatchEvent(new Event('input',{bubbles:true}));});
  const count=editorFooter.querySelector('.composer-count');const updateCount=()=>{count.textContent=`${text.value.length} символов`;};text.addEventListener('input',updateCount);updateCount();

  const bottom=document.createElement('div');bottom.className='composer-bottom';editor.after(bottom);bottom.append(publish,publishVk);if(status)bottom.after(status);
  let platform='telegram';
  function renderPlatform(){
    tabs.querySelectorAll('.composer-tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.platform===platform));
    if(platform==='telegram'){publish.hidden=false;publishVk.hidden=true;publish.textContent='Опубликовать в Telegram';}
    else{publish.hidden=true;publishVk.hidden=false;publishVk.textContent='Опубликовать в ВКонтакте';}
  }
  tabs.addEventListener('click',e=>{const btn=e.target.closest('.composer-tab');if(!btn)return;platform=btn.dataset.platform;renderPlatform();});renderPlatform();

  toolbar.querySelectorAll('.composer-menu-trigger').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();const menu=btn.closest('.composer-tool-menu');toolbar.querySelectorAll('.composer-tool-menu.open').forEach(x=>{if(x!==menu)x.classList.remove('open')});menu.classList.toggle('open');}));
  toolbar.querySelectorAll('.composer-tool-panel').forEach(panel=>panel.addEventListener('click',e=>e.stopPropagation()));
  document.addEventListener('click',()=>toolbar.querySelectorAll('.composer-tool-menu.open').forEach(x=>x.classList.remove('open')));
})();