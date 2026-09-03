(()=>{
  const api=window.CosmoRichEditor,rich=api?.element,toolbar=document.querySelector('.composer-toolbar'),text=document.querySelector('#text');
  if(!api||!(rich instanceof HTMLElement)||!toolbar||!(text instanceof HTMLTextAreaElement))return;
  const diag=(kind,data={})=>window.CosmoDiagnostics?.log?.(kind,data);
  const DRAFT_PREFIX='\u2063COSMO_DRAFT_V2:';
  let savedRange=null,suppressHistory=false,restoredButtons=[];

  function selectionInside(){const s=getSelection();return !!(s&&s.rangeCount&&rich.contains(s.anchorNode)&&rich.contains(s.focusNode))}
  function rememberSelection(){if(selectionInside())savedRange=getSelection().getRangeAt(0).cloneRange()}
  function restoreSelection(){if(!savedRange)return false;const s=getSelection();s.removeAllRanges();s.addRange(savedRange);return true}
  document.addEventListener('selectionchange',rememberSelection);
  rich.addEventListener('keyup',rememberSelection);rich.addEventListener('mouseup',rememberSelection);rich.addEventListener('focus',rememberSelection);

  const originalToPostDocument=api.toPostDocument.bind(api);
  api.toPostDocument=()=>{const doc=originalToPostDocument();if(restoredButtons.length){const seen=new Set((doc.buttons||[]).map(x=>`${x.text}\n${x.url}`));const merged=[...(doc.buttons||[])];for(const button of restoredButtons){const key=`${button.text}\n${button.url}`;if(!seen.has(key)){seen.add(key);merged.push(button)}}if(merged.length)doc.buttons=merged}return doc};

  function appendRuns(parent,runs=[]){
    for(const run of runs){let node=document.createTextNode(run.text||'');for(const mark of [...(run.marks||[])].reverse()){let wrapper;if(mark.type==='bold')wrapper=document.createElement('strong');else if(mark.type==='italic')wrapper=document.createElement('em');else if(mark.type==='underline')wrapper=document.createElement('u');else if(mark.type==='strikethrough')wrapper=document.createElement('s');else if(mark.type==='spoiler'){wrapper=document.createElement('span');wrapper.dataset.cosmoMark='spoiler'}else if(mark.type==='link'){wrapper=document.createElement('a');wrapper.href=mark.href}else continue;wrapper.append(node);node=wrapper}parent.append(node)}
  }
  const normalizedItem=item=>Array.isArray(item)?{content:item}:item;
  function renderList(block,depth=0){const list=document.createElement(block.type==='ordered_list'?'ol':'ul');for(const raw of block.items||[]){const item=normalizedItem(raw),li=document.createElement('li');appendRuns(li,item.content);if(depth<1&&item.children?.length)li.append(renderList({type:block.type,items:item.children},depth+1));list.append(li)}return list}
  function renderDocument(doc,{sync=true}={}){
    suppressHistory=true;rich.replaceChildren();restoredButtons=Array.isArray(doc?.buttons)?doc.buttons.filter(x=>x&&typeof x.text==='string'&&typeof x.url==='string'):[];
    for(const block of doc?.blocks||[]){let el;if(block.type==='ordered_list'||block.type==='bullet_list'){rich.append(renderList(block));continue}if(block.type==='heading')el=document.createElement('h1');else if(block.type==='quote')el=document.createElement('blockquote');else if(block.type==='details'){el=document.createElement('details');const summary=document.createElement('summary');appendRuns(summary,block.title?.length?block.title:[{text:'Подробнее'}]);const body=document.createElement('div');appendRuns(body,block.content);el.append(summary,body);rich.append(el);continue}else el=document.createElement('div');appendRuns(el,block.content);rich.append(el)}
    if(!rich.childNodes.length)rich.append(document.createElement('div'));suppressHistory=false;if(sync)api.sync();savedRange=null;
  }
  function parseDraft(value){if(typeof value!=='string'||!value.startsWith(DRAFT_PREFIX))return null;try{const payload=JSON.parse(value.slice(DRAFT_PREFIX.length));return payload?.document?.schemaVersion===1?payload.document:null}catch{return null}}
  api.draftValue=()=>DRAFT_PREFIX+JSON.stringify({version:2,document:api.toPostDocument()});
  api.restoreDraft=value=>{const doc=parseDraft(value);if(!doc)return false;renderDocument(doc);resetHistory();diag('rich-draft-restored',{blocks:doc.blocks?.length||0,buttons:doc.buttons?.length||0});return true};
  api.restorePlain=value=>{restoredButtons=[];suppressHistory=true;rich.innerHTML=String(value||'').split('\n').map(line=>{const d=document.createElement('div');d.textContent=line;return d.outerHTML}).join('')||'<div></div>';suppressHistory=false;api.sync();resetHistory()};

  let history=[],historyIndex=-1,historyTimer=0;
  function historyValue(){return JSON.stringify(api.toPostDocument())}
  function pushHistory(){if(suppressHistory)return;const value=historyValue();if(history[historyIndex]===value)return;history=history.slice(0,historyIndex+1);history.push(value);if(history.length>80)history.shift();historyIndex=history.length-1;diag('rich-history-push',{index:historyIndex,size:history.length})}
  function resetHistory(){history=[];historyIndex=-1;pushHistory()}
  function scheduleHistory(){clearTimeout(historyTimer);historyTimer=setTimeout(pushHistory,0)}
  function restoreHistory(index){if(index<0||index>=history.length)return;try{const doc=JSON.parse(history[index]);historyIndex=index;renderDocument(doc);diag('rich-history-restore',{index,size:history.length})}catch(error){diag('rich-history-error',{error:error?.message||String(error)})}}
  function undo(){if(historyIndex>0)restoreHistory(historyIndex-1)}
  function redo(){if(historyIndex<history.length-1)restoreHistory(historyIndex+1)}
  rich.addEventListener('input',scheduleHistory);
  rich.addEventListener('beforeinput',event=>{if(event.isTrusted)window.CosmoSofaDraft?.cancelRestore?.()});
  toolbar.addEventListener('pointerdown',event=>{if(event.target.closest?.('button'))window.CosmoSofaDraft?.cancelRestore?.()},true);

  function topBlock(node){if(node?.nodeType===Node.TEXT_NODE)node=node.parentElement;let current=node instanceof Element?node:null;while(current&&current.parentElement!==rich)current=current.parentElement;return current&&current.parentElement===rich?current:null}
  function replaceBlockElement(block,tag){if(!block)return null;const wanted=tag==='text'?'div':tag;if(block.tagName.toLowerCase()===wanted)return block;const el=document.createElement(wanted);while(block.firstChild)el.append(block.firstChild);block.replaceWith(el);return el}
  function applyBlock(tag){
    if(!restoreSelection())return;const range=savedRange.cloneRange(),start=topBlock(range.startContainer),end=topBlock(range.endContainer);
    let target=null;
    if(start&&start===end&&['DIV','P','H1','H2','H3','BLOCKQUOTE'].includes(start.tagName))target=replaceBlockElement(start,tag);
    else if(!range.collapsed){target=document.createElement(tag==='text'?'div':tag);const fragment=range.extractContents();target.append(fragment);range.insertNode(target)}
    else{target=document.createElement(tag==='text'?'div':tag);target.append(document.createElement('br'));range.insertNode(target)}
    if(target){const r=document.createRange();r.selectNodeContents(target);const s=getSelection();s.removeAllRanges();s.addRange(r);savedRange=r.cloneRange();api.sync();pushHistory();diag('rich-block-stable',{tag,html:rich.innerHTML.slice(0,1600)})}
    toolbar.querySelectorAll('.composer-tool-menu.open').forEach(x=>x.classList.remove('open'));
  }

  const menus=[...toolbar.querySelectorAll('.composer-tool-menu')],blockMenu=menus.find(m=>m.querySelector('.composer-menu-trigger')?.textContent?.trim()==='Aa'),blockItems=blockMenu?[...blockMenu.querySelectorAll('.composer-menu-item')]:[];
  toolbar.addEventListener('click',event=>{
    const button=event.target.closest?.('button');if(!button)return;
    if(button.matches('[title="Отменить"]')){event.preventDefault();event.stopImmediatePropagation();undo();return}
    if(button.matches('[title="Повторить"]')){event.preventDefault();event.stopImmediatePropagation();redo();return}
    const index=blockItems.indexOf(button);if(index>=0){event.preventDefault();event.stopImmediatePropagation();applyBlock(index===1?'h1':index===2?'blockquote':'text')}
  },true);

  resetHistory();
  if(window.__CosmoRichDraftPending){const pending=window.__CosmoRichDraftPending;delete window.__CosmoRichDraftPending;api.restoreDraft(pending)}
  window.dispatchEvent(new CustomEvent('cosmo-rich-ready'));
  diag('rich-stability-ready',{history:true,richDraft:true,stableBlocks:true});
})();
