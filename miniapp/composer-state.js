(()=>{
const signature=files=>files.map(file=>`${file.name}:${file.size}:${file.lastModified}:${file.type}`).join('|');
const DEFAULT_IMAGE_OPTIONS=Object.freeze({internetSearch:false});
function normalizeImageOptions(value){
  if(value?.internetSearch!==true)return DEFAULT_IMAGE_OPTIONS;
  return Object.freeze({
    internetSearch:true,
    searchProfile:typeof value.searchProfile==='string'?value.searchProfile.trim():'',
    sourcePolicy:typeof value.sourcePolicy==='string'?value.sourcePolicy.trim():'',
  });
}
function sameImageOptions(a,b){return a.internetSearch===b.internetSearch&&a.searchProfile===b.searchProfile&&a.sourcePolicy===b.sourcePolicy}

function create({
  imageInput=document.querySelector('#image'),
  getRichEditor=()=>window.CosmoRichEditor,
  getImageManager=()=>window.CosmoComposerImages,
}={}){
  if(!imageInput)throw new Error('ComposerState requires image input');
  const listeners=new Set();
  let version=0,activePhotoIndex=0,platform='telegram',pendingEditorContent=null,imageOptions=DEFAULT_IMAGE_OPTIONS;
  let unsubscribeRichEditor=()=>{};
  let imageSignature=signature(currentImages());

  function currentImages(){return getImageManager()?.getFiles?.()||Array.from(imageInput.files||[]).slice(0,10)}
  function currentContent(){try{return getRichEditor()?.draftValue?.()||pendingEditorContent||''}catch{return pendingEditorContent||''}}
  function currentPlainText(){try{return getRichEditor()?.getPlainText?.()??''}catch{return''}}
  function getSnapshot(){return Object.freeze({content:currentContent(),plainText:currentPlainText(),images:currentImages().slice(),activePhotoIndex,platform,imageOptions,version})}
  function emit(fields,reason){version++;const change=Object.freeze({fields:Object.freeze(fields),reason,version,snapshot:getSnapshot()});listeners.forEach(listener=>listener(change))}
  function onContent(){pendingEditorContent=null;emit(['content'],'content')}
  function onImages(){const next=signature(currentImages());if(next===imageSignature)return;imageSignature=next;activePhotoIndex=Math.min(activePhotoIndex,Math.max(currentImages().length-1,0));emit(['images','activePhotoIndex'],'images')}
  function restoreEditorContent(editor,value){if(typeof value!=='string')return false;if(editor?.restoreDraft?.(value))return true;editor?.restorePlain?.(value);return Boolean(editor?.restorePlain)}
  function bindRichEditor(){unsubscribeRichEditor();const editor=getRichEditor();if(editor&&pendingEditorContent!==null){const pending=pendingEditorContent;pendingEditorContent=null;restoreEditorContent(editor,pending)}unsubscribeRichEditor=editor?.subscribe?.(()=>onContent())||(()=>{})}
  function onRichReady(){bindRichEditor()}

  imageInput.addEventListener('change',onImages);
  window.addEventListener('cosmo-rich-ready',onRichReady);
  bindRichEditor();

  const api={
    getSnapshot,
    getVersion:()=>version,
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)},
    setActivePhotoIndex(value){const next=Math.min(Math.max(Number(value)||0,0),Math.max(currentImages().length-1,0));if(next===activePhotoIndex)return;activePhotoIndex=next;emit(['activePhotoIndex'],'active-photo')},
    setPlatform(value){const next=value==='vk'?'vk':'telegram';if(next===platform)return;platform=next;emit(['platform'],'platform')},
    setImageOptions(value){const next=normalizeImageOptions(value);if(sameImageOptions(next,imageOptions))return;imageOptions=next;emit(['imageOptions'],'image-options')},
    restore(snapshot={}){
      pendingEditorContent=typeof snapshot.content==='string'?snapshot.content:null;
      const editor=getRichEditor();
      if(editor&&pendingEditorContent!==null){const pending=pendingEditorContent;pendingEditorContent=null;restoreEditorContent(editor,pending)}
      getImageManager()?.replaceFiles?.(Array.isArray(snapshot.images)?snapshot.images:[]);
      platform=snapshot.platform==='vk'?'vk':'telegram';
      imageOptions=normalizeImageOptions(snapshot.imageOptions);
      activePhotoIndex=Math.min(Math.max(Number(snapshot.activePhotoIndex)||0,0),Math.max(currentImages().length-1,0));
      imageSignature=signature(currentImages());version++;
      window.dispatchEvent(new CustomEvent('cosmo-composer-restore',{detail:getSnapshot()}));
    },
    reset(){
      pendingEditorContent=null;
      getRichEditor()?.clear?.();
      getImageManager()?.replaceFiles?.([]);platform='telegram';imageOptions=DEFAULT_IMAGE_OPTIONS;activePhotoIndex=0;imageSignature='';version++;
      window.dispatchEvent(new CustomEvent('cosmo-composer-restore',{detail:getSnapshot()}));
    },
    dispose(){unsubscribeRichEditor();window.removeEventListener('cosmo-rich-ready',onRichReady);imageInput.removeEventListener('change',onImages);listeners.clear()},
  };
  return Object.freeze(api);
}

window.CosmoComposerStateFactory=Object.freeze({create});
window.CosmoComposerState??=create();
})();
