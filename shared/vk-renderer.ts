import type {PostBlock, PostDocument, PostListItem, PostNestedList, TextRun} from './post-document';
const text=(runs:TextRun[]|undefined)=>runs?.map(run=>run.text).join('')??'';
const normalizeItem=(item:TextRun[]|PostListItem):PostListItem=>Array.isArray(item)?{content:item}:item;
const nestedList=(item:PostListItem,parentType:'bullet_list'|'ordered_list'):PostNestedList|null=>{const children=item.children;if(!children)return null;return Array.isArray(children)?{type:parentType,items:children}:children};
function listItemText(item:TextRun[]|PostListItem,type:'bullet_list'|'ordered_list',depth=0,index=0):string{const value=normalizeItem(item),prefix=type==='bullet_list'?'•':`${index+1}.`;let result=`${'  '.repeat(depth)}${prefix} ${text(value.content)}`;const nested=nestedList(value,type);if(nested?.items.length)result+=`\n${nested.items.map((child,i)=>listItemText(child,nested.type,depth+1,i)).join('\n')}`;return result}
function blockText(block:PostBlock):string{
  if(block.type==='paragraph'||block.type==='heading')return text(block.content);
  if(block.type==='bullet_list'||block.type==='ordered_list')return block.items.map((item,i)=>listItemText(item,block.type,0,i)).join('\n');
  if(block.type==='quote')return block.content!==undefined?text(block.content):(block.blocks??[]).map(blockText).join('\n');
  if(block.type==='details'){const title=block.title?.length?text(block.title):'Подробнее';return `${title}\n${block.blocks.map(blockText).join('\n')}`;}
  return '';
}
export function renderVK(document:PostDocument, defaultEmoji='✨'){
  return document.blocks.map(block=>{
    if(block.type==='details'){const emoji=block.emoji??defaultEmoji,title=block.title?.length?text(block.title):'Подробнее';return `${emoji.repeat(4)} ${title} ${emoji.repeat(4)}\n\n${block.blocks.map(blockText).join('\n')}\n\n${emoji.repeat(14)}`;}
    return blockText(block);
  }).join('\n');
}
