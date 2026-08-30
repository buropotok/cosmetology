(()=>{
  const composer=document.querySelector('#composer-screen');
  const form=document.querySelector('#publish-form');
  const text=document.querySelector('#text');
  if(!composer||!form||!text)return;

  const assistant=document.createElement('div');
  assistant.className='composer-assistant-overlay';
  assistant.setAttribute('aria-hidden','true');
  assistant.innerHTML='<div class="composer-topics"><span class="composer-chip hot">✨ Идея дня</span><span class="composer-chip">Новости</span><span class="composer-chip">Мифы</span><span class="composer-chip">Интересные факты</span><span class="composer-chip">Научпоп</span><span class="composer-chip">Разбор препарата</span><span class="composer-chip">Уход</span></div><div class="composer-prompt"><input tabindex="-1" placeholder="Своя тема или пожелание…"><button type="button" tabindex="-1">↑</button></div>';
  composer.appendChild(assistant);

  const toolbar=document.createElement('div');
  toolbar.className='composer-toolbar-visual';
  toolbar.setAttribute('aria-label','Форматирование — будет подключено позже');
  toolbar.innerHTML='<button type="button" tabindex="-1" title="Отменить"><svg viewBox="0 0 24 24"><path d="M9 7 4 12l5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/></svg></button><button type="button" tabindex="-1" title="Повторить"><svg viewBox="0 0 24 24"><path d="m15 7 5 5-5 5"/><path d="M19 12h-8a6 6 0 0 0-6 6"/></svg></button><button type="button" tabindex="-1">Aa</button><button type="button" tabindex="-1" style="font-weight:800;font-size:19px">B</button><button type="button" tabindex="-1" title="Списки"><svg viewBox="0 0 24 24"><path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="17" r="1" fill="currentColor" stroke="none"/></svg></button><button type="button" tabindex="-1" title="Ссылка"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg></button><button type="button" tabindex="-1" title="Emoji"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1 1.5 2.1 2.2 3.5 2.2s2.5-.7 3.5-2.2"/><path d="M9 9h.01M15 9h.01"/></svg></button>';
  form.insertBefore(toolbar,text);

  const upload=document.querySelector('.upload span');
  const uploadSmall=document.querySelector('.upload small');
  if(upload)upload.textContent='Фото для поста';
  if(uploadSmall)uploadSmall.textContent='До 10 изображений для Telegram и VK';
  const publish=document.querySelector('#publish');
  const publishVk=document.querySelector('#publish-vk');
  if(publish)publish.textContent='Опубликовать';
  if(publishVk)publishVk.textContent='Предпросмотр в Telegram';
})();
