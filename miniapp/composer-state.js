(()=>{
const signature=files=>files.map(file=>`${file.name}:${file.size}:${file.lastModified}:${file.type}`).join('|');

function create({
  text=document.querySelector('#text'),
  imageInput=document.querySelector('#image'),
  getRichEditor=()=>window.CosmoRichEditor,
  getImageManager=()=>window.CosmoComposerImages,
}={}){
  if(!text||!imageInput)throw new Error('ComposerState requires composer inputs');
  const listeners=new Set();
  let version=0,activePhotoIndex=0,platform='telegram';
  let imageSignature=signature(currentImages());

  function currentImages(){return getImageManager()?.getFiles?.()||Array.from(imageInput.files||[]).slice(0,10)}
  function currentContent(){try{return getRichEditor()?.draftValue?.()||text.value}catch{return text.value}}
  function getSnapshot(){return Object.freeze({content:currentContent(),plainText:text.value,images:currentImages().slice(),activePhotoIndex,platform,version})}
  function emit(fields,reason){version++;const change=Object.freeze({fields:Object.freeze(fields),reason,version,snapshot:getSnapshot()});listeners.forEach(listener=>listener(change))}
  function onContent(){emit(['content'],'content')}
  function onImages(){const next=signature(currentImages());if(next===imageSignature)return;imageSignature=next;activePhotoIndex=Math.min(activePhotoIndex,Math.max(currentImages().length-1,0));emit(['images','activePhotoIndex'],'images')}

  text.addEventListener('input',onContent);
  imageInput.addEventListener('change',onImages);

  const api={
    getSnapshot,
    getVersion:()=>version,
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener)},
    setActivePhotoIndex(value){const next=Math.min(Math.max(Number(value)||0,0),Math.max(currentImages().length-1,0));if(next===activePhotoIndex)return;activePhotoIndex=next;emit(['activePhotoIndex'],'active-photo')},
    setPlatform(value){const next=value==='vk'?'vk':'telegram';if(next===platform)return;platform=next;emit(['platform'],'platform')},
    restore(snapshot={}){
      if(typeof snapshot.content==='string'){
        const editor=getRichEditor();
        if(!editor?.restoreDraft?.(snapshot.content)){text.value=snapshot.content;editor?.restorePlain?.(snapshot.content);text.dispatchEvent(new Event('input',{bubbles:true}))}
      }
      getImageManager()?.replaceFiles?.(Array.isArray(snapshot.images)?snapshot.images:[]);
      platform=snapshot.platform==='vk'?'vk':'telegram';
      activePhotoIndex=Math.max(Number(snapshot.activePhotoIndex)||0,0);
      imageSignature=signature(currentImages());version++;
      window.dispatchEvent(new CustomEvent('cosmo-composer-restore',{detail:getSnapshot()}));
    },
    reset(){
      const editor=getRichEditor();
      if(editor?.clear)editor.clear();else{text.value='';text.dispatchEvent(new Event('input',{bubbles:true}))}
      getImageManager()?.replaceFiles?.([]);platform='telegram';activePhotoIndex=0;imageSignature='';version++;
      window.dispatchEvent(new CustomEvent('cosmo-composer-restore',{detail:getSnapshot()}));
    },
    dispose(){text.removeEventListener('input',onContent);imageInput.removeEventListener('change',onImages);listeners.clear()},
  };
  return Object.freeze(api);
}

window.CosmoComposerStateFactory=Object.freeze({create});
window.CosmoComposerState??=create();
})();
