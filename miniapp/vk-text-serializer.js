const DETAILS_EMOJI=['🌸','🍀','🌿'];
const INDENT='    ';

function runsText(runs){
  return (Array.isArray(runs)?runs:[]).map(run=>String(run?.text??'')).join('');
}

function normalizeInline(value){
  return String(value??'').replace(/\r\n?/g,'\n').replace(/[ \t]+\n/g,'\n').trim();
}

function indentLines(text,depth){
  const prefix=INDENT.repeat(Math.max(0,depth));
  return String(text).split('\n').map(line=>line?prefix+line:line).join('\n');
}

function serializeList(block,depth,detailsEmoji){
  const ordered=block?.type==='ordered_list';
  const items=Array.isArray(block?.items)?block.items:[];
  const lines=[];
  items.forEach((raw,index)=>{
    const item=Array.isArray(raw)?{content:raw}:raw||{};
    const text=normalizeInline(runsText(item.content));
    if(text){
      const marker=ordered?`${index+1}.`:'•';
      lines.push(`${INDENT.repeat(depth)}${marker} ${text}`);
    }
    if(item.children){
      const nested=Array.isArray(item.children)
        ?{type:block.type,items:item.children}
        :item.children;
      const nestedText=serializeList(nested,depth+1,detailsEmoji);
      if(nestedText)lines.push(nestedText);
    }
  });
  return lines.join('\n');
}

function serializeQuote(block){
  const body=Array.isArray(block?.blocks)
    ?serializeBlocks(block.blocks,{compact:true})
    :normalizeInline(runsText(block?.content));
  return body?`💬 ${body} 💬`:'';
}

function serializeDetails(block,index){
  const emoji=DETAILS_EMOJI[index%DETAILS_EMOJI.length];
  const title=normalizeInline(runsText(block?.title))||'Подробнее';
  const lines=[`${emoji} ${title}`];
  const body=Array.isArray(block?.blocks)
    ?serializeBlocks(block.blocks,{detailsEmoji:emoji,detailsDepth:1,compact:true})
    :normalizeInline(runsText(block?.content));
  if(body){
    for(const line of body.split('\n')){
      if(!line){lines.push('');continue}
      lines.push(`${INDENT}${emoji} ${line.trimStart()}`);
    }
  }
  return lines.join('\n');
}

function serializeBlock(block,index,context={}){
  if(!block||typeof block!=='object')return'';
  if(block.type==='paragraph')return normalizeInline(runsText(block.content));
  if(block.type==='heading'){
    const text=normalizeInline(runsText(block.content));
    return text?`${text.toUpperCase()} 👋`:'';
  }
  if(block.type==='quote')return serializeQuote(block);
  if(block.type==='bullet_list'||block.type==='ordered_list')return serializeList(block,context.detailsDepth||0,context.detailsEmoji);
  if(block.type==='details')return serializeDetails(block,index);
  return'';
}

function normalizeOutput(parts,compact=false){
  const separator=compact?'\n':'\n\n';
  return parts.filter(Boolean).join(separator)
    .replace(/[ \t]+\n/g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .trim();
}

function serializeBlocks(blocks,context={}){
  const parts=(Array.isArray(blocks)?blocks:[]).map((block,index)=>serializeBlock(block,index,context));
  return normalizeOutput(parts,context.compact===true);
}

export function serializePostDocumentForVk(document){
  if(!document||!Array.isArray(document.blocks))return'';
  return serializeBlocks(document.blocks);
}
