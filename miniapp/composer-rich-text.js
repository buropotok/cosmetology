(()=>{
  const text=document.querySelector('#text');
  const toolbar=document.querySelector('.composer-toolbar');
  if(!(text instanceof HTMLTextAreaElement)||!toolbar)return;

  const rich=document.createElement('div');
  rich.className='composer-bodytext composer-rich-editor';
  rich.contentEditable='true';
  rich.setAttribute('role','textbox');
  rich.setAttribute('aria-multiline','true');
  rich.dataset.placeholder='Введите текст публикации…';
  rich.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;min-height:250px;max-height:none;overflow:auto;';
  text.hidden=true;
  text.insertAdjacentElement('beforebegin',rich);

  let syncing=false;
  let savedRange=null;
  const escapeText=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const setPlain=value=>{rich.innerHTML=escapeText(value).replace(/\n/g,'<br>')||''};
  const plain=()=>rich.innerText.replace(/\r\n?/g,'\n').replace(/\n$/,'');

  function syncTextarea(){
    const value=plain();
    if(text.value===value)return;
    syncing=true;text.value=value;text.dispatchEvent(new Event('input',{bubbles:true}));syncing=false;
  }
  function selectionInside(){
    const selection=getSelection();
    return selection&&selection.rangeCount&&rich.contains(selection.anchorNode)&&rich.contains(selection.focusNode);
  }
  function rememberSelection(){if(selectionInside())savedRange=getSelection().getRangeAt(0).cloneRange()}
  function restoreSelection(){if(!savedRange)return false;const selection=getSelection();selection.removeAllRanges();selection.addRange(savedRange);return true}

  function runsFromNode(node,marks=[]){
    if(node.nodeType===Node.TEXT_NODE)return node.nodeValue?[{text:node.nodeValue,marks:[...marks]}]:[];
    if(node.nodeType!==Node.ELEMENT_NODE)return[];
    const el=node,tag=el.tagName.toLowerCase(),next=[...marks];
    if(tag==='b'||tag==='strong')next.push({type:'bold'});
    const out=[];
    for(const child of el.childNodes)out.push(...runsFromNode(child,next));
    if(tag==='br')out.push({text:'\n',marks:[...marks]});
    return out;
  }
  function postDocument(){
    const raw=runsFromNode(rich).filter(run=>run.text);
    const blocks=[];let current=[];
    const push=()=>{blocks.push({type:'paragraph',content:current.length?current:[{text:''}]});current=[]};
    for(const run of raw){
      const parts=run.text.split('\n');
      parts.forEach((part,index)=>{if(part)current.push({text:part,...(run.marks.length?{marks:run.marks}: {})});if(index<parts.length-1)push()});
    }
    if(current.length||!blocks.length)push();
    return {schemaVersion:1,blocks};
  }

  rich.addEventListener('input',()=>{syncTextarea();rememberSelection()});
  rich.addEventListener('keyup',rememberSelection);
  rich.addEventListener('mouseup',rememberSelection);
  rich.addEventListener('focus',rememberSelection);
  document.addEventListener('selectionchange',rememberSelection);
  text.addEventListener('input',()=>{if(!syncing&&plain()!==text.value)setPlain(text.value)});
  setPlain(text.value);

  const formatMenu=[...toolbar.querySelectorAll('.composer-tool-menu')].find(menu=>menu.querySelector('.composer-bold-tool'));
  const boldItem=formatMenu?.querySelector('.composer-menu-item');
  if(boldItem){
    boldItem.addEventListener('mousedown',event=>event.preventDefault());
    boldItem.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      if(!restoreSelection())return;
      document.execCommand('bold',false);
      rich.focus();syncTextarea();rememberSelection();
      formatMenu.classList.remove('open');
    });
  }

  const nativeFetch=window.fetch.bind(window);
  window.fetch=(input,init={})=>{
    const url=typeof input==='string'?input:input?.url||'';
    if(init.body instanceof FormData&&(url.includes('/api/miniapp/preview')||url.includes('/api/miniapp/publish'))){
      syncTextarea();init.body.set('post_document',JSON.stringify(postDocument()));
    }
    return nativeFetch(input,init);
  };

  window.CosmoRichEditor={element:rich,toPostDocument:postDocument,sync:syncTextarea};
})();
