(()=>{
  const host=document.querySelector('.composer-tiptap-editor');
  if(!host)return;

  const log=(kind,data={})=>window.CosmoDiagnostics?.log?.(kind,data);
  const describe=target=>{
    const element=target instanceof Element?target:target?.parentElement;
    const summary=element?.closest?.('summary');
    const details=summary?.closest?.('details')||element?.closest?.('details');
    return {
      targetTag:element?.tagName||null,
      targetClass:element?.className||null,
      hasSummary:!!summary,
      hasDetails:!!details,
      open:details instanceof HTMLDetailsElement?details.open:null,
      summaryText:summary?.textContent?.slice(0,120)||null,
      detailsHtml:details?.outerHTML?.slice(0,800)||null,
    };
  };

  log('details-diagnostics-ready',{
    detailsCount:host.querySelectorAll('details').length,
    summaryCount:host.querySelectorAll('summary').length,
  });

  // Passive diagnostics only. Never preventDefault, stopPropagation,
  // toggle attributes or mutate ProseMirror-owned DOM.
  for(const type of ['pointerdown','pointerup','click']){
    host.addEventListener(type,event=>{
      const data=describe(event.target);
      if(!data.hasDetails&&!data.hasSummary)return;
      log(`details-${type}`,{
        ...data,
        defaultPrevented:event.defaultPrevented,
        clientX:event.clientX,
        clientY:event.clientY,
      });
    },true);
  }

  host.addEventListener('toggle',event=>{
    const details=event.target;
    if(!(details instanceof HTMLDetailsElement)||!host.contains(details))return;
    log('details-toggle',{
      open:details.open,
      detailsHtml:details.outerHTML.slice(0,800),
    });
  },true);
})();
