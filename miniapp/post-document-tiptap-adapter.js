const ALLOWED_POST_MARKS=new Set(['bold','italic','underline','strikethrough','spoiler','link']);

const markToPost=mark=>mark.type==='strike'?{type:'strikethrough'}:mark.type==='link'?{type:'link',href:mark.attrs?.href||''}:{type:mark.type};

function inlineRuns(node){
  const runs=[];
  const visit=current=>{
    if(current.type==='text'&&current.text){
      const marks=(current.marks||[]).map(markToPost).filter(mark=>ALLOWED_POST_MARKS.has(mark.type));
      runs.push(marks.length?{text:current.text,marks}:{text:current.text});
      return;
    }
    if(current.type==='hardBreak'){
      runs.push({text:'\n'});
      return;
    }
    for(const child of current.content||[])visit(child);
  };
  visit(node);
  return runs;
}

const listType=node=>node.type==='orderedList'?'ordered_list':'bullet_list';

function normalizeListItem(node){
  const first=(node.content||[]).find(child=>child.type==='paragraph');
  const item={content:first?inlineRuns(first):[]};
  const nested=(node.content||[]).find(child=>child.type==='orderedList'||child.type==='bulletList');
  if(nested)item.children={type:listType(nested),items:(nested.content||[]).filter(child=>child.type==='listItem').map(normalizeListItem)};
  return item;
}

function nodeToPostBlock(node){
  if(node.type==='paragraph')return{type:'paragraph',content:inlineRuns(node)};
  if(node.type==='heading')return{type:'heading',content:inlineRuns(node)};
  if(node.type==='orderedList'||node.type==='bulletList')return{type:listType(node),items:(node.content||[]).filter(child=>child.type==='listItem').map(normalizeListItem)};
  if(node.type==='blockquote'){
    const blocks=(node.content||[]).map(nodeToPostBlock).filter(Boolean);
    return{type:'quote',blocks:blocks.length?blocks:[{type:'paragraph',content:[]}]};
  }
  if(node.type==='details'){
    const summary=(node.content||[]).find(child=>child.type==='detailsSummary');
    const body=(node.content||[]).find(child=>child.type==='detailsBody');
    const blocks=(body?.content||[]).map(nodeToPostBlock).filter(Boolean);
    return{type:'details',title:summary?inlineRuns(summary):[{text:'Подробнее'}],blocks:blocks.length?blocks:[{type:'paragraph',content:[]}]};
  }
  return null;
}

export function tiptapToPostDocument(doc,buttons=[]){
  const blocks=(doc?.content||[]).map(nodeToPostBlock).filter(Boolean);
  if(!blocks.length)blocks.push({type:'paragraph',content:[{text:''}]});
  return{schemaVersion:2,blocks,...(buttons.length?{buttons:[...buttons]}:{})};
}

const runNodes=runs=>(runs||[]).flatMap(run=>{
  if(!run.text)return[];
  const marks=(run.marks||[]).map(mark=>mark.type==='strikethrough'
    ?{type:'strike'}
    :mark.type==='link'
      ?{type:'link',attrs:{href:mark.href,target:'_blank',rel:'noopener noreferrer nofollow',class:null}}
      :{type:mark.type});
  return[{type:'text',text:run.text,marks:marks.length?marks:undefined}];
});

function listItem(raw,parentType){
  const item=Array.isArray(raw)?{content:raw}:raw;
  const content=[{type:'paragraph',content:runNodes(item.content)}];
  const children=item.children;
  if(children){
    const nested=Array.isArray(children)?{type:parentType,items:children}:children;
    content.push({type:nested.type==='ordered_list'?'orderedList':'bulletList',content:(nested.items||[]).map(child=>listItem(child,nested.type))});
  }
  return{type:'listItem',content};
}

function blockNode(block){
  if(block.type==='paragraph')return{type:'paragraph',content:runNodes(block.content)};
  if(block.type==='heading')return{type:'heading',attrs:{level:1},content:runNodes(block.content)};
  if(block.type==='ordered_list'||block.type==='bullet_list')return{type:block.type==='ordered_list'?'orderedList':'bulletList',content:(block.items||[]).map(item=>listItem(item,block.type))};
  if(block.type==='quote'){
    const body=Array.isArray(block.blocks)?block.blocks.map(blockNode).filter(Boolean):[{type:'paragraph',content:runNodes(block.content||[])}];
    return{type:'blockquote',content:body.length?body:[{type:'paragraph'}]};
  }
  if(block.type==='details'){
    const body=(block.blocks||[]).map(blockNode).filter(Boolean);
    return{type:'details',content:[
      {type:'detailsSummary',content:runNodes(block.title?.length?block.title:[{text:'Подробнее'}])},
      {type:'detailsBody',content:body.length?body:[{type:'paragraph'}]}
    ]};
  }
  return null;
}

export function postDocumentToTiptap(doc){
  const content=(doc?.blocks||[]).map(blockNode).filter(Boolean);
  return{type:'doc',content:content.length?content:[{type:'paragraph'}]};
}
