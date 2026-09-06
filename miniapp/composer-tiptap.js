import {Editor,Mark,Node,mergeAttributes} from 'https://esm.sh/@tiptap/core@3.0.2';
import StarterKit from 'https://esm.sh/@tiptap/starter-kit@3.0.2';

(()=>{
  const diag=(kind,data={})=>window.CosmoDiagnostics?.log?.(kind,data);
  const text=document.querySelector('#text'),toolbar=document.querySelector('.composer-toolbar');
  if(!(text instanceof HTMLTextAreaElement)||!toolbar){diag('tiptap-abort',{textFound:!!text,toolbarFound:!!toolbar});return}

  const RICH_PREFIX='\u2063COSMO_RICH_V1:';
  const DRAFT_PREFIX='\u2063COSMO_DRAFT_V3:';
  const editorFooter=toolbar.parentElement?.querySelector('.composer-editor-footer');
  if(editorFooter)editorFooter.parentElement.insertBefore(toolbar,editorFooter);

  const host=document.createElement('div');
  host.className='composer-bodytext composer-rich-editor composer-tiptap-editor';
  text.hidden=true;text.insertAdjacentElement('beforebegin',host);

  const style=document.createElement('style');
  style.textContent=`
    .composer-tiptap-editor{min-height:250px;max-height:none;overflow:auto;white-space:normal;overflow-wrap:anywhere}
    .composer-tiptap-editor .tiptap{min-height:250px;outline:none;white-space:pre-wrap}
    .composer-tiptap-editor .tiptap p{margin:0 0 .7em}
    .composer-tiptap-editor .tiptap h1{margin:.35em 0 .55em;font-size:1.45em;line-height:1.25}
    .composer-tiptap-editor .tiptap blockquote{margin:8px 0;padding:4px 0 4px 12px;border-left:3px solid #8d96a0}
    .composer-tiptap-editor .tiptap [data-cosmo-spoiler]{background:#d8d8de;border-radius:4px;padding:0 3px;text-decoration:underline dotted}
    .composer-tiptap-editor .tiptap [data-cosmo-spoiler]::before{content:'⟦'}
    .composer-tiptap-editor .tiptap [data-cosmo-spoiler]::after{content:'⟧'}
    .composer-tiptap-editor .tiptap details{margin:8px 0;padding:4px 8px;border:1px solid #d7d9de;border-radius:8px}
    .composer-tiptap-editor .tiptap summary{cursor:pointer;font-weight:600}
    .composer-button-dock{display:none;padding:8px 0 2px}
    .composer-button-dock.has-buttons{display:grid;gap:6px}
    .composer-link-button{width:100%;min-height:38px;padding:8px 14px;border:0;border-radius:9px;background:#229ed91a;color:#168acd;font:600 14px/1.25 inherit;cursor:pointer;text-align:center}
    .composer-link-button:hover{background:#229ed926}
    .composer-link-button:focus-visible{outline:2px solid #229ed966;outline-offset:1px}
    .composer-button-modal-backdrop{position:fixed;inset:0;z-index:120;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:#0006}
    .composer-button-modal{width:min(100%,420px);padding:18px;border-radius:16px;background:#fff;box-shadow:0 18px 50px #0004;color:#111}
    .composer-button-modal-title{margin:0 0 12px;font:600 17px/1.3 inherit}
    .composer-button-modal-input{box-sizing:border-box;width:100%;height:44px;padding:10px 12px;border:1px solid #d7d9de;border-radius:10px;background:#fff;color:#111;font:16px/1.3 inherit;outline:none}
    .composer-button-modal-input:focus{border-color:#229ed9;box-shadow:0 0 0 2px #229ed91f}
    .composer-button-modal-error{min-height:18px;margin:6px 0 0;color:#d33;font:13px/1.3 inherit}
    .composer-button-modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
    .composer-button-modal-actions button{min-height:38px;padding:8px 14px;border:0;border-radius:9px;font:600 14px/1 inherit;cursor:pointer}
    .composer-button-modal-cancel,.composer-button-modal-back{background:#f1f2f4;color:#333}
    .composer-button-modal-delete{margin-right:auto;background:transparent!important;color:#d33}
    .composer-button-modal-next{background:#229ed9;color:#fff}
    .composer-emoji-panel{position:absolute;z-index:40;display:flex;flex-wrap:wrap;gap:4px;width:220px;padding:8px;background:#fff;border:1px solid #ddd;border-radius:12px;box-shadow:0 8px 30px #0002}
    .composer-emoji-panel button{border:0;background:transparent;font-size:24px;padding:4px}
    .composer-tool[title="Изображение"]{display:none!important}
  `;
  document.head.append(style);

  const Spoiler=Mark.create({name:'spoiler',parseHTML(){return[{tag:'span[data-cosmo-spoiler]'}]},renderHTML({HTMLAttributes}){return['span',mergeAttributes(HTMLAttributes,{'data-cosmo-spoiler':'1'}),0]}});
  const DetailsSummary=Node.create({name:'detailsSummary',content:'inline*',defining:true,parseHTML(){return[{tag:'summary'}]},renderHTML({HTMLAttributes}){return['summary',mergeAttributes(HTMLAttributes),0]}});
  const DetailsBody=Node.create({name:'detailsBody',content:'block+',defining:true,parseHTML(){return[{tag:'div[data-cosmo-details-body]'}]},renderHTML({HTMLAttributes}){return['div',mergeAttributes(HTMLAttributes,{'data-cosmo-details-body':'1'}),0]}});
  const Details=Node.create({name:'details',group:'block',content:'detailsSummary detailsBody',isolating:true,parseHTML(){return[{tag:'details'}]},renderHTML({HTMLAttributes}){return['details',mergeAttributes(HTMLAttributes),0]}});

  const plainDocument=value=>({type:'doc',content:String(value||'').replace(/\r\n?/g,'\n').split('\n').map(line=>({type:'paragraph',content:line?[{type:'text',text:line}]:undefined}))});
  const markToPost=mark=>mark.type==='strike'?{type:'strikethrough'}:mark.type==='link'?{type:'link',href:mark.attrs?.href||''}:{type:mark.type};
  function inlineRuns(node){const runs=[];const visit=n=>{if(n.type==='text'&&n.text){const marks=(n.marks||[]).map(markToPost).filter(m=>['bold','italic','underline','strikethrough','spoiler','link'].includes(m.type));runs.push(marks.length?{text:n.text,marks}:{text:n.text});return}if(n.type==='hardBreak'){runs.push({text:'\n'});return}for(const child of n.content||[])visit(child)};visit(node);return runs}
  const listType=node=>node.type==='orderedList'?'ordered_list':'bullet_list';
  const normalizeListItem=node=>{const first=(node.content||[]).find(n=>n.type==='paragraph'),item={content:first?inlineRuns(first):[]};const nested=(node.content||[]).find(n=>n.type==='orderedList'||n.type==='bulletList');if(nested)item.children={type:listType(nested),items:(nested.content||[]).filter(n=>n.type==='listItem').map(normalizeListItem)};return item};
  function nodeToPostBlock(node){if(node.type==='paragraph')return{type:'paragraph',content:inlineRuns(node)};if(node.type==='heading')return{type:'heading',content:inlineRuns(node)};if(node.type==='orderedList'||node.type==='bulletList')return{type:listType(node),items:(node.content||[]).filter(n=>n.type==='listItem').map(normalizeListItem)};if(node.type==='blockquote'){const blocks=(node.content||[]).map(nodeToPostBlock).filter(Boolean);return{type:'quote',blocks:blocks.length?blocks:[{type:'paragraph',content:[]}]}}if(node.type==='details'){const summary=(node.content||[]).find(n=>n.type==='detailsSummary'),body=(node.content||[]).find(n=>n.type==='detailsBody'),blocks=(body?.content||[]).map(nodeToPostBlock).filter(Boolean);return{type:'details',title:summary?inlineRuns(summary):[{text:'Подробнее'}],blocks:blocks.length?blocks:[{type:'paragraph',content:[]}]}}return null}
  function nodeText(node){return (node.content||[]).map(child=>child.type==='text'?(child.text||''):child.type==='hardBreak'?'\n':nodeText(child)).join(childSeparator(node))}
  function childSeparator(node){return ['doc','blockquote','detailsBody'].includes(node.type)?'\n':''}
  let buttons=[];
  function toPostDocument(){const blocks=(editor.getJSON().content||[]).map(nodeToPostBlock).filter(Boolean);if(!blocks.length)blocks.push({type:'paragraph',content:[{text:''}]});return{schemaVersion:2,blocks,...(buttons.length?{buttons:[...buttons]}:{})}}
  function postToTiptap(doc){
    const runNodes=runs=>(runs||[]).flatMap(run=>{if(!run.text)return[];const marks=(run.marks||[]).map(mark=>mark.type==='strikethrough'?{type:'strike'}:mark.type==='link'?{type:'link',attrs:{href:mark.href,target:'_blank',rel:'noopener noreferrer nofollow',class:null}}:{type:mark.type});return[{type:'text',text:run.text,marks:marks.length?marks:undefined}]});
    const listItem=(raw,parentType)=>{const item=Array.isArray(raw)?{content:raw}:raw,content=[{type:'paragraph',content:runNodes(item.content)}],children=item.children;if(children){const nested=Array.isArray(children)?{type:parentType,items:children}:children;content.push({type:nested.type==='ordered_list'?'orderedList':'bulletList',content:(nested.items||[]).map(child=>listItem(child,nested.type))})}return{type:'listItem',content}};
    const blockNode=block=>{if(block.type==='paragraph')return{type:'paragraph',content:runNodes(block.content)};if(block.type==='heading')return{type:'heading',attrs:{level:1},content:runNodes(block.content)};if(block.type==='ordered_list'||block.type==='bullet_list')return{type:block.type==='ordered_list'?'orderedList':'bulletList',content:(block.items||[]).map(item=>listItem(item,block.type))};if(block.type==='quote'){const body=Array.isArray(block.blocks)?block.blocks.map(blockNode).filter(Boolean):[{type:'paragraph',content:runNodes(block.content||[])}];return{type:'blockquote',content:body.length?body:[{type:'paragraph'}]}}if(block.type==='details'){const body=(block.blocks||[]).map(blockNode).filter(Boolean);return{type:'details',content:[{type:'detailsSummary',content:runNodes(block.title?.length?block.title:[{text:'Подробнее'}])},{type:'detailsBody',content:body.length?body:[{type:'paragraph'}]}]}}return null};
    const content=(doc?.blocks||[]).map(blockNode).filter(Boolean);return{type:'doc',content:content.length?content:[{type:'paragraph'}]}
  }

  let syncing=false;
  function syncTextarea(){const value=editor.getText({blockSeparator:'\n'});if(text.value===value)return;syncing=true;text.value=value;text.dispatchEvent(new Event('input',{bubbles:true}));syncing=false}
  const editor=new Editor({element:host,extensions:[StarterKit.configure({heading:{levels:[1]}}),Spoiler,DetailsSummary,DetailsBody,Details],content:plainDocument(text.value),editorProps:{attributes:{spellcheck:'true','aria-label':'Текст публикации'}},onUpdate(){syncTextarea()},onCreate(){syncTextarea()}});

  const buttonDock=document.createElement('div');buttonDock.className='composer-button-dock';buttonDock.setAttribute('aria-label','Кнопки публикации');host.append(buttonDock);
  function renderButtons(){buttonDock.replaceChildren();buttonDock.classList.toggle('has-buttons',buttons.length>0);buttons.forEach((button,index)=>{const el=document.createElement('button');el.type='button';el.className='composer-link-button';el.textContent=button.text||'Ссылка';el.title=button.url||'';el.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openButtonEditor(index)});buttonDock.append(el)})}
  function persistButtons(){renderButtons();syncTextarea();window.dispatchEvent(new CustomEvent('cosmo-rich-buttons-change',{detail:{buttons:[...buttons]}}))}
  function closeButtonEditor(){document.querySelector('.composer-button-modal-backdrop')?.remove()}
  function openButtonEditor(index=null){
    closeButtonEditor();const existing=Number.isInteger(index)?buttons[index]:null;let draft={text:existing?.text||'Ссылка',url:existing?.url||'https://'},step='text';
    const backdrop=document.createElement('div');backdrop.className='composer-button-modal-backdrop';backdrop.setAttribute('role','presentation');
    const modal=document.createElement('div');modal.className='composer-button-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
    const title=document.createElement('div');title.className='composer-button-modal-title';
    const input=document.createElement('input');input.className='composer-button-modal-input';input.type='text';
    const error=document.createElement('div');error.className='composer-button-modal-error';error.setAttribute('aria-live','polite');
    const actions=document.createElement('div');actions.className='composer-button-modal-actions';
    modal.append(title,input,error,actions);backdrop.append(modal);document.body.append(backdrop);
    const renderStep=()=>{actions.replaceChildren();error.textContent='';title.textContent=step==='text'?'Введите название:':'Введите ссылку:';input.value=step==='text'?draft.text:draft.url;input.type=step==='text'?'text':'url';input.placeholder=step==='text'?'Ссылка':'https://';if(existing){const del=document.createElement('button');del.type='button';del.className='composer-button-modal-delete';del.textContent='Удалить';del.addEventListener('click',()=>{buttons.splice(index,1);closeButtonEditor();persistButtons()});actions.append(del)}const secondary=document.createElement('button');secondary.type='button';secondary.className=step==='text'?'composer-button-modal-cancel':'composer-button-modal-back';secondary.textContent=step==='text'?'Отмена':'Назад';secondary.addEventListener('click',()=>{if(step==='text')closeButtonEditor();else{draft.url=input.value.trim();step='text';renderStep()}});const next=document.createElement('button');next.type='button';next.className='composer-button-modal-next';next.textContent=step==='text'?'Продолжить':'Готово';next.addEventListener('click',submit);actions.append(secondary,next);queueMicrotask(()=>{input.focus();input.select()})};
    const submit=()=>{if(step==='text'){const value=input.value.trim();if(!value){error.textContent='Введите название кнопки';return}draft.text=value;step='url';renderStep();return}const value=input.value.trim();try{const u=new URL(value);if(!/^https?:$/.test(u.protocol))throw 0;draft.url=u.href;if(existing)buttons[index]={text:draft.text,url:draft.url};else buttons.push({text:draft.text,url:draft.url});closeButtonEditor();persistButtons()}catch{error.textContent='Нужна ссылка http:// или https://'}};
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit()}else if(e.key==='Escape'){e.preventDefault();closeButtonEditor()}});backdrop.addEventListener('mousedown',e=>{if(e.target===backdrop)closeButtonEditor()});renderStep();
  }

  function restoreDraft(value){if(typeof value!=='string'||!value.startsWith(DRAFT_PREFIX))return false;try{const payload=JSON.parse(value.slice(DRAFT_PREFIX.length)),doc=payload?.document;if(doc?.schemaVersion!==1&&doc?.schemaVersion!==2)return false;buttons=Array.isArray(doc.buttons)?doc.buttons:[];editor.commands.setContent(postToTiptap(doc),{emitUpdate:true});renderButtons();diag('tiptap-draft-restored',{blocks:doc.blocks?.length||0,buttons:buttons.length,schemaVersion:doc.schemaVersion});return true}catch(error){diag('tiptap-draft-error',{error:error?.message||String(error)});return false}}
  function restorePlain(value){buttons=[];renderButtons();editor.commands.setContent(plainDocument(value),{emitUpdate:true})}
  function draftValue(){return DRAFT_PREFIX+JSON.stringify({version:3,document:toPostDocument()})}
  function clear(){buttons=[];renderButtons();editor.commands.clearContent(true)}

  text.addEventListener('input',()=>{if(syncing)return;const value=text.value;if(value.startsWith(DRAFT_PREFIX)){restoreDraft(value);return}if(editor.getText({blockSeparator:'\n'})!==value)restorePlain(value)});

  const menus=[...toolbar.querySelectorAll('.composer-tool-menu')];
  const blockMenu=menus.find(m=>m.querySelector('.composer-menu-trigger')?.textContent?.trim()==='Aa'),blockItems=blockMenu?[...blockMenu.querySelectorAll('.composer-menu-item')]:[];
  const formatMenu=menus.find(m=>m.querySelector('.composer-bold-tool')),formatItems=formatMenu?[...formatMenu.querySelectorAll('.composer-menu-item')]:[];
  const listMenu=menus.find(m=>m.querySelector('.composer-menu-trigger[title="Списки"]'));
  const linkMenu=menus.find(m=>m.querySelector('.composer-menu-trigger[title="Ссылка"]')),linkItems=linkMenu?[...linkMenu.querySelectorAll('.composer-menu-item')]:[];
  let listItems=listMenu?[...listMenu.querySelectorAll('.composer-menu-item')]:[];
  const listBox=listItems[0]?.parentElement;if(listBox&&listItems.length===3){for(const label of ['Увеличить уровень','Уменьшить уровень','Убрать список']){const b=document.createElement('button');b.type='button';b.className='composer-menu-item';b.textContent=label;listBox.append(b)}listItems=[...listMenu.querySelectorAll('.composer-menu-item')]}
  const closeMenu=menu=>menu?.classList.remove('open');const preserve=e=>e.preventDefault();
  formatItems.forEach(i=>i.addEventListener('mousedown',preserve));blockItems.forEach(i=>i.addEventListener('mousedown',preserve));listItems.forEach(i=>i.addEventListener('mousedown',preserve));linkItems.forEach(i=>i.addEventListener('mousedown',preserve));
  formatItems.forEach((item,index)=>item.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const c=editor.chain().focus();if(index===0)c.toggleBold();else if(index===1)c.toggleItalic();else if(index===2)c.toggleUnderline();else if(index===3)c.toggleStrike();else if(index===4)c.toggleMark('spoiler');c.run();closeMenu(formatMenu)}));
  blockItems.forEach((item,index)=>item.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const c=editor.chain().focus();if(index===0)c.setParagraph();else if(index===1)c.toggleHeading({level:1});else if(index===2)c.toggleBlockquote();c.run();closeMenu(blockMenu)}));
  function selectedLines(){const {from,to}=editor.state.selection;return editor.state.doc.textBetween(from,to,'\n').split('\n').map(x=>x.trim()).filter(Boolean)}
  function insertDetails(){const lines=selectedLines();if(!lines.length)return;const content=lines.map(line=>({type:'paragraph',content:[{type:'text',text:line}]}));const {from,to}=editor.state.selection;editor.chain().focus().deleteRange({from,to}).insertContent({type:'details',content:[{type:'detailsSummary',content:[{type:'text',text:'Подробнее'}]},{type:'detailsBody',content}]}).run()}
  listItems.forEach((item,index)=>item.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const c=editor.chain().focus();if(index===0)c.toggleOrderedList().run();else if(index===1)c.toggleBulletList().run();else if(index===2)insertDetails();else if(index===3)c.sinkListItem('listItem').run();else if(index===4)c.liftListItem('listItem').run();else if(index===5){if(editor.isActive('orderedList'))c.toggleOrderedList().run();else if(editor.isActive('bulletList'))c.toggleBulletList().run()}closeMenu(listMenu)}));

  if(linkItems[0])linkItems[0].addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const previous=editor.getAttributes('link').href||'https://',href=prompt('Ссылка',previous);if(!href)return;try{const u=new URL(href);if(!/^https?:$/.test(u.protocol))throw 0;editor.chain().focus().extendMarkRange('link').setLink({href:u.href}).run();closeMenu(linkMenu)}catch{alert('Нужна ссылка http:// или https://')}});
  if(linkItems[1])linkItems[1].addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeMenu(linkMenu);openButtonEditor(null)});

  toolbar.querySelector('[title="Отменить"]')?.addEventListener('click',e=>{e.preventDefault();editor.chain().focus().undo().run()});
  toolbar.querySelector('[title="Повторить"]')?.addEventListener('click',e=>{e.preventDefault();editor.chain().focus().redo().run()});
  const emojiBtn=toolbar.querySelector('[title="Emoji"]');if(emojiBtn){emojiBtn.addEventListener('mousedown',preserve);emojiBtn.addEventListener('click',e=>{e.preventDefault();document.querySelector('.composer-emoji-panel')?.remove();const panel=document.createElement('div');panel.className='composer-emoji-panel';for(const emoji of ['😀','😊','😍','🥰','✨','💫','🌿','🌸','💧','🧴','💆‍♀️','❤️','🤍','👍','🔥','📌','✅','⚠️','💡','👉']){const b=document.createElement('button');b.type='button';b.textContent=emoji;b.addEventListener('mousedown',preserve);b.addEventListener('click',()=>{editor.chain().focus().insertContent(emoji).run();panel.remove()});panel.append(b)}const r=emojiBtn.getBoundingClientRect();panel.style.left=`${Math.max(8,Math.min(innerWidth-228,r.left-170))}px`;panel.style.top=`${Math.max(8,r.top-190)}px`;document.body.append(panel)})}

  const nativeFetch=window.fetch.bind(window);window.fetch=(input,init={})=>{const url=typeof input==='string'?input:input?.url||'';if(init.body instanceof FormData&&(url.includes('/api/miniapp/preview')||url.includes('/api/miniapp/publish'))){const doc=toPostDocument();init.body.set('text',RICH_PREFIX+JSON.stringify(doc));diag('tiptap-publish',{url,blocks:doc.blocks.map(x=>x.type)})}return nativeFetch(input,init)};
  renderButtons();
  window.CosmoRichEditor={element:host,editor,toPostDocument,sync:syncTextarea,draftValue,restoreDraft,restorePlain,clear,openButtonEditor};
  if(window.__CosmoRichDraftPending){const pending=window.__CosmoRichDraftPending;delete window.__CosmoRichDraftPending;restoreDraft(pending)}
  window.dispatchEvent(new CustomEvent('cosmo-rich-ready'));diag('tiptap-ready',{version:'3.0.2',blockItems:blockItems.length,formatItems:formatItems.length,listItems:listItems.length});
})();
