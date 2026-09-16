import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const moduleUrl=new URL('./composer-media-gallery-prefetch.js',import.meta.url);

test('gallery prefetch retries metadata failure and keeps exactly 30 thumbnail requests',async()=>{
 const originalWindow=globalThis.window,originalFetch=globalThis.fetch;
 let metadataAttempts=0;
 const thumbnailUrls=[];
 globalThis.window={Telegram:{WebApp:{initData:'test-init-data'}}};
 globalThis.fetch=async url=>{
   const value=String(url);
   if(value.startsWith('/api/miniapp/media?limit=30')){
     metadataAttempts++;
     if(metadataAttempts===1)return{ok:false,json:async()=>({})};
     return{ok:true,json:async()=>({assets:Array.from({length:31},(_,index)=>({id:`asset-${index}`,thumbnailUrl:`/thumb/${index}`})),nextCursor:'next-page'})};
   }
   thumbnailUrls.push(value);
   return{ok:true,blob:async()=>new Blob([value])};
 };
 try{
   const gallery=await import(`${moduleUrl.href}?test=${Date.now()}`);
   await assert.rejects(gallery.prefetchComposerGallery());
   const snapshot=await gallery.prefetchComposerGallery();
   assert.equal(metadataAttempts,2);
   assert.equal(snapshot.assets.length,30);
   assert.equal(snapshot.cursor,'next-page');
   await Promise.all(snapshot.assets.map(asset=>gallery.getComposerGalleryThumbnail(asset.thumbnailUrl)));
   assert.equal(thumbnailUrls.length,30);
   assert.equal(new Set(thumbnailUrls).size,30);
   assert.equal(gallery.consumeComposerGalleryPrefetch(),snapshot);
   assert.equal(gallery.consumeComposerGalleryPrefetch(),null);
 }finally{
   globalThis.window=originalWindow;
   globalThis.fetch=originalFetch;
 }
});

test('any New Post menu choice signals one background gallery prefetch with cleanup',async()=>{
 const [entry,bridge]=await Promise.all([
   readFile(new URL('./new-post-entry.js',import.meta.url),'utf8'),
   readFile(new URL('./composer-media-gallery-bridge.js',import.meta.url),'utf8')
 ]);
 const choiceHandler=entry.slice(entry.indexOf("controls.addEventListener('click'"),entry.indexOf('window.CosmoComposerView'));
 assert.match(choiceHandler,/closest\?\.\('\[data-new-post-choice\]'\)/);
 assert.match(choiceHandler,/dispatchEvent\(new CustomEvent\('cosmo-new-post-choice'/);
 assert.match(bridge,/addEventListener\('cosmo-new-post-choice',prefetch\)/);
 assert.match(bridge,/removeEventListener\('cosmo-new-post-choice',prefetch\)/);
 assert.match(bridge,/prefetchComposerGallery\(\)\.catch\(\(\)=>undefined\)/);
});
