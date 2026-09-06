import type {PostDetailsBlock, PostDocument, PostListItem, TextRun} from './post-document';
const text=(runs:TextRun[])=>runs.map(run=>run.text).join('');
const listItemText=(item:TextRun[]|PostListItem):string=>Array.isArray(item)
  ?text(item)
  :text(item.content)+(item.children?.length?`\n${item.children.map(listItemText).join('\n')}`:'');
const blockText=(block:PostDetailsBlock)=>'items'in block
  ?block.items.map((item,i)=>`${block.type==='bullet_list'?'•':`${i+1}.`} ${listItemText(item)}`).join('\n')
  :text(block.content);
export function renderVK(document:PostDocument, defaultEmoji='✨'){
  return document.blocks.map(block=>{
    if(block.type==='details'){const emoji=block.emoji??defaultEmoji,title=block.title?.length?text(block.title):'Подробнее';return `${emoji.repeat(4)} ${title} ${emoji.repeat(4)}\n\n${block.blocks.map(blockText).join('\n')}\n\n${emoji.repeat(14)}`;}
    return blockText(block);
  }).join('\n');
}
