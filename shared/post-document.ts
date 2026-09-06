export const POST_DOCUMENT_VERSION = 2 as const;

export type InlineMark =
  | {type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'spoiler'}
  | {type: 'link'; href: string};
export interface TextRun { text: string; marks?: InlineMark[] }
export interface PostButton {text:string;url:string}
export interface PostNestedList {type:'bullet_list'|'ordered_list';items:Array<TextRun[]|PostListItem>}
export interface PostListItem {content:TextRun[]; children?:PostListItem[]|PostNestedList}
export type PostTextBlock = {type: 'paragraph' | 'heading'; content: TextRun[]};
export interface PostListBlock {type:'bullet_list'|'ordered_list';items:Array<TextRun[]|PostListItem>}
export interface PostQuoteBlock {type:'quote';content?:TextRun[];blocks?:PostBlock[]}
export interface PostDetails {type:'details';title?:TextRun[];blocks:PostBlock[];emoji?:string}
export type PostBlock = PostTextBlock | PostListBlock | PostQuoteBlock | PostDetails;
export type PostDetailsBlock = PostBlock;
export interface PostDocument {schemaVersion: typeof POST_DOCUMENT_VERSION; blocks: PostBlock[];buttons?:PostButton[]}

export function safeLink(href: string): string | null {
  try { const url = new URL(href); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null; }
  catch { return null; }
}

export function plainTextToDocument(text: string): PostDocument {
  const normalized = text.replace(/\r\n?/g, '\n');
  const blocks = normalized.split('\n').map(line => ({type: 'paragraph' as const, content: [{text: line}]}));
  return {schemaVersion: POST_DOCUMENT_VERSION, blocks: blocks.length ? blocks : [{type: 'paragraph', content: [{text: ''}]}]};
}

export function isPostDocument(value: unknown): value is PostDocument {
  if (!value || typeof value !== 'object') return false;
  const document = value as Partial<PostDocument>;
  if (document.schemaVersion !== POST_DOCUMENT_VERSION || !Array.isArray(document.blocks) || !document.blocks.length || (document.buttons!==undefined&&(!Array.isArray(document.buttons)||document.buttons.some(button=>!button||typeof button.text!=='string'||typeof button.url!=='string'||!safeLink(button.url))))) return false;
  const marks=(value:unknown)=>Array.isArray(value)&&value.every(mark=>{if(!mark||typeof mark!=='object'||typeof (mark as InlineMark).type!=='string')return false;const candidate=mark as InlineMark;if(candidate.type==='link')return typeof candidate.href==='string'&&safeLink(candidate.href)!==null;return ['bold','italic','underline','strikethrough','spoiler'].includes(candidate.type)});
  const runs = (content: unknown) => Array.isArray(content) && content.every(run => run && typeof run === 'object' && typeof (run as TextRun).text === 'string' && (!('marks' in run) || !run.marks || marks(run.marks)));
  const listItem=(item:unknown,depth=0):boolean=>{if(depth>16)return false;if(runs(item))return true;if(!item||typeof item!=='object')return false;const candidate=item as PostListItem;if(!runs(candidate.content))return false;if(candidate.children===undefined)return true;if(Array.isArray(candidate.children))return candidate.children.every(child=>listItem(child,depth+1));const nested=candidate.children as PostNestedList;return !!nested&&typeof nested==='object'&&(nested.type==='bullet_list'||nested.type==='ordered_list')&&Array.isArray(nested.items)&&nested.items.every(child=>listItem(child,depth+1))};
  const block=(value:unknown,depth=0):boolean=>{if(depth>16||!value||typeof value!=='object'||!('type'in value))return false;const b=value as PostBlock;if(b.type==='paragraph'||b.type==='heading')return runs(b.content);if(b.type==='bullet_list'||b.type==='ordered_list')return Array.isArray(b.items)&&b.items.every(item=>listItem(item));if(b.type==='quote'){const hasContent=b.content!==undefined,hasBlocks=b.blocks!==undefined;if(hasContent===hasBlocks)return false;return hasContent?runs(b.content):Array.isArray(b.blocks)&&b.blocks.length>0&&b.blocks.every(child=>block(child,depth+1))}if(b.type==='details')return (b.title===undefined||runs(b.title))&&Array.isArray(b.blocks)&&b.blocks.length>0&&b.blocks.every(child=>block(child,depth+1));return false};
  return document.blocks.every(item=>block(item));
}

export function deserializePostDocument(value: unknown, fallback = ''): PostDocument {
  return isPostDocument(value) ? structuredClone(value) : plainTextToDocument(fallback);
}

const runText=(runs:TextRun[]|undefined)=>runs?.map(run=>run.text).join('')??'';
function itemText(item:TextRun[]|PostListItem,type:'bullet_list'|'ordered_list',depth=0,index=0):string{const value:Array<TextRun[]|PostListItem>=Array.isArray(item)?[]:[];void value;const normalized=Array.isArray(item)?{content:item}:item;const prefix=type==='ordered_list'?`${index+1}. `:'• ';let text=`${'  '.repeat(depth)}${prefix}${runText(normalized.content)}`;const children=normalized.children;if(Array.isArray(children))text+='\n'+children.map((child,i)=>itemText(child,type,depth+1,i)).join('\n');else if(children?.items?.length)text+='\n'+children.items.map((child,i)=>itemText(child,children.type,depth+1,i)).join('\n');return text}
function blockText(block:PostBlock):string{if(block.type==='paragraph'||block.type==='heading')return runText(block.content);if(block.type==='bullet_list'||block.type==='ordered_list')return block.items.map((item,index)=>itemText(item,block.type,0,index)).join('\n');if(block.type==='quote')return block.content!==undefined?runText(block.content):(block.blocks??[]).map(blockText).join('\n');return `${runText(block.title)}${block.title?.length?'\n':''}${block.blocks.map(blockText).join('\n')}`}
export function documentText(document: PostDocument): string {
  return document.blocks.map(blockText).join('\n');
}

const runsHaveSpoiler=(runs:TextRun[]|undefined)=>!!runs?.some(run=>run.marks?.some(mark=>mark.type==='spoiler'));
function itemHasSpoiler(item:TextRun[]|PostListItem):boolean{if(Array.isArray(item))return runsHaveSpoiler(item);if(runsHaveSpoiler(item.content))return true;const children=item.children;if(Array.isArray(children))return children.some(itemHasSpoiler);return !!children?.items.some(itemHasSpoiler)}
function blockHasTelegramFormatting(block:PostBlock):boolean{if(block.type==='details'||(block.type==='quote'&&block.blocks!==undefined))return true;if(block.type==='paragraph'||block.type==='heading')return runsHaveSpoiler(block.content);if(block.type==='quote')return runsHaveSpoiler(block.content);if(block.type==='bullet_list'||block.type==='ordered_list')return true;return block.blocks.some(blockHasTelegramFormatting)}
export function hasTelegramSpecificFormatting(document: PostDocument) {
  return document.blocks.some(blockHasTelegramFormatting);
}
