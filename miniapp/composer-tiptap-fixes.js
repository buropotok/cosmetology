(()=>{
  const host=document.querySelector('.composer-tiptap-editor');
  if(!host)return;

  // Visual arrow only: do not inject nodes into ProseMirror-owned DOM.
  // This keeps the editor document, selection mapping, lists and serialization untouched.
  const style=document.createElement('style');
  style.textContent=`
    .composer-tiptap-editor details>summary{
      list-style:none;
      position:relative;
      padding-left:26px;
      cursor:text;
    }
    .composer-tiptap-editor details>summary::-webkit-details-marker{display:none}
    .composer-tiptap-editor details>summary::before{
      content:'▸';
      position:absolute;
      left:2px;
      top:0;
      width:22px;
      line-height:1.4;
      text-align:center;
      color:#70757d;
      font-weight:600;
      cursor:pointer;
      user-select:none;
      -webkit-user-select:none;
    }
    .composer-tiptap-editor details[open]>summary::before{content:'▾'}
  `;
  document.head.append(style);

  const getSummary=target=>{
    const element=target instanceof Element?target:target?.parentElement;
    const summary=element?.closest?.('summary');
    return summary&&host.contains(summary)?summary:null;
  };
  const isArrowHit=(event,summary)=>{
    const rect=summary.getBoundingClientRect();
    return event.clientX>=rect.left&&event.clientX<=rect.left+26;
  };

  // Prevent caret placement only when the explicit arrow area is pressed.
  host.addEventListener('pointerdown',event=>{
    const summary=getSummary(event.target);
    if(!summary||!isArrowHit(event,summary))return;
    event.preventDefault();
    event.stopPropagation();
  },true);

  host.addEventListener('click',event=>{
    const summary=getSummary(event.target);
    if(!summary)return;

    // Disable native <details> toggling for the whole summary. Text clicks stay
    // editable because caret placement already happened during pointerdown.
    event.preventDefault();
    if(!isArrowHit(event,summary))return;

    event.stopPropagation();
    const details=summary.parentElement;
    if(!(details instanceof HTMLDetailsElement))return;
    details.open=!details.open;
    window.CosmoDiagnostics?.log?.('tiptap-details-arrow-toggle',{open:details.open});
  },true);
})();
