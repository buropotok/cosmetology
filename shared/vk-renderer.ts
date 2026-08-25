import type {PostDocument, TextRun} from './post-document';
const text=(runs:TextRun[])=>runs.map(run=>run.text).join('');
export function renderVK(document:PostDocument, defaultEmoji='✨'){
  return document.blocks.map(block=>{
    if('items'in block)return block.items.map((item,i)=>`${block.type==='bullet_list'?'•':`${i+1}.`} ${text(item)}`).join('\n');
    if(block.type==='details'){const emoji=block.emoji??defaultEmoji,title=block.title?.length?text(block.title):'Подробнее';return `${emoji.repeat(4)} ${title} ${emoji.repeat(4)}\n\n${text(block.content)}\n\n${emoji.repeat(14)}`;}
    return text(block.content);
  }).join('\n');
}
