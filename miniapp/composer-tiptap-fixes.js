(()=>{
  const host=document.querySelector('.composer-tiptap-editor');
  if(!host)return;

  // ProseMirror owns the editable DOM, so the browser's native <details>
  // toggle is not reliable in Telegram WebView. Keep the editor document
  // untouched and toggle only the rendered open state.
  host.addEventListener('click',event=>{
    const summary=event.target.closest?.('summary');
    if(!summary||!host.contains(summary))return;
    const details=summary.closest('details');
    if(!details)return;
    event.preventDefault();
    event.stopPropagation();
    details.toggleAttribute('open');
    window.CosmoDiagnostics?.log?.('tiptap-details-toggle',{open:details.hasAttribute('open')});
  },true);
})();
