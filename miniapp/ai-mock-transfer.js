(()=>{
async function mockPngFile(){
 const svg=document.querySelector('#mock-ai-svg');if(!svg)return null;
 const source=new XMLSerializer().serializeToString(svg),blob=new Blob([source],{type:'image/svg+xml'}),url=URL.createObjectURL(blob);
 try{
  const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=460;const ctx=canvas.getContext('2d');if(!ctx)return null;ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png',.92));if(!png)return null;
  return new File([png],'cosmo-sofa-ai.png',{type:'image/png'});
 }finally{URL.revokeObjectURL(url)}
}
document.addEventListener('click',async event=>{
 if(!event.target.closest?.('#flow-edit'))return;
 // Entering screen 3 starts a new composition. Any in-flight async draft
 // image restore belongs to the previous state and must not arrive later.
 window.CosmoSofaDraft?.cancelRestore?.();
 try{const file=await mockPngFile();if(!file)return;const manager=window.CosmoComposerImages;if(manager?.replaceFiles){manager.replaceFiles([file]);return}const input=document.querySelector('#image');if(!input||typeof DataTransfer==='undefined')return;const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))}catch(error){console.warn('Mock AI PNG transfer failed',error)}
});
})();
import('/composer-rich-text.js').catch(error=>console.warn('Rich text editor load failed',error));
