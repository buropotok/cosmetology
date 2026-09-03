(()=>{
  const api=window.CosmoRichEditor,text=document.querySelector('#text');
  if(!api||!(text instanceof HTMLTextAreaElement))return;
  const diag=(kind,data={})=>window.CosmoDiagnostics?.log?.(kind,data);
  const DRAFT_PREFIX='\u2063COSMO_DRAFT_V3:';

  // Draft restore may finish before the editor module loads. If so, drafts.js
  // leaves the serialized rich document in the shadow textarea; consume it now.
  if(text.value.startsWith(DRAFT_PREFIX))api.restoreDraft?.(text.value);

  // Keep the existing draft transport/images/revision logic intact, but replace
  // only the text field of draft POSTs with the structured editor snapshot.
  const nativeFetch=window.fetch.bind(window);
  window.fetch=(input,init={})=>{
    const url=typeof input==='string'?input:input?.url||'';
    if(init.method?.toUpperCase()==='POST'&&init.body instanceof FormData&&url.includes('/api/miniapp/draft')){
      const value=api.draftValue?.();
      if(value){init.body.set('text',value);diag('tiptap-draft-save',{encodedLength:value.length,plainLength:text.value.length})}
    }
    return nativeFetch(input,init);
  };
  diag('tiptap-draft-bridge-ready');
})();
