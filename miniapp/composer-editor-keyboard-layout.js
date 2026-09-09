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
.composer-editor.is-keyboard-layout .composer-tool-panel{top:auto!important;bottom:43px!important}
@media(max-width:360px){.composer-editor-controls{gap:6px}.composer-editor-controls .composer-clear{padding:6px 8px;font-size:11px}.composer-editor-controls .composer-toolbar{max-width:calc(100% - 76px)}}
`;

function acquireStyles(doc){
  if(!styleNode||!styleNode.isConnected){
    styleNode=doc.createElement('style');
    styleNode.dataset.cosmoEditorKeyboardLayout='';
    styleNode.textContent=STYLE_TEXT;
    doc.head.append(styleNode);
  }
  styleUsers+=1;
  return()=>{
    styleUsers=Math.max(0,styleUsers-1);
    if(styleUsers===0&&styleNode){styleNode.remove();styleNode=null}
  };
}

export function computeVisualViewportInsets({innerHeight=0,viewport=null}={}){
  const layoutHeight=Math.max(0,Number(innerHeight)||0);
  const top=Math.max(0,Number(viewport?.offsetTop)||0);
  const height=Math.max(0,Number(viewport?.height)||layoutHeight);
  const bottom=Math.max(0,layoutHeight-top-height);
  return{top,bottom,height};
}

export function isMobileEditorEnvironment({platform='',coarsePointer=false}={}){
  const value=String(platform||'').toLowerCase();
  return value==='android'||value==='ios'||Boolean(coarsePointer);
}

export function initComposerEditorKeyboardLayout({
  editorApi=globalThis.window?.CosmoRichEditor,
  root=globalThis.document?.querySelector?.('.composer-editor'),
  win=globalThis.window,
  doc=globalThis.document,
  viewport=globalThis.window?.visualViewport
}={}){
  if(!win||!doc||!(root instanceof win.HTMLElement))return null;
  const existing=instances.get(root);if(existing)return existing;
  const editor=editorApi?.editor;
  const host=editorApi?.element;
  const toolbar=root.querySelector('.composer-toolbar');
  const footer=root.querySelector('.composer-editor-footer');
  const clear=root.querySelector('.composer-clear');
  if(!editor?.on||!editor?.off||!(host instanceof win.HTMLElement)||!(toolbar instanceof win.HTMLElement)||!(footer instanceof win.HTMLElement)||!(clear instanceof win.HTMLElement))return null;

  const releaseStyles=acquireStyles(doc);
  const toolbarParent=toolbar.parentNode,toolbarNext=toolbar.nextSibling;
  const clearParent=clear.parentNode,clearNext=clear.nextSibling;
  const controls=doc.createElement('div');
  controls.className='composer-editor-controls';
  controls.setAttribute('aria-label','Управление редактором');
  footer.before(controls);
  controls.append(toolbar,clear);

  const platform=String(win.Telegram?.WebApp?.platform||'');
  const coarsePointer=typeof win.matchMedia==='function'&&win.matchMedia('(pointer: coarse)').matches;
  const mobile=isMobileEditorEnvironment({platform,coarsePointer});
  let active=false,blurTimer=0;

  const updateViewport=()=>{
    if(!active)return;
    const frame=computeVisualViewportInsets({innerHeight:win.innerHeight,viewport});
    root.style.setProperty('--composer-editor-vv-top',`${frame.top}px`);
    root.style.setProperty('--composer-editor-vv-bottom',`${frame.bottom}px`);
  };
  const activate=()=>{
    if(!mobile)return;
    win.clearTimeout(blurTimer);
    active=true;
    root.classList.add('is-keyboard-layout');
    updateViewport();
  };
  const deactivate=()=>{
    active=false;
    root.classList.remove('is-keyboard-layout');
    root.style.removeProperty('--composer-editor-vv-top');
    root.style.removeProperty('--composer-editor-vv-bottom');
  };
  const onFocus=()=>activate();
  const onBlur=()=>{
    win.clearTimeout(blurTimer);
    blurTimer=win.setTimeout(()=>{if(!editor.isFocused)deactivate()},0);
  };
  const keepClearFocus=event=>{if(active)event.preventDefault()};

  editor.on('focus',onFocus);
  editor.on('blur',onBlur);
  clear.addEventListener('mousedown',keepClearFocus);
  win.addEventListener('resize',updateViewport);
  viewport?.addEventListener?.('resize',updateViewport);
  viewport?.addEventListener?.('scroll',updateViewport);

  const controller={
    update:updateViewport,
    destroy(){
      win.clearTimeout(blurTimer);
      deactivate();
      editor.off('focus',onFocus);
      editor.off('blur',onBlur);
      clear.removeEventListener('mousedown',keepClearFocus);
      win.removeEventListener('resize',updateViewport);
      viewport?.removeEventListener?.('resize',updateViewport);
      viewport?.removeEventListener?.('scroll',updateViewport);
      if(toolbarParent)toolbarParent.insertBefore(toolbar,toolbarNext&&toolbarNext.parentNode===toolbarParent?toolbarNext:null);
      if(clearParent)clearParent.insertBefore(clear,clearNext&&clearNext.parentNode===clearParent?clearNext:null);
      controls.remove();
      instances.delete(root);
      releaseStyles();
    }
  };
  instances.set(root,controller);
  return controller;
}
