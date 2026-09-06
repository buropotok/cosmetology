import {
  blockquote as tgBlockquote,
  bold as tgBold,
  details as tgDetails,
  doc as tgDoc,
  escapeText as tgEscapeText,
  heading as tgHeading,
  italic as tgItalic,
  link as tgLink,
  list as tgList,
  paragraph as tgParagraph,
  spoiler as tgSpoiler,
  strike as tgStrike,
  underline as tgUnderline,
  type BlockNode,
  type Inline,
} from 'tg-rich-messages';
import type {InlineMark, PostBlock, PostButton, PostDocument, PostListItem, PostNestedList, TextRun} from './post-document';
import {safeLink} from './post-document';

export interface TelegramSegment {text: string; marks: InlineMark[]}
export interface TelegramBlock {kind: 'text'|'quote'|'expandable_quote'|'list_item'; source: PostBlock['type']; segments: TelegramSegment[]; title?:TelegramSegment[]; prefix?: string}
export interface TelegramRender {blocks: TelegramBlock[]; html: string; plainText: string;buttons?:PostButton[];richMessageHtml?:string;richMessageBlocks?:unknown[]}
const escape = (text:string) => text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const tags: Record<string,[string,string]> = {bold:['<b>','</b>'],italic:['<i>','</i>'],underline:['<u>','</u>'],strikethrough:['<s>','</s>'],spoiler:['<tg-spoiler>','</tg-spoiler>']};
function renderRun(run: TextRun) {const marks=run.marks??[];if(marks.length>0&&marks.every(mark=>mark.type==='bold'))return tgBold(run.text).render();let html=tgEscapeText(run.text);for(const mark of [...marks].reverse()){if(mark.type==='link'){const href=safeLink(mark.href);if(href)html=`<a href="${escape(href)}">${html}</a>`;}else{const [open,close]=tags[mark.type];html=open+html+close;}}return html}
function segments(content:TextRun[], heading=false):TelegramSegment[]{return content.map(run=>({text:run.text,marks:[...(heading?[{type:'bold'} as InlineMark]:[]),...(run.marks??[])]}))}
function blockHtml(block:TelegramBlock){const title=block.title?.map(s=>renderRun({text:s.text,marks:s.marks})).join(''),inner=(title?`<b>${title}</b>\n\n`:'')+block.segments.map(s=>renderRun({text:s.text,marks:s.marks})).join('');if(block.kind==='quote')return `<blockquote>${inner}</blockquote>`;if(block.kind==='expandable_quote')return `<blockquote expandable>${inner}</blockquote>`;return escape(block.prefix??'')+inner;}
const normalizeItem=(item:TextRun[]|PostListItem):PostListItem=>Array.isArray(item)?{content:item}:item;
const nestedList=(item:PostListItem,parentType:'bullet_list'|'ordered_list'):PostNestedList|null=>{const children=item.children;if(!children)return null;return Array.isArray(children)?{type:parentType,items:children}:children};

function richRun(run:TextRun):Inline{let value:Inline=run.text;for(const mark of [...(run.marks??[])].reverse()){if(mark.type==='bold')value=tgBold(value);else if(mark.type==='italic')value=tgItalic(value);else if(mark.type==='underline')value=tgUnderline(value);else if(mark.type==='strikethrough')value=tgStrike(value);else if(mark.type==='spoiler')value=tgSpoiler(value);else if(mark.type==='link'){const href=safeLink(mark.href);if(href)value=tgLink(value,href)}}return value}
const richInline=(content:TextRun[]):Inline=>content.map(richRun);
function richList(type:'bullet_list'|'ordered_list',items:Array<TextRun[]|PostListItem>):BlockNode{return tgList(items.map(raw=>{const item=normalizeItem(raw),nested=nestedList(item,type);if(!nested)return richInline(item.content);return {content:[tgParagraph(richInline(item.content)),richList(nested.type,nested.items)]}}),{ordered:type==='ordered_list'})}
function richBlock(block:PostBlock):BlockNode{
  if(block.type==='paragraph')return tgParagraph(richInline(block.content));
  if(block.type==='heading')return tgHeading(1,richInline(block.content));
  if(block.type==='bullet_list'||block.type==='ordered_list')return richList(block.type,block.items);
  if(block.type==='quote'){if(block.blocks)return tgBlockquote(block.blocks.map(richBlock));return tgBlockquote(richInline(block.content??[]));}
  if(block.type==='details'){const title=block.title?.length?richInline(block.title):'Подробнее';return tgDetails(title,block.blocks.map(richBlock));}
  return tgParagraph('');
}
function requiresRich(block:PostBlock):boolean{if(block.type==='details'||block.type==='bullet_list'||block.type==='ordered_list')return true;if(block.type==='quote')return !!block.blocks?.length;return false}

function plainItem(item:TextRun[]|PostListItem,type:'bullet_list'|'ordered_list',depth=0,index=0):string{const value=normalizeItem(item),prefix=type==='ordered_list'?`${index+1}. `:'• ';let text=`${'  '.repeat(depth)}${prefix}${value.content.map(run=>run.text).join('')}`;const nested=nestedList(value,type);if(nested?.items.length)text+='\n'+nested.items.map((child,i)=>plainItem(child,nested.type,depth+1,i)).join('\n');return text}
function plainBlock(block:PostBlock):string{
  if(block.type==='paragraph'||block.type==='heading')return block.content.map(run=>run.text).join('');
  if(block.type==='bullet_list'||block.type==='ordered_list')return block.items.map((item,index)=>plainItem(item,block.type,0,index)).join('\n');
  if(block.type==='quote')return block.content?block.content.map(run=>run.text).join(''):(block.blocks??[]).map(plainBlock).join('\n');
  if(block.type==='details'){const title=(block.title?.length?block.title:[{text:'Подробнее'}]).map((run:TextRun)=>run.text).join('');return `${title}\n${block.blocks.map(plainBlock).join('\n')}`;}
  return '';
}
function flattenList(type:'bullet_list'|'ordered_list',items:Array<TextRun[]|PostListItem>,blocks:TelegramBlock[],depth=0){items.forEach((raw,index)=>{const item=normalizeItem(raw),prefix=type==='bullet_list'?'• ':`${index+1}. `;blocks.push({kind:'list_item',source:type,prefix:(depth?'  '.repeat(depth):'')+prefix,segments:segments(item.content)});const nested=nestedList(item,type);if(nested?.items.length)flattenList(nested.type,nested.items,blocks,depth+1)})}
function appendLegacyBlock(block:PostBlock,blocks:TelegramBlock[]){
  if(block.type==='bullet_list'||block.type==='ordered_list'){flattenList(block.type,block.items,blocks);return;}
  if(block.type==='details'){const titleRuns=block.title?.length?block.title:[{text:'Подробнее'}];blocks.push({kind:'expandable_quote',source:block.type,segments:[{text:block.blocks.map(plainBlock).join('\n'),marks:[]}],title:segments(titleRuns)});return;}
  if(block.type==='quote'){if(block.blocks){blocks.push({kind:'quote',source:block.type,segments:[{text:block.blocks.map(plainBlock).join('\n'),marks:[]}]});return;}blocks.push({kind:'quote',source:block.type,segments:segments(block.content??[])});return;}
  if(block.type==='paragraph'||block.type==='heading'){blocks.push({kind:'text',source:block.type,segments:segments(block.content,block.type==='heading')});}
}

export function renderTelegram(document:PostDocument):TelegramRender{
  const blocks:TelegramBlock[]=[];
  for(const block of document.blocks)appendLegacyBlock(block,blocks);
  const plainText=document.blocks.map(plainBlock).join('\n');
  const needsRichMessage=document.blocks.some(requiresRich);
  let richMessageHtml:string|undefined;
  if(needsRichMessage){const rich=tgDoc(...document.blocks.map(richBlock)).validate();richMessageHtml=rich.toHTML()}
  return {blocks,html:blocks.map(blockHtml).join('\n'),plainText,buttons:document.buttons??[],...(richMessageHtml?{richMessageHtml}:{})};
}

export type TelegramPublicationPlan = | {type:'text'; messages:[TelegramRender]} | {type:'photo_with_caption'; messages:[TelegramRender]} | {type:'photo_then_text'; messages:[null,TelegramRender]; reason:'caption_too_long'};
export function planTelegramPublication(rendered:TelegramRender,hasImage:boolean):TelegramPublicationPlan {if(!hasImage)return {type:'text',messages:[rendered]};return rendered.plainText.length<=1024?{type:'photo_with_caption',messages:[rendered]}:{type:'photo_then_text',messages:[null,rendered],reason:'caption_too_long'};}
