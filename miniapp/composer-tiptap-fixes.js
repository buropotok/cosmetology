(()=>{
  const host=document.querySelector('.composer-tiptap-editor');
  if(!host)return;

  const log=(kind,data={})=>window.CosmoDiagnostics?.log?.(kind,data);
  const getDetails=target=>{
    const element=target instanceof Element?target:target?.parentElement;
    const details=element?.closest?.('details');
    return details instanceof HTMLDetailsElement&&host.contains(details)?details:null;
  };
  const isArrowHit=(event,details)=>{
    const summary=details.querySelector(':scope > summary');
    if(!(summary instanceof HTMLElement))return false;
    const rect=summary.getBoundingClientRect();
    const direction=getComputedStyle(summary).direction;
    const markerWidth=32;
    return direction==='rtl'
      ? event.clientX>=rect.right&&event.clientX<=rect.right+markerWidth
      : event.clientX>=rect.left-markerWidth&&event.clientX<=rect.left;
  };

  log('details-toggle-fix-ready',{detailsCount:host.querySelectorAll('details').length,mode:'outside-summary-marker'});

  host.addEventListener('click',event=>{
    const details=getDetails(event.target);
    if(!details||!isArrowHit(event,details))return;

    // In Telegram WebView the native disclosure marker can hit DETAILS rather
    // than SUMMARY. Toggle only in the marker strip immediately beside the
    // summary; the editable summary text and all other editor content remain untouched.
    event.preventDefault();
    details.open=!details.open;
    log('details-arrow-toggle',{open:details.open,clientX:event.clientX,clientY:event.clientY,targetTag:event.target instanceof Element?event.target.tagName:null});
  },true);

  host.addEventListener('toggle',event=>{
    const details=event.target;
    if(!(details instanceof HTMLDetailsElement)||!host.contains(details))return;
    log('details-toggle',{open:details.open});
  },true);
})();
