const DETAILS_EMOJI=['🌸','🍀','🌿'];
const INDENT='    ';

function decorateSpoiler(text){
  const match=String(text).match(/^(\s*)(.*?)(\s*)$/s);
  if(!match||!match[2])return text;
  return `${match[1]}🙈 ${match[2]}${match[3]}`;
}

function runText(run){
  const text=String(run?.text??'');
  if(!text)return'';
  const marks=Array.isArray(run?.marks)?run.marks:[];
  const spoiler=marks.some(mark=>mark?.type==='spoiler');
  const link=marks.find(mark=>mark?.type==='link'&&typeof mark.href==='string'&&mark.href.trim());
  let value=spoiler?decorateSpoiler(text):text;
  if(link){
    const href=link.href.trim();
    if(href&&href!==text.trim())value=`${value} — ${href}`;
  }
  return value;
}

function runsText(runs){
  return (Array.isArray(runs)?runs:[]).map(runText).join('');
}

function normalizeInline(value){
  return String(value??'').replace(/\r\n?/g,'\n').replace(/[ \t]+\n/g,'\n').trim();
}

function serializeList(block,depth=0){
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
      const nestedText=serializeList(nested,depth+1);
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
    ?serializeBlocks(block.blocks,{compact:true})
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
  if(block.type==='bullet_list'||block.type==='ordered_list')return serializeList(block);
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
