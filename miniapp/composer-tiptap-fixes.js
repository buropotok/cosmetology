(()=>{
  const host=document.querySelector('.composer-tiptap-editor');
  if(!host)return;

  const log=(kind,data={})=>window.CosmoDiagnostics?.log?.(kind,data);
  const getSummary=target=>{
    const element=target instanceof Element?target:target?.parentElement;
    const summary=element?.closest?.('summary');
    return summary&&host.contains(summary)?summary:null;
  };
  const isArrowHit=(event,summary)=>{
    const rect=summary.getBoundingClientRect();
    const style=getComputedStyle(summary);
    const direction=style.direction;
    const markerWidth=28;
    return direction==='rtl'
      ? event.clientX>=rect.right-markerWidth&&event.clientX<=rect.right
      : event.clientX>=rect.left&&event.clientX<=rect.left+markerWidth;
  };

  log('details-toggle-fix-ready',{detailsCount:host.querySelectorAll('details').length});

  host.addEventListener('click',event=>{
    const summary=getSummary(event.target);
    if(!summary||!isArrowHit(event,summary))return;
    const details=summary.parentElement;
    if(!(details instanceof HTMLDetailsElement))return;

    // ProseMirror/contenteditable WebViews may suppress the native <summary>
    // default action. Toggle only for the disclosure-marker hit area; clicks
    // on the editable summary text remain untouched.
    event.preventDefault();
    details.open=!details.open;
    log('details-arrow-toggle',{open:details.open,clientX:event.clientX,clientY:event.clientY});
  },true);

  host.addEventListener('toggle',event=>{
    const details=event.target;
    if(!(details instanceof HTMLDetailsElement)||!host.contains(details))return;
    log('details-toggle',{open:details.open});
  },true);
})();
