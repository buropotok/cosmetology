import {createRichEditorToolbar,bindRichEditorToolbarMenus} from './rich-editor-toolbar.js';
import {readSignature,saveSignature} from './post-signature.js';

let activeDialog=null;

export async function openSignatureSettings(onSaved=()=>{}){
  if(activeDialog)return;
  const overlay=document.createElement('div');
  overlay.className='signature-modal-overlay';
  const dialog=document.createElement('section');
  dialog.className='signature-modal-card';
  dialog.setAttribute('role','dialog');
  dialog.setAttribute('aria-modal','true');
  dialog.setAttribute('aria-label','Постоянная подпись');

  const title=document.createElement('h2');
  title.textContent='Постоянная подпись';
  const toolbar=createRichEditorToolbar();
  // Post buttons belong to Composer publishing, not to the signature text.
  toolbar.querySelector('[title="Ссылка"]')?.parentElement?.querySelectorAll('.composer-menu-item')[1]?.remove();
  const host=document.createElement('div');
  host.className='composer-bodytext composer-rich-editor composer-tiptap-editor signature-editor-host';
  const error=document.createElement('p');
  error.className='signature-modal-error';
  error.setAttribute('role','alert');
  const actions=document.createElement('div');
  actions.className='signature-modal-actions';
  const cancel=document.createElement('button');
  cancel.type='button';cancel.className='signature-modal-cancel';cancel.textContent='Отмена';
  const save=document.createElement('button');
  save.type='button';save.textContent='Сохранить';
  actions.append(cancel,save);
  dialog.append(title,toolbar,host,error,actions);
  overlay.append(dialog);
  document.body.append(overlay);
  activeDialog=overlay;

  let editor=null;
  const unbindMenus=bindRichEditorToolbarMenus(toolbar);
  function close(){
    unbindMenus();
    editor?.destroy();
    overlay.remove();
    if(activeDialog===overlay)activeDialog=null;
  }
  cancel.addEventListener('click',close);
  overlay.addEventListener('click',event=>{if(event.target===overlay)close()});
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close()}});
  try{
    const module=await import('/composer-tiptap.js');
    if(activeDialog!==overlay)return;
    editor=module.mountRichTextEditor(host,toolbar,{enableButtons:false,editorLabel:'Постоянная подпись'});
    if(!editor)throw new Error('Редактор недоступен.');
    const saved=readSignature();
    if(saved)editor.setDocument(saved);
    save.addEventListener('click',()=>{
      try{
        saveSignature(editor.toPostDocument());
        onSaved();
        close();
      }catch(cause){error.textContent=cause instanceof Error?cause.message:'Не удалось сохранить подпись.'}
    });
  }catch(cause){
    error.textContent=cause instanceof Error?cause.message:'Не удалось открыть редактор.';
    save.disabled=true;
  }
}
