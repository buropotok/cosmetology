// Shared markup and menu lifecycle for the Composer and signature editors.
export function createRichEditorToolbar(){
  const toolbar=document.createElement('div');
  toolbar.className='composer-toolbar';
  toolbar.setAttribute('aria-label','Форматирование');
  toolbar.innerHTML=`<button type="button" class="composer-tool" title="Отменить"><svg viewBox="0 0 24 24"><path d="M9 7 4 12l5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/></svg></button><button type="button" class="composer-tool" title="Повторить"><svg viewBox="0 0 24 24"><path d="m15 7 5 5-5 5"/><path d="M19 12h-8a6 6 0 0 0-6 6"/></svg></button><div class="composer-tool-menu"><button type="button" class="composer-tool composer-menu-trigger">Aa</button><div class="composer-tool-panel"><button type="button" class="composer-menu-item"><span>T</span>Текст</button><button type="button" class="composer-menu-item"><span>H</span>Заголовок</button><button type="button" class="composer-menu-item"><span>“</span>Цитата</button></div></div><div class="composer-tool-menu"><button type="button" class="composer-tool composer-bold-tool composer-menu-trigger">B</button><div class="composer-tool-panel"><button type="button" class="composer-menu-item"><b>B</b>Жирный</button><button type="button" class="composer-menu-item"><i>I</i>Курсив</button><button type="button" class="composer-menu-item"><u>U</u>Подчёркнутый</button><button type="button" class="composer-menu-item"><s>S</s>Зачёркнутый</button><button type="button" class="composer-menu-item"><span>A⠿</span>Спойлер</button></div></div><div class="composer-tool-menu"><button type="button" class="composer-tool composer-menu-trigger" title="Списки"><svg viewBox="0 0 24 24"><path d="M9 7h11M9 12h11M9 17h11"/><circle cx="4" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="17" r="1" fill="currentColor" stroke="none"/></svg></button><div class="composer-tool-panel"><button type="button" class="composer-menu-item"><span>1.</span>Нумерованный список</button><button type="button" class="composer-menu-item"><span>•</span>Маркированный список</button><button type="button" class="composer-menu-item"><span>⌄</span>Выпадающий список</button></div></div><div class="composer-tool-menu"><button type="button" class="composer-tool composer-menu-trigger" title="Ссылка"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg></button><div class="composer-tool-panel composer-tool-panel-right"><button type="button" class="composer-menu-item"><span>🔗</span>Текстовая ссылка</button><button type="button" class="composer-menu-item"><span>•••</span>Кнопка</button></div></div><button type="button" class="composer-tool" title="Изображение"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.5"/><path d="m4 18 5-5 4 4 2-2 5 4"/></svg></button><button type="button" class="composer-tool" title="Emoji"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1 1.5 2.1 2.2 3.5 2.2s2.5-.7 3.5-2.2"/><path d="M9 9h.01M15 9h.01"/></svg></button>`;
  return toolbar;
}

export function bindRichEditorToolbarMenus(toolbar){
  const clickOutside=()=>toolbar.querySelectorAll('.composer-tool-menu.open').forEach(menu=>menu.classList.remove('open'));
  toolbar.querySelectorAll('.composer-menu-trigger').forEach(button=>button.addEventListener('click',event=>{
    event.stopPropagation();
    const menu=button.closest('.composer-tool-menu');
    toolbar.querySelectorAll('.composer-tool-menu.open').forEach(item=>{if(item!==menu)item.classList.remove('open')});
    menu.classList.toggle('open');
  }));
  toolbar.querySelectorAll('.composer-tool-panel').forEach(panel=>panel.addEventListener('click',event=>event.stopPropagation()));
  document.addEventListener('click',clickOutside);
  return()=>document.removeEventListener('click',clickOutside);
}
