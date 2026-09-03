(()=>{
  const api=window.CosmoRichEditor;
  const editor=api?.editor;
  const host=document.querySelector('.composer-tiptap-editor');
  if(!editor?.view||!host)return;

  const log=(kind,data={})=>window.CosmoDiagnostics?.log?.(kind,data);

  const style=document.createElement('style');
  style.textContent=`
    .composer-tiptap-editor .cosmo-details-node{margin:8px 0;padding:6px 8px;border:1px solid #d7d9de;border-radius:8px;display:grid;grid-template-columns:32px minmax(0,1fr);column-gap:6px;align-items:start}
    .composer-tiptap-editor .cosmo-details-toggle{grid-column:1;grid-row:1;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:1px solid #c9cdd3;border-radius:8px;background:#f5f6f7;color:inherit;font:inherit;font-size:16px;line-height:1;cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none}
    .composer-tiptap-editor .cosmo-details-content{grid-column:2;grid-row:1;min-width:0;padding-top:5px}
    .composer-tiptap-editor .cosmo-details-content>summary{display:block;margin:0;min-height:22px;font-weight:600;cursor:text;list-style:none}
    .composer-tiptap-editor .cosmo-details-content>summary::-webkit-details-marker{display:none}
    .composer-tiptap-editor .cosmo-details-node:not(.is-open) [data-cosmo-details-body]{display:none}
    .composer-tiptap-editor .cosmo-details-node.is-open [data-cosmo-details-body]{display:block}
    .composer-tiptap-editor .cosmo-post-buttons{display:flex;flex-direction:column;gap:6px;margin:12px 8px 8px;padding-top:10px;border-top:1px solid #e1e3e6}
    .composer-tiptap-editor .cosmo-post-buttons:empty{display:none}
    .composer-tiptap-editor .cosmo-post-button{width:100%;min-height:38px;padding:7px 12px;border:0;border-radius:8px;background:#e7f1fb;color:#2481cc;font:inherit;font-weight:600;text-align:center;cursor:pointer;touch-action:manipulation}
    .cosmo-button-editor{position:fixed;z-index:1000;left:12px;right:12px;bottom:12px;max-width:440px;margin:auto;padding:14px;background:#fff;border:1px solid #d7d9de;border-radius:14px;box-shadow:0 12px 40px #0003;color:#111}
    .cosmo-button-editor label{display:block;margin:0 0 10px;font-size:13px;font-weight:600}
    .cosmo-button-editor input{box-sizing:border-box;width:100%;margin-top:5px;padding:9px 10px;border:1px solid #c9cdd3;border-radius:8px;font:inherit}
    .cosmo-button-editor-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
    .cosmo-button-editor-actions button{min-height:36px;padding:6px 12px;border:1px solid #c9cdd3;border-radius:8px;background:#f5f6f7;font:inherit}
    .cosmo-button-editor-actions .primary{border-color:#2481cc;background:#2481cc;color:#fff}
    .cosmo-button-editor-actions .danger{margin-right:auto;color:#c62828}
  `;
  document.head.append(style);

  const detailsNodeView=()=>{
    const dom=document.createElement('div');dom.className='cosmo-details-node';
    const button=document.createElement('button');button.type='button';button.className='cosmo-details-toggle';button.contentEditable='false';button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Развернуть');button.textContent='›';
    const contentDOM=document.createElement('div');contentDOM.className='cosmo-details-content';dom.append(button,contentDOM);
    let open=false;
    const render=()=>{dom.classList.toggle('is-open',open);button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Свернуть':'Развернуть');button.textContent=open?'⌄':'›'};render();
    button.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation()});
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();open=!open;render();log('details-button-toggle',{open})});
    return{dom,contentDOM,stopEvent:event=>event.target===button||button.contains(event.target),ignoreMutation:mutation=>(mutation.type==='attributes'&&(mutation.target===dom||mutation.target===button))||button.contains(mutation.target)};
  };
  const current=editor.view.props.nodeViews||{};
  editor.view.setProps({nodeViews:{...current,details:detailsNodeView}});
  log('details-nodeview-ready',{detailsCount:editor.state.doc.content.content.filter(node=>node.type.name==='details').length});

  let postButtons=(api.toPostDocument()?.buttons||[]).map(button=>({...button}));
  const tray=document.createElement('div');tray.className='cosmo-post-buttons';tray.contentEditable='false';host.append(tray);

  const notifyChanged=()=>{
    const textarea=document.querySelector('#text');
    if(textarea instanceof HTMLTextAreaElement)textarea.dispatchEvent(new Event('input',{bubbles:true}));
    log('post-buttons-change',{count:postButtons.length});
  };

  const validUrl=value=>{try{const url=new URL(value);return /^https?:$/.test(url.protocol)?url.href:null}catch{return null}};
  const closeEditor=()=>document.querySelector('.cosmo-button-editor')?.remove();
  function openButtonEditor(index=null){
    closeEditor();
    const existing=index===null?null:postButtons[index];
    const panel=document.createElement('div');panel.className='cosmo-button-editor';
    const textLabel=document.createElement('label');textLabel.textContent='Текст кнопки';
    const textInput=document.createElement('input');textInput.type='text';textInput.value=existing?.text||'Подробнее';textInput.placeholder='Подробнее';textLabel.append(textInput);
    const urlLabel=document.createElement('label');urlLabel.textContent='Ссылка';
    const urlInput=document.createElement('input');urlInput.type='url';urlInput.value=existing?.url||'https://';urlInput.placeholder='https://example.com';urlLabel.append(urlInput);
    const actions=document.createElement('div');actions.className='cosmo-button-editor-actions';
    if(existing){const remove=document.createElement('button');remove.type='button';remove.className='danger';remove.textContent='Удалить';remove.addEventListener('click',()=>{postButtons.splice(index,1);closeEditor();renderButtons();notifyChanged()});actions.append(remove)}
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Отмена';cancel.addEventListener('click',closeEditor);
    const save=document.createElement('button');save.type='button';save.className='primary';save.textContent=existing?'Сохранить':'Добавить кнопку';
    save.addEventListener('click',()=>{const label=textInput.value.trim(),url=validUrl(urlInput.value.trim());if(!label){textInput.focus();return}if(!url){urlInput.focus();urlInput.setCustomValidity('Нужна ссылка http:// или https://');urlInput.reportValidity();urlInput.setCustomValidity('');return}const value={text:label,url};if(index===null)postButtons.push(value);else postButtons[index]=value;closeEditor();renderButtons();notifyChanged()});
    actions.append(cancel,save);panel.append(textLabel,urlLabel,actions);document.body.append(panel);setTimeout(()=>textInput.focus(),0);
  }

  function renderButtons(){
    tray.replaceChildren();
    postButtons.forEach((item,index)=>{const button=document.createElement('button');button.type='button';button.className='cosmo-post-button';button.textContent=item.text;button.setAttribute('aria-label',`Редактировать кнопку ${item.text}`);button.addEventListener('pointerdown',event=>event.preventDefault());button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openButtonEditor(index)});tray.append(button)});
  }
  renderButtons();

  const originalToPostDocument=api.toPostDocument.bind(api);
  api.toPostDocument=()=>{const doc=originalToPostDocument();if(postButtons.length)doc.buttons=postButtons.map(button=>({...button}));else delete doc.buttons;return doc};
  api.getButtons=()=>postButtons.map(button=>({...button}));
  api.setButtons=value=>{postButtons=Array.isArray(value)?value.map(button=>({...button})):[];renderButtons();notifyChanged()};
  const originalDraftValue=api.draftValue.bind(api);
  api.draftValue=()=>{const prefix='\u2063COSMO_DRAFT_V3:';return prefix+JSON.stringify({version:3,document:api.toPostDocument()})};
  const originalRestoreDraft=api.restoreDraft.bind(api);
  api.restoreDraft=value=>{const ok=originalRestoreDraft(value);if(ok){try{const prefix='\u2063COSMO_DRAFT_V3:';const doc=JSON.parse(value.slice(prefix.length))?.document;postButtons=(doc?.buttons||[]).map(button=>({...button}));renderButtons()}catch{}}return ok};
  const originalRestorePlain=api.restorePlain.bind(api);
  api.restorePlain=value=>{postButtons=[];renderButtons();return originalRestorePlain(value)};
  const originalClear=api.clear.bind(api);
  api.clear=()=>{postButtons=[];renderButtons();return originalClear()};

  const menus=[...document.querySelectorAll('.composer-tool-menu')];
  const linkMenu=menus.find(menu=>menu.querySelector('.composer-menu-trigger[title="Ссылка"]'));
  const linkItems=linkMenu?[...linkMenu.querySelectorAll('.composer-menu-item')]:[];
  const createItem=linkItems[1];
  if(createItem){
    createItem.textContent='Кнопка';
    createItem.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();linkMenu?.classList.remove('open');openButtonEditor(null)},true);
  }

  const previousFetch=window.fetch.bind(window);
  window.fetch=(input,init={})=>{
    const url=typeof input==='string'?input:input?.url||'';
    if(init.body instanceof FormData){
      const value=init.body.get('text');
      if(typeof value==='string'&&value.startsWith('\u2063COSMO_RICH_V1:')){
        try{const doc=JSON.parse(value.slice('\u2063COSMO_RICH_V1:'.length));if(postButtons.length)doc.buttons=postButtons.map(button=>({...button}));else delete doc.buttons;init.body.set('text','\u2063COSMO_RICH_V1:'+JSON.stringify(doc))}catch{}
      }else if(url.includes('/api/miniapp/draft')&&typeof value==='string'&&value.startsWith('\u2063COSMO_DRAFT_V3:')){
        try{const payload=JSON.parse(value.slice('\u2063COSMO_DRAFT_V3:'.length));if(payload?.document){if(postButtons.length)payload.document.buttons=postButtons.map(button=>({...button}));else delete payload.document.buttons;init.body.set('text','\u2063COSMO_DRAFT_V3:'+JSON.stringify(payload))}}catch{}
      }
    }
    return previousFetch(input,init);
  };

  log('post-buttons-editor-ready',{count:postButtons.length});
})();
