(()=>{
const params=new URLSearchParams(location.search);
if(params.get('embedded')!=='1'||window.parent===window)return;
function close(action,payload={}){window.parent.postMessage({type:'cosmo-before-after-close',action,...payload},location.origin)}
async function save(){
  const result=document.getElementById('compositeResult');
  let blob=null;
  if(result?.dataset.url&&!result.hidden)blob=await fetch(result.dataset.url).then(r=>r.blob());
  if(!blob&&typeof window.cosmoBeforeAfterCompositeBlob==='function')blob=await window.cosmoBeforeAfterCompositeBlob();
  if(!blob)throw new Error('Не удалось собрать изображение');
  const buffer=await blob.arrayBuffer();
  close('save',{image:{buffer,mime:blob.type||'image/jpeg',name:`before-after-${Date.now()}.jpg`}});
}
document.addEventListener('click',async event=>{
  const button=event.target.closest?.('#back,#finish');
  if(!button||button.disabled)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(button.id==='back'){close('back');return}
  button.disabled=true;
  try{await save()}catch(error){const target=document.getElementById('error');if(target)target.textContent=error?.message||'Не удалось сохранить изображение';button.disabled=false}
},true);
})();