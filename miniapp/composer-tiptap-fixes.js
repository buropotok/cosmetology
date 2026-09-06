(()=>{
  const api=window.CosmoRichEditor;
  const editor=api?.editor;
  const host=document.querySelector('.composer-tiptap-editor');
  if(!editor?.view||!host)return;

  const log=(kind,data={})=>window.CosmoDiagnostics?.log?.(kind,data);

  const style=document.createElement('style');
  style.textContent=`
    .composer-tiptap-editor .cosmo-details-node{
      margin:8px 0;
      padding:0 0 8px;
      border:0;
      border-bottom:1px solid #e5e5ea;
      border-radius:0;
      background:transparent;
      display:grid;
      grid-template-columns:24px minmax(0,1fr);
      column-gap:4px;
      align-items:start;
    }
    .composer-tiptap-editor .cosmo-details-toggle{
      grid-column:1;
      grid-row:1;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:24px;
      height:24px;
      padding:0;
      border:0;
      border-radius:0;
      background:transparent;
      color:inherit;
      font:inherit;
      line-height:1;
      cursor:pointer;
      touch-action:manipulation;
      user-select:none;
      -webkit-user-select:none;
    }
    .composer-tiptap-editor .cosmo-details-toggle:hover{background:transparent}
    .composer-tiptap-editor .cosmo-details-toggle:focus-visible{outline:2px solid #229ed955;outline-offset:1px}
    .composer-tiptap-editor .cosmo-details-toggle svg{
      width:16px;
      height:16px;
      fill:none;
      stroke:currentColor;
      stroke-width:1.8;
      stroke-linecap:round;
      stroke-linejoin:round;
      transition:transform .15s ease;
    }
    .composer-tiptap-editor .cosmo-details-node.is-open .cosmo-details-toggle svg{transform:rotate(180deg)}
    .composer-tiptap-editor .cosmo-details-content{
      grid-column:2;
      grid-row:1;
      min-width:0;
      padding:0;
      border:0;
      background:transparent;
    }
    .composer-tiptap-editor .cosmo-details-content>summary{
      display:block;
      margin:0;
      min-height:24px;
      padding:2px 0 4px;
      font-weight:600;
      cursor:text;
      list-style:none;
    }
    .composer-tiptap-editor .cosmo-details-content>summary::-webkit-details-marker{display:none}
    .composer-tiptap-editor .cosmo-details-node [data-cosmo-details-body]{margin:4px 0 0;padding:0;border:0;background:transparent}
    .composer-tiptap-editor .cosmo-details-node:not(.is-open) [data-cosmo-details-body]{display:none}
    .composer-tiptap-editor .cosmo-details-node.is-open [data-cosmo-details-body]{display:block}
  `;
  document.head.append(style);

  const detailsNodeView=()=>{
    const dom=document.createElement('div');
    dom.className='cosmo-details-node';

    const button=document.createElement('button');
    button.type='button';
    button.className='cosmo-details-toggle';
    button.contentEditable='false';
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-label','Развернуть');
    button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

    const contentDOM=document.createElement('div');
    contentDOM.className='cosmo-details-content';

    dom.append(button,contentDOM);

    let open=false;
    const render=()=>{
      dom.classList.toggle('is-open',open);
      button.setAttribute('aria-expanded',String(open));
      button.setAttribute('aria-label',open?'Свернуть':'Развернуть');
    };
    render();

    button.addEventListener('pointerdown',event=>{
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      open=!open;
      render();
      log('details-button-toggle',{open});
    });

    return{
      dom,
      contentDOM,
      stopEvent:event=>event.target===button||button.contains(event.target),
      ignoreMutation:mutation=>(mutation.type==='attributes'&&(mutation.target===dom||mutation.target===button))||button.contains(mutation.target),
    };
  };

  const current=editor.view.props.nodeViews||{};
  editor.view.setProps({nodeViews:{...current,details:detailsNodeView}});
  log('details-nodeview-ready',{detailsCount:editor.state.doc.content.content.filter(node=>node.type.name==='details').length});
})();
