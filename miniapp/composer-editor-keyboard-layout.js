const instances=new WeakMap();
let styleNode=null;
let styleUsers=0;

const STYLE_TEXT=`
.composer-editor-controls{display:flex;align-items:center;gap:8px;margin:0 0 6px;min-width:0}
.composer-editor-controls .composer-toolbar{flex:1 1 auto;width:max-content;min-width:0;max-width:calc(100% - 88px);margin:0}
.composer-editor-controls .composer-clear{flex:0 0 auto;min-height:42px;padding:6px 10px;white-space:nowrap}
.composer-editor-footer{justify-content:flex-end}
.composer-editor.is-keyboard-layout{position:fixed!important;left:0!important;right:0!important;top:var(--composer-editor-vv-top,0px)!important;bottom:var(--composer-editor-vv-bottom,0px)!important;z-index:115!important;box-sizing:border-box!important;margin:0!important;border-radius:0!important;padding:8px!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;background:#fff!important}
.composer-editor.is-keyboard-layout .composer-tiptap-editor{order:1;flex:1 1 auto;min-height:0!important;height:auto!important;max-height:none!important;overflow-y:auto!important;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding-bottom:6px!important}
.composer-editor.is-keyboard-layout .composer-tiptap-editor .tiptap{min-height:100%!important}
.composer-editor.is-keyboard-layout .composer-editor-controls{order:2;flex:0 0 auto;margin:6px 0 0;padding:2px 0 0;background:#fff}
.composer-editor.is-keyboard-layout .composer-editor-footer{display:none!important}
.composer-editor.is-keyboard-layout .composer-tool-menu .composer-tool-panel{top:auto!important;bottom:calc(100% + 6px)!important}
@media(max-width:360px){.composer-editor-controls{gap:6px}.composer-editor-controls .composer-clear{padding:6px 8px;font-size:11px}.composer-editor-controls .composer-toolbar{max-width:calc(100% - 76px)}}
`;

function acquireStyles(doc){
  if(!styleNode||!styleNode.isConnected){styleNode=doc.createElement('style');styleNode.dataset.cosmoEditorKeyboardLayout='';styleNode.textContent=STYLE_TEXT;doc.head.append(styleNode)}
  styleUsers+=1;
  return()=>{styleUsers=Math.max(0,styleUsers-1);if(styleUsers===0&&styleNode){styleNode.remove();styleNode=null}};
}

export function computeVisualViewportInsets({innerHeight=0,viewport=null}={}){const layoutHeight=Math.max(0,Number(innerHeight)||0);const top=Math.max(0,Number(viewport?.offsetTop)||0);const height=Math.max(0,Number(viewport?.height)||layoutHeight);const bottom=Math.max(0,layoutHeight-top-height);return{top,bottom,height}}
export function isMobileEditorEnvironment({platform='',coarsePointer=false}={}){const value=String(platform||'').toLowerCase();return value==='android'||value==='ios'||Boolean(coarsePointer)}
export function shouldExitFullscreenOnPull({scrollTop=0,startX=0,startY=0,currentX=0,currentY=0,threshold=48}={}){if((Number(scrollTop)||0)>1)return false;const dx=(Number(currentX)||0)-(Number(startX)||0);const dy=(Number(currentY)||0)-(Number(startY)||0);return dy>=threshold&&dy>Math.abs(dx)*1.2}

export function initComposerEditorKeyboardLayout({editorApi=globalThis.window?.CosmoRichEditor,root=globalThis.document?.querySelector?.('.composer-editor'),win=globalThis.window,doc=globalThis.document,viewport=globalThis.window?.visualViewport,router=globalThis.window?.CosmoRouter}={}){
  if(!win||!doc||!(root instanceof win.HTMLElement))return null;
  const existing=instances.get(root);if(existing)return existing;
  const editor=editorApi?.editor,host=editorApi?.element,toolbar=root.querySelector('.composer-toolbar'),footer=root.querySelector('.composer-editor-footer'),clear=root.querySelector('.composer-clear');
  if(!editor?.on||!editor?.off||!(host instanceof win.HTMLElement)||!(toolbar instanceof win.HTMLElement)||!(footer instanceof win.HTMLElement)||!(clear instanceof win.HTMLElement))return null;

  const releaseStyles=acquireStyles(doc),toolbarParent=toolbar.parentNode,toolbarNext=toolbar.nextSibling,clearParent=clear.parentNode,clearNext=clear.nextSibling;
  const controls=doc.createElement('div');controls.className='composer-editor-controls';controls.setAttribute('aria-label','Управление редактором');footer.before(controls);controls.append(toolbar,clear);
  const platform=String(win.Telegram?.WebApp?.platform||''),coarsePointer=typeof win.matchMedia==='function'&&win.matchMedia('(pointer: coarse)').matches,mobile=isMobileEditorEnvironment({platform,coarsePointer});
  let active=false,pullStart=null;
  const updateViewport=()=>{if(!active)return;const frame=computeVisualViewportInsets({innerHeight:win.innerHeight,viewport});root.style.setProperty('--composer-editor-vv-top',`${frame.top}px`);root.style.setProperty('--composer-editor-vv-bottom',`${frame.bottom}px`)};
  const activate=()=>{if(!mobile)return;active=true;root.classList.add('is-keyboard-layout');updateViewport()};
  const deactivate=()=>{active=false;pullStart=null;root.classList.remove('is-keyboard-layout');root.style.removeProperty('--composer-editor-vv-top');root.style.removeProperty('--composer-editor-vv-bottom')};
  const exitByPull=()=>{deactivate();if(typeof editor.commands?.blur==='function')editor.commands.blur()};
  const onFocus=()=>activate();
  const onRoute=route=>{if(route!=='composer')deactivate()};
  const onPublishMode=event=>{if(event?.detail?.mode!=='compose')deactivate()};
  const keepClearFocus=event=>{if(active)event.preventDefault()};
  const onTouchStart=event=>{if(!active||event.touches?.length!==1||host.scrollTop>1){pullStart=null;return}const touch=event.touches[0];pullStart={x:touch.clientX,y:touch.clientY}};
  const onTouchMove=event=>{if(!active||!pullStart||event.touches?.length!==1)return;if(host.scrollTop>1){pullStart=null;return}const touch=event.touches[0],dx=touch.clientX-pullStart.x,dy=touch.clientY-pullStart.y;if(dy>8&&dy>Math.abs(dx))event.preventDefault();if(shouldExitFullscreenOnPull({scrollTop:host.scrollTop,startX:pullStart.x,startY:pullStart.y,currentX:touch.clientX,currentY:touch.clientY}))exitByPull()};
  const clearPull=()=>{pullStart=null};

  editor.on('focus',onFocus);clear.addEventListener('mousedown',keepClearFocus);host.addEventListener('touchstart',onTouchStart,{passive:true});host.addEventListener('touchmove',onTouchMove,{passive:false});host.addEventListener('touchend',clearPull);host.addEventListener('touchcancel',clearPull);win.addEventListener('resize',updateViewport);win.addEventListener('cosmo-publish-mode',onPublishMode);viewport?.addEventListener?.('resize',updateViewport);viewport?.addEventListener?.('scroll',updateViewport);
  const unsubscribeRoute=typeof router?.subscribe==='function'?router.subscribe(onRoute):()=>{};

  const controller={update:updateViewport,exit:exitByPull,destroy(){deactivate();editor.off('focus',onFocus);clear.removeEventListener('mousedown',keepClearFocus);host.removeEventListener('touchstart',onTouchStart);host.removeEventListener('touchmove',onTouchMove);host.removeEventListener('touchend',clearPull);host.removeEventListener('touchcancel',clearPull);win.removeEventListener('resize',updateViewport);win.removeEventListener('cosmo-publish-mode',onPublishMode);viewport?.removeEventListener?.('resize',updateViewport);viewport?.removeEventListener?.('scroll',updateViewport);unsubscribeRoute();if(toolbarParent)toolbarParent.insertBefore(toolbar,toolbarNext&&toolbarNext.parentNode===toolbarParent?toolbarNext:null);if(clearParent)clearParent.insertBefore(clear,clearNext&&clearNext.parentNode===clearParent?clearNext:null);controls.remove();instances.delete(root);releaseStyles()}};
  instances.set(root,controller);return controller;
}
