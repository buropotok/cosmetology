// User-owned, browser-local default for new Composer documents.
// The signature is never attached by the publish API: it becomes ordinary editable PostDocument blocks.
const STORAGE_PREFIX='cosmo-sofa.post-signature.v1';

function storageKey(){
  const id=window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  return id==null?STORAGE_PREFIX+`local`:STORAGE_PREFIX+`user-${id}`;
}

function textOf(block){
  const runs=Array.isArray(block?.content)?block.content:Array.isArray(block?.title)?block.title:[];
  return runs.map(run=>typeof run?.text==='string'?run.text:'').join('')+
    (Array.isArray(block?.blocks)?block.blocks.map(textOf).join(''): '')+
    (Array.isArray(block?.items)?block.items.map(item=>textOf(item)+textOf(item.children)).join(''):'');
}

export function hasSignatureText(document){
  return document?.schemaVersion===2&&Array.isArray(document.blocks)&&document.blocks.some(block=>textOf(block).trim());
}

export function readSignature(){
  try{
    const raw=localStorage.getItem(storageKey());
    if(!raw)return null;
    const document=JSON.parse(raw);
    return hasSignatureText(document)?document:null;
  }catch{return null}
}

export function saveSignature(document){
  if(typeof localStorage==='undefined')throw new Error('Хранилище настроек недоступно.');
  if(!hasSignatureText(document)){localStorage.removeItem(storageKey());return}
  localStorage.setItem(storageKey(),JSON.stringify({schemaVersion:2,blocks:document.blocks}));
}

const emptyParagraph=()=>({type:'paragraph',content:[]});
const divider=()=>({type:'paragraph',content:[{text:'_____'}]});

export function initialDocumentWithSignature(signature=readSignature()){
  if(!hasSignatureText(signature))return null;
  return {schemaVersion:2,blocks:[emptyParagraph(),divider(),...signature.blocks]};
}

export function appendSignatureToDocument(document,signature=readSignature()){
  if(!hasSignatureText(signature)||!Array.isArray(document?.blocks))return document;
  return {...document,blocks:[...document.blocks,divider(),...signature.blocks]};
}
