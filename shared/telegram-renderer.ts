import {bold as tgBold, details as tgDetails, doc as tgDoc, list as tgList, paragraph as tgParagraph, escapeText as tgEscapeText} from 'tg-rich-messages';
import type {InlineMark, PostBlock, PostButton, PostDocument, TextRun} from './post-document';
import {safeLink} from './post-document';

export interface TelegramSegment {text: string; marks: InlineMark[]}
export interface TelegramBlock {kind: 'text'|'quote'|'expandable_quote'|'list_item'; source: PostBlock['type']; segments: TelegramSegment[]; title?:TelegramSegment[]; prefix?: string}
export interface TelegramRender {blocks: TelegramBlock[]; html: string; plainText: string;buttons?:PostButton[];richMessageHtml?:string}
const escape = (text:string) => text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const tags: Record<string,[string,string]> = {bold:['<b>','</b>'],italic:['<i>','</i>'],underline:['<u>','</u>'],strikethrough:['<s>','</s>'],spoiler:['<tg-spoiler>','</tg-spoiler>']};
function renderRun(run: TextRun) {const marks=run.marks??[];if(marks.length>0&&marks.every(mark=>mark.type==='bold'))return tgBold(run.text).render();let html=tgEscapeText(run.text);for(const mark of [...marks].reverse()){if(mark.type==='link'){const href=safeLink(mark.href);if(href)html=`<a href="${escape(href)}">${html}</a>`;}else{const [open,close]=tags[mark.type];html=open+html+close;}}return html}
function segments(content:TextRun[], heading=false):TelegramSegment[]{return content.map(run=>({text:run.text,marks:[...(heading?[{type:'bold'} as InlineMark]:[]),...(run.marks??[])]}))}
function blockHtml(block:TelegramBlock){const title=block.title?.map(s=>renderRun({text:s.text,marks:s.marks})).join(''),inner=(title?`<b>${title}</b>\n\n`:'')+block.segments.map(s=>renderRun({text:s.text,marks:s.marks})).join('');if(block.kind==='quote')return `<blockquote>${inner}</blockquote>`;if(block.kind==='expandable_quote')return `<blockquote expandable>${inner}</blockquote>`;return escape(block.prefix??'')+inner;}
const inlineHtml=(content:TextRun[])=>content.map(renderRun).join('');
export function renderTelegram(document:PostDocument):TelegramRender{
  const blocks:TelegramBlock[]=[],richBlocks:any[]=[];let needsRichMessage=false;
  for(const block of document.blocks){
    if('items'in block){needsRichMessage=true;block.items.forEach((item,index)=>blocks.push({kind:'list_item',source:block.type,prefix:block.type==='bullet_list'?'• ':`${index+1}. `,segments:segments(item)}));richBlocks.push(tgList(block.items.map(item=>tgParagraph(item.map(run=>run.marks?.some(mark=>mark.type==='bold')?tgBold(run.text):run.text))),{ordered:block.type==='ordered_list'}));}
    else if(block.type==='details'){needsRichMessage=true;blocks.push({kind:'expandable_quote',source:block.type,segments:segments(block.content),title:segments(block.title?.length?block.title:[{text:'Подробнее'}])});const title=(block.title?.length?block.title:[{text:'Подробнее'}]).map(run=>run.text).join('');richBlocks.push(tgDetails(title,tgParagraph(block.content.map(run=>run.marks?.some(mark=>mark.type==='bold')?tgBold(run.text):run.text))));}
    else{blocks.push({kind:block.type==='quote'?'quote':'text',source:block.type,segments:segments(block.content,block.type==='heading')});richBlocks.push(tgParagraph(block.content.map(run=>run.marks?.some(mark=>mark.type==='bold')?tgBold(run.text):run.text)));}
  }
  return {blocks,html:blocks.map(blockHtml).join('\n'),plainText:blocks.map(b=>(b.prefix??'')+(b.title?.map(s=>s.text).join('')?b.title.map(s=>s.text).join('')+'\n\n':'')+b.segments.map(s=>s.text).join('')).join('\n'),buttons:document.buttons??[],...(needsRichMessage?{richMessageHtml:tgDoc(...richBlocks).validate().toHTML()}:{})};
}

export type TelegramPublicationPlan = | {type:'text'; messages:[TelegramRender]} | {type:'photo_with_caption'; messages:[TelegramRender]} | {type:'photo_then_text'; messages:[null,TelegramRender]; reason:'caption_too_long'};
export function planTelegramPublication(rendered:TelegramRender,hasImage:boolean):TelegramPublicationPlan {if(!hasImage)return {type:'text',messages:[rendered]};return rendered.plainText.length<=1024?{type:'photo_with_caption',messages:[rendered]}:{type:'photo_then_text',messages:[null,rendered],reason:'caption_too_long'};}
