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
 window.CosmoSofaDraft?.cancelRestore?.();
 try{const file=await mockPngFile();if(!file)return;const manager=window.CosmoComposerImages;if(manager?.replaceFiles){manager.replaceFiles([file]);return}const input=document.querySelector('#image');if(!input||typeof DataTransfer==='undefined')return;const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))}catch(error){console.warn('Mock AI PNG transfer failed',error)}
});
})();
const RICH_LOADER_VERSION='2026-09-03.14';
window.CosmoDiagnostics?.log?.('rich-loader-start',{version:RICH_LOADER_VERSION,module:'/composer-tiptap.js'});
import(`/composer-tiptap.js?v=${encodeURIComponent(RICH_LOADER_VERSION)}`)
 .then(()=>import(`/composer-tiptap-draft-bridge.js?v=${encodeURIComponent(RICH_LOADER_VERSION)}`))
 .then(()=>{
   window.CosmoDiagnostics?.log?.('rich-loader-ok',{version:RICH_LOADER_VERSION,apiReady:!!window.CosmoRichEditor,engine:'tiptap'});
   return import(`/composer-tiptap-fixes.js?v=${encodeURIComponent(RICH_LOADER_VERSION)}`)
     .then(()=>window.CosmoDiagnostics?.log?.('details-nodeview-loader-ok',{version:RICH_LOADER_VERSION}))
     .catch(error=>{window.CosmoDiagnostics?.log?.('details-nodeview-loader-error',{version:RICH_LOADER_VERSION,error:error?.message||String(error)});console.warn('Details NodeView load failed',error)});
 })
 .catch(error=>{window.CosmoDiagnostics?.log?.('rich-loader-error',{version:RICH_LOADER_VERSION,error:error?.message||String(error)});console.warn('Tiptap editor load failed',error)});
