import {bold as tgBold, escapeText as tgEscapeText} from 'tg-rich-messages';
import type {InlineMark, PostBlock, PostButton, PostDocument, PostListItem, TextRun} from './post-document';
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
function hasNested(items:Array<TextRun[]|PostListItem>):boolean{return items.some(raw=>{const item=normalizeItem(raw);return !!item.children?.length})}
function richText(content:TextRun[]):unknown {const parts=content.map(run=>{let value:unknown=run.text;for(const mark of [...(run.marks??[])].reverse()){if(mark.type==='link'){const href=safeLink(mark.href);if(href)value={type:'url',text:value,url:href}}else value={type:mark.type,text:value}}return value});return parts.length===1?parts[0]:parts}
function listBlock(type:'bullet_list'|'ordered_list',items:Array<TextRun[]|PostListItem>):unknown{return {type:'list',items:items.map((raw,index)=>{const item=normalizeItem(raw);const blocks:unknown[]=[{type:'paragraph',text:richText(item.content)}];if(item.children?.length)blocks.push(listBlock(type,item.children));return {blocks,...(type==='ordered_list'?{value:index+1,type:'1'}:{})}})}}
function inputBlock(block:PostBlock):unknown {if('items'in block)return listBlock(block.type,block.items);if(block.type==='details')return {type:'details',summary:richText(block.title?.length?block.title:[{text:'Подробнее'}]),blocks:[{type:'paragraph',text:richText(block.content)}]};if(block.type==='heading')return {type:'heading',size:1,text:richText(block.content)};if(block.type==='quote')return {type:'blockquote',blocks:[{type:'paragraph',text:richText(block.content)}]};return {type:'paragraph',text:richText(block.content)}}
export function renderTelegram(document:PostDocument):TelegramRender{
  const blocks:TelegramBlock[]=[],richHtml:string[]=[];let needsRichMessage=false,nested=false;
  for(const block of document.blocks){
    if('items'in block){needsRichMessage=true;nested ||= hasNested(block.items);flattenList(block.type,block.items,blocks);richHtml.push(richListHtml(block.type,block.items));}
    else if(block.type==='details'){needsRichMessage=true;blocks.push({kind:'expandable_quote',source:block.type,segments:segments(block.content),title:segments(block.title?.length?block.title:[{text:'Подробнее'}])});const title=inlineHtml(block.title?.length?block.title:[{text:'Подробнее'}]);richHtml.push(`<details><summary>${title}</summary><p>${inlineHtml(block.content)}</p></details>`);}
    else{blocks.push({kind:block.type==='quote'?'quote':'text',source:block.type,segments:segments(block.content,block.type==='heading')});const tag=block.type==='heading'?'h1':block.type==='quote'?'blockquote':'p';richHtml.push(`<${tag}>${inlineHtml(block.content)}</${tag}>`);}
  }
  return {blocks,html:blocks.map(blockHtml).join('\n'),plainText:blocks.map(b=>(b.prefix??'')+(b.title?.map(s=>s.text).join('')?b.title.map(s=>s.text).join('')+'\n\n':'')+b.segments.map(s=>s.text).join('')).join('\n'),buttons:document.buttons??[],...(needsRichMessage?{richMessageHtml:richHtml.join('')}:{}) ,...(nested?{richMessageBlocks:document.blocks.map(inputBlock)}:{})};
}

export type TelegramPublicationPlan = | {type:'text'; messages:[TelegramRender]} | {type:'photo_with_caption'; messages:[TelegramRender]} | {type:'photo_then_text'; messages:[null,TelegramRender]; reason:'caption_too_long'};
export function planTelegramPublication(rendered:TelegramRender,hasImage:boolean):TelegramPublicationPlan {if(!hasImage)return {type:'text',messages:[rendered]};return rendered.plainText.length<=1024?{type:'photo_with_caption',messages:[rendered]}:{type:'photo_then_text',messages:[null,rendered],reason:'caption_too_long'};}
