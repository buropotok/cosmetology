(()=>{
const input=document.querySelector('#image'),previews=document.querySelector('#previews'),removeAll=document.querySelector('#remove-image'),status=document.querySelector('#status');
if(!input||!previews)return;
let files=Array.from(input.files||[]).slice(0,10),internalChange=false,wideCheckGeneration=0;
const VK_MAX_ASPECT=16/9;

function syncInput(){
 if(typeof DataTransfer==='undefined')return false;
 const dt=new DataTransfer();
 files.forEach(file=>dt.items.add(file));
 input.files=dt.files;
 return true;
}

function notifyChange(){
 if(!syncInput())return;
 internalChange=true;
 try{input.dispatchEvent(new Event('change',{bubbles:true}))}finally{internalChange=false}
 void updateVkAspectWarning();
}

function showLimit(){
 if(!status)return;
 status.textContent='Можно выбрать не больше 10 фотографий. Будут использованы первые 10.';
 status.className='error';
}

function readImageSize(file){
 return new Promise(resolve=>{
  const url=URL.createObjectURL(file),img=new Image();
  const done=value=>{URL.revokeObjectURL(url);resolve(value)};
  img.onload=()=>done({width:img.naturalWidth,height:img.naturalHeight});
  img.onerror=()=>done(null);
  img.src=url;
 });
}

function formatIndexes(indexes){
 if(indexes.length===1)return `Изображение №${indexes[0]}`;
 if(indexes.length===2)return `Изображения №${indexes[0]} и №${indexes[1]}`;
 return `Изображения ${indexes.slice(0,-1).map(n=>`№${n}`).join(', ')} и №${indexes[indexes.length-1]}`;
}

async function updateVkAspectWarning(){
 const generation=++wideCheckGeneration;
 const current=files.slice();
 const sizes=await Promise.all(current.map(readImageSize));
 if(generation!==wideCheckGeneration)return;
 const wide=[];
 sizes.forEach((size,index)=>{if(size?.height>0&&size.width/size.height>VK_MAX_ASPECT+0.001)wide.push(index+1)});
 let warning=document.querySelector('#vk-aspect-warning');
 if(!wide.length){warning?.remove();return}
 if(!warning){warning=document.createElement('p');warning.id='vk-aspect-warning';warning.setAttribute('role','status');warning.style.cssText='margin:8px 0 0;padding:10px 12px;border-radius:10px;background:rgba(255,149,0,.14);color:#b35a00;font-size:14px;line-height:1.35';previews.parentElement?.append(warning)}
 warning.textContent=`${formatIndexes(wide)} шире 16:9. ВКонтакте обрежет ${wide.length===1?'его':'их'} по краям.`;
}

function addFiles(incoming){
 const next=Array.from(incoming||[]);
 const total=files.length+next.length;
 files=[...files,...next].slice(0,10);
 notifyChange();
 if(total>10)showLimit();
}

window.CosmoComposerImages={
 addFiles,
 replaceFiles(incoming){files=Array.from(incoming||[]).slice(0,10);notifyChange()},
 getFiles(){return files.slice()}
};

input.addEventListener('change',event=>{
 if(internalChange)return;
 const incoming=Array.from(input.files||[]).slice(0,10);
 // A native picker change adds newly selected files to our managed set.
 // Programmatic changes (draft restore / other app code) already contain the
 // complete desired FileList and must replace it, otherwise restored files
 // are appended to the manager's existing state and appear as duplicates.
 if(event.isTrusted)addFiles(incoming);
 else{files=incoming;internalChange=true;try{input.dispatchEvent(new Event('change',{bubbles:true}))}finally{internalChange=false}void updateVkAspectWarning()}
});

removeAll?.addEventListener('click',()=>{files=[];notifyChange()});

function decorate(){
 const images=[...previews.querySelectorAll('img')];
 images.forEach(img=>{
  if(img.parentElement?.classList.contains('composer-thumb'))return;
  const wrap=document.createElement('span');
  wrap.className='composer-thumb';
  wrap.style.cssText='position:relative;display:block;flex:0 0 62px;width:62px;height:62px;overflow:visible';
  img.parentNode.insertBefore(wrap,img);
  wrap.append(img);
  const del=document.createElement('button');
  del.type='button';
  del.className='composer-image-delete';
  del.setAttribute('aria-label','Удалить изображение');
  del.textContent='×';
  del.style.cssText='position:absolute;right:-5px;top:-5px;width:24px;height:24px;border:0;border-radius:50%;background:#e5484d;color:#fff;font-size:20px;line-height:22px;padding:0;z-index:3;box-shadow:0 1px 4px rgba(0,0,0,.35)';
  del.addEventListener('click',event=>{
   event.preventDefault();
   event.stopPropagation();
   if(!confirm('Удалить это изображение?'))return;
   const current=[...previews.querySelectorAll('img')];
   const index=current.indexOf(img);
   if(index<0||index>=files.length)return;
   files.splice(index,1);
   notifyChange();
  });
  wrap.append(del);
 });
}

decorate();
void updateVkAspectWarning();
new MutationObserver(decorate).observe(previews,{childList:true});
})();
