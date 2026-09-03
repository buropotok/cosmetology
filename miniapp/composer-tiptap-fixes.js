(()=>{
  const host=document.querySelector('.composer-tiptap-editor');
  if(!host)return;

  const style=document.createElement('style');
  style.textContent=`
    .composer-tiptap-editor details>summary{list-style:none;display:flex;align-items:flex-start;gap:4px;cursor:text}
    .composer-tiptap-editor details>summary::-webkit-details-marker{display:none}
    .composer-tiptap-editor .cosmo-details-arrow{display:inline-flex;align-items:center;justify-content:center;flex:0 0 24px;width:24px;height:24px;margin:-2px 0 -2px -4px;border:0;background:transparent;padding:0;color:#70757d;font:600 16px/1 sans-serif;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:manipulation}
    .composer-tiptap-editor details:not([open])>.cosmo-details-body,.composer-tiptap-editor details:not([open])>[data-cosmo-details-body]{display:none}
  `;
  document.head.append(style);

  function decorate(details){
    if(!(details instanceof HTMLDetailsElement)||details.dataset.cosmoArrowReady==='1')return;
    const summary=details.querySelector(':scope > summary');
    if(!summary)return;
    details.dataset.cosmoArrowReady='1';
    const arrow=document.createElement('span');
    arrow.className='cosmo-details-arrow';
    arrow.setAttribute('contenteditable','false');
    arrow.setAttribute('role','button');
    arrow.setAttribute('aria-label','Раскрыть или свернуть');
    arrow.textContent=details.open?'▾':'▸';
    summary.prepend(arrow);
  }

  function decorateAll(){host.querySelectorAll('details').forEach(decorate)}
  decorateAll();
  new MutationObserver(decorateAll).observe(host,{childList:true,subtree:true});

  // Only the arrow controls open/closed state. The summary text remains
  // fully editable and clicking it only moves the caret.
  host.addEventListener('pointerdown',event=>{
    const arrow=event.target.closest?.('.cosmo-details-arrow');
    if(!arrow||!host.contains(arrow))return;
    event.preventDefault();
    event.stopPropagation();
  },true);

  host.addEventListener('click',event=>{
    const arrow=event.target.closest?.('.cosmo-details-arrow');
    if(!arrow||!host.contains(arrow))return;
    const details=arrow.closest('details');
    if(!details)return;
    event.preventDefault();
    event.stopPropagation();
    details.toggleAttribute('open');
    arrow.textContent=details.open?'▾':'▸';
    window.CosmoDiagnostics?.log?.('tiptap-details-arrow-toggle',{open:details.open});
  },true);
})();
