const HINT_TEXT='Смахните вверх, чтобы выйти из режима редактирования текста';

export function createFullscreenEditorHint(root,doc,win){
  let timer=null;
  const hide=()=>{
    if(timer!==null)win.clearTimeout(timer);
    timer=null;
    const hint=root.querySelector('.composer-editor-fullscreen-hint');
    if(hint)hint.remove();
  };
  const show=()=>{
    hide();
    const hint=doc.createElement('div');
    hint.className='composer-editor-fullscreen-hint';
    hint.setAttribute('role','status');
    hint.textContent=HINT_TEXT;
    root.append(hint);
    timer=win.setTimeout(hide,2800);
  };
  return{show,hide,destroy:hide};
}
