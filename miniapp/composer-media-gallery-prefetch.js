const API='/api/miniapp/media';
export const GALLERY_PREFETCH_LIMIT=30;

let snapshot=null;
let metadataPromise=null;
const thumbnailPromises=new Map();

function authHeaders(){const initData=window.Telegram?.WebApp?.initData;return initData?{Authorization:`tma ${initData}`}:{}}
async function fetchJson(){const response=await fetch(`${API}?limit=${GALLERY_PREFETCH_LIMIT}`,{headers:authHeaders()});if(!response.ok)throw new Error('Не удалось загрузить галерею.');return response.json()}
function thumbnailUrl(asset){return asset?.thumbnailUrl||asset?.originalUrl||''}
function startThumbnail(url){
 if(!url)return null;
 const existing=thumbnailPromises.get(url);if(existing)return existing;
 const pending=fetch(url,{headers:authHeaders()}).then(response=>{if(!response.ok)throw new Error('Не удалось загрузить изображение.');return response.blob()}).catch(error=>{thumbnailPromises.delete(url);throw error});
 thumbnailPromises.set(url,pending);
 return pending;
}

export function prefetchComposerGallery(){
 if(snapshot)return Promise.resolve(snapshot);
 if(metadataPromise)return metadataPromise;
 metadataPromise=fetchJson().then(data=>{
   const assets=(data.assets||[]).slice(0,GALLERY_PREFETCH_LIMIT);
   snapshot={assets,cursor:data.nextCursor||null};
   assets.forEach(asset=>{const pending=startThumbnail(thumbnailUrl(asset));pending?.catch(()=>undefined)});
   return snapshot;
 }).catch(error=>{metadataPromise=null;throw error});
 return metadataPromise;
}

export function consumeComposerGalleryPrefetch(){const value=snapshot;snapshot=null;return value}
export function getComposerGalleryPrefetch(){return metadataPromise}
export function getComposerGalleryThumbnail(url){return thumbnailPromises.get(url)||null}
