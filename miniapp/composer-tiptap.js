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
    .composer-emoji-panel{position:absolute;z-index:40;display:flex;flex-wrap:wrap;gap:4px;width:220px;padding:8px;background:#fff;border:1px solid #ddd;border-radius:12px;box-shadow:0 8px 30px #0002}
    .composer-emoji-panel button{border:0;background:transparent;font-size:24px;padding:4px}
    .composer-tool[title="Изображение"]{display:none!important}
  `;
  document.head.append(style);

  const Spoiler=Mark.create({
    name:'spoiler',
    parseHTML(){return[{tag:'span[data-cosmo-spoiler]'}]},
    renderHTML({HTMLAttributes}){return['span',mergeAttributes(HTMLAttributes,{'data-cosmo-spoiler':'1'}),0]},
  });
  const DetailsSummary=Node.create({
    name:'detailsSummary',content:'inline*',defining:true,
    parseHTML(){return[{tag:'summary'}]},renderHTML({HTMLAttributes}){return['summary',mergeAttributes(HTMLAttributes),0]},
  });
  const DetailsBody=Node.create({
    name:'detailsBody',content:'block+',defining:true,
    parseHTML(){return[{tag:'div[data-cosmo-details-body]'}]},renderHTML({HTMLAttributes}){return['div',mergeAttributes(HTMLAttributes,{'data-cosmo-details-body':'1'}),0]},
  });
  const Details=Node.create({
    name:'details',group:'block',content:'detailsSummary detailsBody',isolating:true,
    parseHTML(){return[{tag:'details'}]},renderHTML({HTMLAttributes}){return['details',mergeAttributes(HTMLAttributes),0]},
  });

  const plainDocument=value=>({type:'doc',content:String(value||'').replace(/\r\n?/g,'\n').split('\n').map(line=>({type:'paragraph',content:line?[{type:'text',text:line}]:undefined}))});
  const markToPost=mark=>mark.type==='strike'?{type:'strikethrough'}:mark.type==='link'?{type:'link',href:mark.attrs?.href||''}:{type:mark.type};
  function inlineRuns(node){
    const runs=[];
    const visit=n=>{
      if(n.type==='text'&&n.text){const marks=(n.marks||[]).map(markToPost).filter(m=>['bold','italic','underline','strikethrough','spoiler','link'].includes(m.type));runs.push(marks.length?{text:n.text,marks}:{text:n.text});return}
      if(n.type==='hardBreak'){runs.push({text:'\n'});return}
      for(const child of n.content||[])visit(child);
    };
    visit(node);return runs;
  }
  const normalizeListItem=node=>{
    const first=(node.content||[]).find(n=>n.type==='paragraph');
    const item={content:first?inlineRuns(first):[]};
    const nested=(node.content||[]).find(n=>n.type==='orderedList'||n.type==='bulletList');
    if(nested){const children=(nested.content||[]).filter(n=>n.type==='listItem').map(normalizeListItem);if(children.length)item.children=children}
    return item;
  };
  function nodeText(node){return (node.content||[]).map(child=>child.type==='text'?(child.text||''):child.type==='hardBreak'?'\n':nodeText(child)).join(childSeparator(node))}
  function childSeparator(node){return ['doc','blockquote','detailsBody'].includes(node.type)?'\n':''}
  let buttons=[];
  function toPostDocument(){
    const json=editor.getJSON(),blocks=[];
    for(const node of json.content||[]){
      if(node.type==='paragraph'){blocks.push({type:'paragraph',content:inlineRuns(node)});continue}
      if(node.type==='heading'){blocks.push({type:'heading',content:inlineRuns(node)});continue}
      if(node.type==='blockquote'){blocks.push({type:'quote',content:inlineRuns(node)});continue}
      if(node.type==='orderedList'||node.type==='bulletList'){blocks.push({type:node.type==='orderedList'?'ordered_list':'bullet_list',items:(node.content||[]).filter(n=>n.type==='listItem').map(normalizeListItem)});continue}
      if(node.type==='details'){
        const summary=(node.content||[]).find(n=>n.type==='detailsSummary'),body=(node.content||[]).find(n=>n.type==='detailsBody');
        blocks.push({type:'details',title:summary?inlineRuns(summary):[{text:'Подробнее'}],content:body?inlineRuns(body):[]});continue
      }
    }
    if(!blocks.length)blocks.push({type:'paragraph',content:[{text:''}]});
    return{schemaVersion:1,blocks,...(buttons.length?{buttons:[...buttons]}:{})};
  }
  function postToTiptap(doc){
    const runNodes=runs=>(runs||[]).flatMap(run=>{
      if(!run.text)return[];
      const marks=(run.marks||[]).map(mark=>mark.type==='strikethrough'?{type:'strike'}:mark.type==='link'?{type:'link',attrs:{href:mark.href,target:'_blank',rel:'noopener noreferrer nofollow',class:null}}:{type:mark.type});
      return[{type:'text',text:run.text,marks:marks.length?marks:undefined}];
    });
    const listItem=item=>{item=Array.isArray(item)?{content:item}:item;const content=[{type:'paragraph',content:runNodes(item.content)}];if(item.children?.length)content.push({type:'bulletList',content:item.children.map(listItem)});return{type:'listItem',content}};
    const content=[];
    for(const block of doc?.blocks||[]){
      if(block.type==='paragraph')content.push({type:'paragraph',content:runNodes(block.content)});
      else if(block.type==='heading')content.push({type:'heading',attrs:{level:1},content:runNodes(block.content)});
      else if(block.type==='quote')content.push({type:'blockquote',content:[{type:'paragraph',content:runNodes(block.content)}]});
      else if(block.type==='ordered_list'||block.type==='bullet_list')content.push({type:block.type==='ordered_list'?'orderedList':'bulletList',content:(block.items||[]).map(listItem)});
      else if(block.type==='details')content.push({type:'details',content:[{type:'detailsSummary',content:runNodes(block.title?.length?block.title:[{text:'Подробнее'}])},{type:'detailsBody',content:[{type:'paragraph',content:runNodes(block.content)}]}]});
    }
    return{type:'doc',content:content.length?content:[{type:'paragraph'}]};
  }

  let syncing=false;
  function syncTextarea(){const value=editor.getText({blockSeparator:'\n'});if(text.value===value)return;syncing=true;text.value=value;text.dispatchEvent(new Event('input',{bubbles:true}));syncing=false}
  const editor=new Editor({
    element:host,
    extensions:[StarterKit.configure({heading:{levels:[1]}}),Spoiler,DetailsSummary,DetailsBody,Details],
    content:plainDocument(text.value),
    editorProps:{attributes:{spellcheck:'true','aria-label':'Текст публикации'}},
    onUpdate(){syncTextarea()},
    onCreate(){syncTextarea()},
  });

  function restoreDraft(value){
    if(typeof value!=='string'||!value.startsWith(DRAFT_PREFIX))return false;
    try{const payload=JSON.parse(value.slice(DRAFT_PREFIX.length)),doc=payload?.document;if(doc?.schemaVersion!==1)return false;buttons=Array.isArray(doc.buttons)?doc.buttons:[];editor.commands.setContent(postToTiptap(doc),{emitUpdate:true});diag('tiptap-draft-restored',{blocks:doc.blocks?.length||0,buttons:buttons.length});return true}catch(error){diag('tiptap-draft-error',{error:error?.message||String(error)});return false}
  }
  function restorePlain(value){buttons=[];editor.commands.setContent(plainDocument(value),{emitUpdate:true})}
  function draftValue(){return DRAFT_PREFIX+JSON.stringify({version:3,document:toPostDocument()})}
  function clear(){buttons=[];editor.commands.clearContent(true)}

  text.addEventListener('input',()=>{if(syncing)return;const value=text.value;if(value.startsWith(DRAFT_PREFIX)){restoreDraft(value);return}if(editor.getText({blockSeparator:'\n'})!==value)restorePlain(value)});

  const menus=[...toolbar.querySelectorAll('.composer-tool-menu')];
  const blockMenu=menus.find(m=>m.querySelector('.composer-menu-trigger')?.textContent?.trim()==='Aa'),blockItems=blockMenu?[...blockMenu.querySelectorAll('.composer-menu-item')]:[];
  const formatMenu=menus.find(m=>m.querySelector('.composer-bold-tool')),formatItems=formatMenu?[...formatMenu.querySelectorAll('.composer-menu-item')]:[];
  const listMenu=menus.find(m=>m.querySelector('.composer-menu-trigger[title="Списки"]'));
  const linkMenu=menus.find(m=>m.querySelector('.composer-menu-trigger[title="Ссылка"]')),linkItems=linkMenu?[...linkMenu.querySelectorAll('.composer-menu-item')]:[];
  let listItems=listMenu?[...listMenu.querySelectorAll('.composer-menu-item')]:[];
  const listBox=listItems[0]?.parentElement;if(listBox&&listItems.length===3){for(const label of ['Увеличить уровень','Уменьшить уровень','Убрать список']){const b=document.createElement('button');b.type='button';b.className='composer-menu-item';b.textContent=label;listBox.append(b)}listItems=[...listMenu.querySelectorAll('.composer-menu-item')]}
  const closeMenu=menu=>menu?.classList.remove('open');
  const preserve=e=>e.preventDefault();
  formatItems.forEach(i=>i.addEventListener('mousedown',preserve));blockItems.forEach(i=>i.addEventListener('mousedown',preserve));listItems.forEach(i=>i.addEventListener('mousedown',preserve));linkItems.forEach(i=>i.addEventListener('mousedown',preserve));

  formatItems.forEach((item,index)=>item.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const c=editor.chain().focus();if(index===0)c.toggleBold();else if(index===1)c.toggleItalic();else if(index===2)c.toggleUnderline();else if(index===3)c.toggleStrike();else if(index===4)c.toggleMark('spoiler');c.run();closeMenu(formatMenu)}));
  blockItems.forEach((item,index)=>item.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const c=editor.chain().focus();if(index===0)c.setParagraph();else if(index===1)c.toggleHeading({level:1});else if(index===2)c.toggleBlockquote();c.run();closeMenu(blockMenu)}));

  function selectedLines(){const {from,to}=editor.state.selection;return editor.state.doc.textBetween(from,to,'\n').split('\n').map(x=>x.trim()).filter(Boolean)}
  function insertDetails(){const lines=selectedLines();if(!lines.length)return;const content=lines.map((line,index)=>index?{type:'paragraph',content:[{type:'text',text:line}]}:{type:'paragraph',content:[{type:'text',text:line}]});const {from,to}=editor.state.selection;editor.chain().focus().deleteRange({from,to}).insertContent({type:'details',content:[{type:'detailsSummary',content:[{type:'text',text:'Подробнее'}]},{type:'detailsBody',content}]}).run()}
  listItems.forEach((item,index)=>item.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const c=editor.chain().focus();if(index===0)c.toggleOrderedList().run();else if(index===1)c.toggleBulletList().run();else if(index===2)insertDetails();else if(index===3)c.sinkListItem('listItem').run();else if(index===4)c.liftListItem('listItem').run();else if(index===5){if(editor.isActive('orderedList'))c.toggleOrderedList().run();else if(editor.isActive('bulletList'))c.toggleBulletList().run()}closeMenu(listMenu)}));

  if(linkItems[0])linkItems[0].addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const previous=editor.getAttributes('link').href||'https://',href=prompt('Ссылка',previous);if(!href)return;try{const u=new URL(href);if(!/^https?:$/.test(u.protocol))throw 0;editor.chain().focus().extendMarkRange('link').setLink({href:u.href}).run();closeMenu(linkMenu)}catch{alert('Нужна ссылка http:// или https://')}});
  if(linkItems[1])linkItems[1].addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const label=prompt('Текст кнопки','Подробнее');if(!label)return;const url=prompt('Ссылка кнопки','https://');if(!url)return;try{const u=new URL(url);if(!/^https?:$/.test(u.protocol))throw 0;buttons.push({text:label.trim(),url:u.href});linkItems[1].textContent=`✓ Кнопка: ${label.trim()}`;closeMenu(linkMenu);syncTextarea()}catch{alert('Нужна ссылка http:// или https://')}});

  toolbar.querySelector('[title="Отменить"]')?.addEventListener('click',e=>{e.preventDefault();editor.chain().focus().undo().run()});
  toolbar.querySelector('[title="Повторить"]')?.addEventListener('click',e=>{e.preventDefault();editor.chain().focus().redo().run()});
  const emojiBtn=toolbar.querySelector('[title="Emoji"]');if(emojiBtn){emojiBtn.addEventListener('mousedown',preserve);emojiBtn.addEventListener('click',e=>{e.preventDefault();document.querySelector('.composer-emoji-panel')?.remove();const panel=document.createElement('div');panel.className='composer-emoji-panel';for(const emoji of ['😀','😊','😍','🥰','✨','💫','🌿','🌸','💧','🧴','💆‍♀️','❤️','🤍','👍','🔥','📌','✅','⚠️','💡','👉']){const b=document.createElement('button');b.type='button';b.textContent=emoji;b.addEventListener('mousedown',preserve);b.addEventListener('click',()=>{editor.chain().focus().insertContent(emoji).run();panel.remove()});panel.append(b)}const r=emojiBtn.getBoundingClientRect();panel.style.left=`${Math.max(8,Math.min(innerWidth-228,r.left-170))}px`;panel.style.top=`${Math.max(8,r.top-190)}px`;document.body.append(panel)})}

  const nativeFetch=window.fetch.bind(window);window.fetch=(input,init={})=>{const url=typeof input==='string'?input:input?.url||'';if(init.body instanceof FormData&&(url.includes('/api/miniapp/preview')||url.includes('/api/miniapp/publish'))){const doc=toPostDocument();init.body.set('text',RICH_PREFIX+JSON.stringify(doc));diag('tiptap-publish',{url,blocks:doc.blocks.map(x=>x.type)})}return nativeFetch(input,init)};

  window.CosmoRichEditor={element:host,editor,toPostDocument,sync:syncTextarea,draftValue,restoreDraft,restorePlain,clear};
  if(window.__CosmoRichDraftPending){const pending=window.__CosmoRichDraftPending;delete window.__CosmoRichDraftPending;restoreDraft(pending)}
  window.dispatchEvent(new CustomEvent('cosmo-rich-ready'));
  diag('tiptap-ready',{version:'3.0.2',blockItems:blockItems.length,formatItems:formatItems.length,listItems:listItems.length});
})();
