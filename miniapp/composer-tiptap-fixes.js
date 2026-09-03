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
      padding:6px 8px;
      border:1px solid #d7d9de;
      border-radius:8px;
      display:grid;
      grid-template-columns:32px minmax(0,1fr);
      column-gap:6px;
      align-items:start;
    }
    .composer-tiptap-editor .cosmo-details-toggle{
      grid-column:1;
      grid-row:1;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:32px;
      height:32px;
      padding:0;
      border:1px solid #c9cdd3;
      border-radius:8px;
      background:#f5f6f7;
      color:inherit;
      font:inherit;
      font-size:16px;
      line-height:1;
      cursor:pointer;
      touch-action:manipulation;
      user-select:none;
      -webkit-user-select:none;
    }
    .composer-tiptap-editor .cosmo-details-content{
      grid-column:2;
      grid-row:1;
      min-width:0;
      padding-top:5px;
    }
    .composer-tiptap-editor .cosmo-details-content>summary{
      display:block;
      margin:0;
      min-height:22px;
      font-weight:600;
      cursor:text;
      list-style:none;
    }
    .composer-tiptap-editor .cosmo-details-content>summary::-webkit-details-marker{display:none}
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
    button.textContent='›';

    const contentDOM=document.createElement('div');
    contentDOM.className='cosmo-details-content';

    dom.append(button,contentDOM);

    let open=false;
    const render=()=>{
      dom.classList.toggle('is-open',open);
      button.setAttribute('aria-expanded',String(open));
      button.setAttribute('aria-label',open?'Свернуть':'Развернуть');
      button.textContent=open?'⌄':'›';
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
