(()=>{
  const api=window.CosmoRichEditor;
  const editor=api?.editor;
  const host=api?.element;
  const root=editor?.view?.dom;
  if(!editor||!(host instanceof HTMLElement)||!(root instanceof HTMLElement))return;

  const text='Введите текст публикации';
  const placeholder=document.createElement('div');
  placeholder.className='composer-tiptap-placeholder';
  placeholder.textContent=text;
  placeholder.setAttribute('aria-hidden','true');
  placeholder.style.cssText='position:absolute;left:3px;top:3px;z-index:1;color:#8e8e93;font:16px/1.5 inherit;pointer-events:none;user-select:none;-webkit-user-select:none';

  if(getComputedStyle(host).position==='static')host.style.position='relative';
  root.setAttribute('aria-placeholder',text);
  host.append(placeholder);

  const render=()=>{placeholder.hidden=!editor.isEmpty};
  const destroy=()=>{
    editor.off('update',render);
    editor.off('destroy',destroy);
    placeholder.remove();
  };

  editor.on('update',render);
  editor.on('destroy',destroy);
  render();
})();
