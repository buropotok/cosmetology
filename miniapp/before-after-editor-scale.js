(()=>{
  const save=document.getElementById('editorSave');
  const opacityControl=document.getElementById('opacityControl');
  if(!save)return;

  save.addEventListener('click',()=>{
    // Photo transforms are already written into the shared BA state while the
    // gesture is active. Keep that exact state when the editor closes: the
    // legacy close path refits the preview and can otherwise clamp scale.
    if(!opacityControl?.hidden)return;
    const draft=window.CosmoBeforeAfterState?.getDraftSnapshot?.();
    if(!draft?.state)return;

    requestAnimationFrame(()=>requestAnimationFrame(async()=>{
      const current=window.CosmoBeforeAfterState?.getDraftSnapshot?.();
      if(!current?.state)return;
      const changed=['before','after'].some(role=>{
        const saved=draft.state[role],next=current.state[role];
        return saved&&next&&saved.scale!==next.scale;
      });
      if(!changed)return;
      await window.CosmoBeforeAfterState?.restoreDraft?.(draft.state,draft.files||[]);
    }));
  },true);
})();
