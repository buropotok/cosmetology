import type {InlineMark, PostBlock, PostDocument, TextRun} from './post-document';
import {safeLink} from './post-document';

export interface TelegramSegment {text: string; marks: InlineMark[]}
export interface TelegramBlock {kind: 'text'|'quote'|'expandable_quote'|'list_item'; source: PostBlock['type']; segments: TelegramSegment[]; prefix?: string}
export interface TelegramRender {blocks: TelegramBlock[]; html: string; plainText: string}
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
function blockHtml(block:TelegramBlock){const inner=block.segments.map(s=>renderRun({text:s.text,marks:s.marks})).join('');if(block.kind==='quote')return `<blockquote>${inner}</blockquote>`;if(block.kind==='expandable_quote')return `<blockquote expandable>${inner}</blockquote>`;return escape(block.prefix??'')+inner;}
export function renderTelegram(document:PostDocument):TelegramRender{
  const blocks:TelegramBlock[]=[];
  for(const block of document.blocks){
    if('items'in block)block.items.forEach((item,index)=>blocks.push({kind:'list_item',source:block.type,prefix:block.type==='bullet_list'?'• ':`${index+1}. `,segments:segments(item)}));
    else blocks.push({kind:block.type==='quote'?'quote':block.type==='details'?'expandable_quote':'text',source:block.type,segments:segments(block.content,block.type==='heading')});
  }
  return {blocks,html:blocks.map(blockHtml).join('\n'),plainText:blocks.map(b=>(b.prefix??'')+b.segments.map(s=>s.text).join('')).join('\n')};
}
