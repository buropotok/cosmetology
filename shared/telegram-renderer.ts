import {bold as tgBold, escapeText as tgEscapeText} from 'tg-rich-messages';
import type {InlineMark, PostBlock, PostButton, PostDetailsBlock, PostDocument, PostListItem, TextRun} from './post-document';
import {safeLink} from './post-document';

export interface TelegramSegment {text: string; marks: InlineMark[]}
export interface TelegramBlock {kind: 'text'|'quote'|'expandable_quote'|'list_item'; source: PostBlock['type']; segments: TelegramSegment[]; title?:TelegramSegment[]; prefix?: string}
export interface TelegramRender {blocks: TelegramBlock[]; html: string; plainText: string;buttons?:PostButton[];richMessageHtml?:string;richMessageBlocks?:unknown[]}
const escape = (text:string) => text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const tags: Record<string,[string,string]> = {bold:['<b>','</b>'],italic:['<i>','</i>'],underline:['<u>','</u>'],strikethrough:['<s>','</s>'],spoiler:['<tg-spoiler>','</tg-spoiler>']};
function renderRun(run: TextRun) {const marks=run.marks??[];if(marks.length>0&&marks.every(mark=>mark.type==='bold'))return tgBold(run.text).render();let html=tgEscapeText(run.text);for(const mark of [...marks].reverse()){if(mark.type==='link'){const href=safeLink(mark.href);if(href)html=`<a href="${escape(href)}">${html}</a>`;}else{const [open,close]=tags[mark.type];html=open+html+close;}}return html}
function segments(content:TextRun[], heading=false):TelegramSegment[]{return content.map(run=>({text:run.text,marks:[...(heading?[{type:'bold'} as InlineMark]:[]),...(run.marks??[])]}))}
function blockHtml(block:TelegramBlock){const title=block.title?.map(s=>renderRun({text:s.text,marks:s.marks})).join(''),inner=(title?`<b>${title}</b>\n\n`:'')+block.segments.map(s=>renderRun({text:s.text,marks:s.marks})).join('');if(block.kind==='quote')return `<blockquote>${inner}</blockquote>`;if(block.kind==='expandable_quote')return `<blockquote expandable>${inner}</blockquote>`;return escape(block.prefix??'')+inner;}
const inlineHtml=(content:TextRun[])=>content.map(renderRun).join('');
const normalizeItem=(item:TextRun[]|PostListItem):PostListItem=>Array.isArray(item)?{content:item}:item;
function richListHtml(type:'bullet_list'|'ordered_list',items:Array<TextRun[]|PostListItem>,depth=0):string{const tag=type==='ordered_list'?'ol':'ul';return `<${tag}>${items.map(raw=>{const item=normalizeItem(raw),children=depth<1&&item.children?.length?richListHtml(type,item.children,depth+1):'';return `<li>${inlineHtml(item.content)}${children}</li>`}).join('')}</${tag}>`}
function flattenList(type:'bullet_list'|'ordered_list',items:Array<TextRun[]|PostListItem>,blocks:TelegramBlock[],depth=0){items.forEach((raw,index)=>{const item=normalizeItem(raw),prefix=type==='bullet_list'?'• ':`${index+1}. `;blocks.push({kind:'list_item',source:type,prefix:(depth?'  ':'')+prefix,segments:segments(item.content)});if(item.children?.length)flattenList(type,item.children,blocks,depth+1)})}
function richBlockHtml(block:PostDetailsBlock):string{if('items'in block)return richListHtml(block.type,block.items);if(block.type==='quote')return `<blockquote>${inlineHtml(block.content)}</blockquote>`;if(block.type==='heading')return `<p><b>${inlineHtml(block.content)}</b></p>`;return `<p>${inlineHtml(block.content)}</p>`}
function plainItem(item:TextRun[]|PostListItem):string{const value=normalizeItem(item);return value.content.map(run=>run.text).join('')+(value.children?.length?'\n'+value.children.map(plainItem).join('\n'):'')}
function plainBlock(block:PostDetailsBlock):string{return 'items'in block?block.items.map(plainItem).join('\n'):block.content.map(run=>run.text).join('')}
function appendLegacyBlock(block:PostDetailsBlock,blocks:TelegramBlock[]){if('items'in block){flattenList(block.type,block.items,blocks);return}blocks.push({kind:block.type==='quote'?'quote':'text',source:block.type,segments:segments(block.content,block.type==='heading')})}
export function renderTelegram(document:PostDocument):TelegramRender{
  const blocks:TelegramBlock[]=[],richHtml:string[]=[];let needsRichMessage=false;
  for(const block of document.blocks){
    if(block.type==='details'){
      needsRichMessage=true;
      const titleRuns=block.title?.length?block.title:[{text:'Подробнее'}];
      blocks.push({kind:'expandable_quote',source:block.type,segments:segments(block.blocks.flatMap(child=>'items'in child?[]:child.content)),title:segments(titleRuns)});
      richHtml.push(`<details><summary>${inlineHtml(titleRuns)}</summary>${block.blocks.map(richBlockHtml).join('')}</details>`);
      continue;
    }
    if('items'in block){needsRichMessage=true;flattenList(block.type,block.items,blocks);richHtml.push(richListHtml(block.type,block.items));continue}
    appendLegacyBlock(block,blocks);
    richHtml.push(richBlockHtml(block));
  }
  const plainText=document.blocks.map(block=>block.type==='details'?`${(block.title?.length?block.title:[{text:'Подробнее'}]).map(run=>run.text).join('')}\n\n${block.blocks.map(plainBlock).join('\n')}`:plainBlock(block)).join('\n');
  return {blocks,html:blocks.map(blockHtml).join('\n'),plainText,buttons:document.buttons??[],...(needsRichMessage?{richMessageHtml:richHtml.join('')}:{})};
}

export type TelegramPublicationPlan = | {type:'text'; messages:[TelegramRender]} | {type:'photo_with_caption'; messages:[TelegramRender]} | {type:'photo_then_text'; messages:[null,TelegramRender]; reason:'caption_too_long'};
export function planTelegramPublication(rendered:TelegramRender,hasImage:boolean):TelegramPublicationPlan {if(!hasImage)return {type:'text',messages:[rendered]};return rendered.plainText.length<=1024?{type:'photo_with_caption',messages:[rendered]}:{type:'photo_then_text',messages:[null,rendered],reason:'caption_too_long'};}
