import type {PostDocument, PostListItem, TextRun} from './post-document';
const text=(runs:TextRun[])=>runs.map(run=>run.text).join('');
const listItemText=(item:TextRun[]|PostListItem):string=>Array.isArray(item)
  ?text(item)
  :text(item.content)+(item.children?.length?`\n${item.children.map(listItemText).join('\n')}`:'');
export function renderVK(document:PostDocument, defaultEmoji='✨'){
  return document.blocks.map(block=>{
    if('items'in block)return block.items.map((item,i)=>`${block.type==='bullet_list'?'•':`${i+1}.`} ${listItemText(item)}`).join('\n');
    if(block.type==='details'){const emoji=block.emoji??defaultEmoji,title=block.title?.length?text(block.title):'Подробнее';return `${emoji.repeat(4)} ${title} ${emoji.repeat(4)}\n\n${text(block.content)}\n\n${emoji.repeat(14)}`;}
    return text(block.content);
  }).join('\n');
}
