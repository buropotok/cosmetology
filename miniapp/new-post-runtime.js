import {loadComposerRichEditor} from './composer-rich-editor-runtime.js';
import {loadOnboardingRuntime} from './onboarding-runtime.js';

let runtimePromise;
let publishingPromise;

function loadStyles(){
  const styles=[
    ['cosmo-workspace-spacing','/compact-workspace.css'],
    ['cosmo-telegram-quotes','/telegram-quote-preview.css']
  ];
  for(const [name,href] of styles){
    if(document.querySelector(`link[data-${name}]`))continue;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=href;
    link.setAttribute(`data-${name}`,'');
    document.head.append(link);
  }
}

export async function loadNewPostRuntime(){
  if(window.CosmoComposerView)return window.CosmoComposerView;
  if(!runtimePromise){
    runtimePromise=(async()=>{
      loadStyles();

      // Composer owns its DOM, editor, media and draft lifecycle.
      await import('./app.js');
      await import('./publish-ai-wizard.js');
      await import('./composer-mockup.js');
      await import('./composer-screen.js');
      await import('./composer-image-manager.js');
      await import('./diagnostics-fetch.js');
      await loadComposerRichEditor();
      await import('./composer-editor-stability.js');
      await import('./composer-state.js');
      await import('./draft-store.js');
      await import('./draft-loading-overlay.js');
      await import('./drafts.js');
      await import('./composer-actions.js');
      await import('./composer-image-generation.js');

      // AI presentation and AI-to-Composer transfer stay at their integration boundary.
      await import('./ai-generation-status.js');
      await import('./ai-response-ui.js');
      await import('./ai-post-editor-transfer.js');
      await import('./new-post-entry.js');
      if(!window.CosmoComposerView)throw new Error('New Post runtime did not initialize');
      void loadPublishingRuntime();
      return window.CosmoComposerView;
    })().catch(error=>{runtimePromise=undefined;throw error});
  }
  return runtimePromise;
}

async function loadPublishingRuntime(){
  if(publishingPromise)return publishingPromise;
  const buttons=[document.querySelector('.composer-telegram-preview'),document.querySelector('#publish'),document.querySelector('#publish-vk')].filter(Boolean);
  buttons.forEach(button=>{button.disabled=true});
  publishingPromise=(async()=>{
    await loadOnboardingRuntime();
    await import('./onboarding-flow.js');
    await import('./vk-group-publish-guard.js');
    await import('./vk-return-confirmation.js');
    buttons.forEach(button=>{button.disabled=false});
    return Object.freeze({ready:true});
  })().catch(error=>{
    publishingPromise=undefined;
    const status=document.querySelector('#status');
    if(status){status.textContent='Публикация временно недоступна. Редактор продолжает работать.';status.className='error'}
    console.error('Publishing integration failed to load',error);
  });
  return publishingPromise;
}
