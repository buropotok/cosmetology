import type {InlineMark, PostBlock, PostButton, PostDocument, TextRun} from './post-document';
import {safeLink} from './post-document';

export interface TelegramSegment {text: string; marks: InlineMark[]}
export interface TelegramBlock {kind: 'text'|'quote'|'expandable_quote'|'list_item'; source: PostBlock['type']; segments: TelegramSegment[]; title?:TelegramSegment[]; prefix?: string}
export interface TelegramRender {blocks: TelegramBlock[]; html: string; plainText: string;buttons?:PostButton[]}
const escape = (text:string) => text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const tags: Record<string,[string,string]> = {bold:['<b>','</b>'],italic:['<i>','</i>'],underline:['<u>','</u>'],strikethrough:['<s>','</s>'],spoiler:['<tg-spoiler>','</tg-spoiler>']};
function renderRun(run: TextRun) {
  let html=escape(run.text);
  for(const mark of [...(run.marks??[])].reverse()) {
    if(mark.type==='link'){const href=safeLink(mark.href);if(href)html=`<a href="${escape(href)}">${html}</a>`;}
    else {const [open,close]=tags[mark.type];html=open+html+close;}
  }
  return html;
}
function segments(content:TextRun[], heading=false):TelegramSegment[]{return content.map(run=>({text:run.text,marks:[...(heading?[{type:'bold'} as InlineMark]:[]),...(run.marks??[])]}))}
function blockHtml(block:TelegramBlock){const title=block.title?.map(s=>renderRun({text:s.text,marks:s.marks})).join(''),inner=(title?`<b>${title}</b>\n\n`:'')+block.segments.map(s=>renderRun({text:s.text,marks:s.marks})).join('');if(block.kind==='quote')return `<blockquote>${inner}</blockquote>`;if(block.kind==='expandable_quote')return `<blockquote expandable>${inner}</blockquote>`;return escape(block.prefix??'')+inner;}
export function renderTelegram(document:PostDocument):TelegramRender{
  const blocks:TelegramBlock[]=[];
  for(const block of document.blocks){
    if('items'in block)block.items.forEach((item,index)=>blocks.push({kind:'list_item',source:block.type,prefix:block.type==='bullet_list'?'• ':`${index+1}. `,segments:segments(item)}));
    else blocks.push({kind:block.type==='quote'?'quote':block.type==='details'?'expandable_quote':'text',source:block.type,segments:segments(block.content,block.type==='heading'),...(block.type==='details'?{title:segments(block.title?.length?block.title:[{text:'Подробнее'}])}:{})});
  }
  return {blocks,html:blocks.map(blockHtml).join('\n'),plainText:blocks.map(b=>(b.prefix??'')+(b.title?.map(s=>s.text).join('')?b.title.map(s=>s.text).join('')+'\n\n':'')+b.segments.map(s=>s.text).join('')).join('\n'),buttons:document.buttons??[]};
}

export type TelegramPublicationPlan =
  | {type:'text'; messages:[TelegramRender]}
  | {type:'photo_with_caption'; messages:[TelegramRender]}
  | {type:'photo_then_text'; messages:[null,TelegramRender]; reason:'caption_too_long'};
export function planTelegramPublication(rendered:TelegramRender,hasImage:boolean):TelegramPublicationPlan {
  if(!hasImage)return {type:'text',messages:[rendered]};
  return rendered.plainText.length<=1024?{type:'photo_with_caption',messages:[rendered]}:{type:'photo_then_text',messages:[null,rendered],reason:'caption_too_long'};
}
