import {initComposerMediaGallery} from './composer-media-gallery.js';
import {prefetchComposerGallery} from './composer-media-gallery-prefetch.js';

export function initComposerMediaGalleryBridge(){
 const composer=document.querySelector('#composer-screen');
 const actions=composer?.querySelector('.composer-image-actions');
 const addDevice=actions?.querySelector('#composer-add-photo');
 if(!composer||!actions||!addDevice||actions.querySelector('#composer-media-gallery'))return()=>{};
 const previousLabel=addDevice.textContent;
 addDevice.textContent='Добавить фото с устройства';
 const gallery=document.createElement('button');
 gallery.type='button';
 gallery.id='composer-media-gallery';
 gallery.textContent='Галерея Cosmo Sofa';
 addDevice.insertAdjacentElement('afterend',gallery);
 actions.classList.add('composer-image-actions--gallery');
 const disposeGallery=initComposerMediaGallery({trigger:gallery,onAdd:files=>window.CosmoComposerImages?.addFiles?.(files),getComposerImageCount:()=>window.CosmoComposerImages?.getFiles?.().length||0});
 const prefetch=()=>{window.removeEventListener('cosmo-new-post-choice',prefetch);void prefetchComposerGallery().catch(()=>undefined)};
 window.addEventListener('cosmo-new-post-choice',prefetch);
 return()=>{window.removeEventListener('cosmo-new-post-choice',prefetch);disposeGallery();gallery.remove();actions.classList.remove('composer-image-actions--gallery');addDevice.textContent=previousLabel};
}
