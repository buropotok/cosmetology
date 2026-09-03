export const POST_DOCUMENT_VERSION = 1 as const;

export type InlineMark =
  | {type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'spoiler'}
  | {type: 'link'; href: string};
export interface TextRun { text: string; marks?: InlineMark[] }
export interface PostButton {text:string;url:string}
export interface PostListItem {content:TextRun[]; children?:PostListItem[]}
export type PostBlock =
  | {type: 'paragraph' | 'heading' | 'quote'; content: TextRun[]}
  | {type: 'details'; title?: TextRun[]; content: TextRun[]; emoji?: string}
  | {type: 'bullet_list' | 'ordered_list'; items: Array<TextRun[]|PostListItem>};
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
  if (document.schemaVersion !== POST_DOCUMENT_VERSION || !Array.isArray(document.blocks) || (document.buttons!==undefined&&(!Array.isArray(document.buttons)||document.buttons.some(button=>!button||typeof button.text!=='string'||typeof button.url!=='string'||!safeLink(button.url))))) return false;
  const marks=(value:unknown)=>Array.isArray(value)&&value.every(mark=>{if(!mark||typeof mark!=='object'||typeof (mark as InlineMark).type!=='string')return false;const candidate=mark as InlineMark;if(candidate.type==='link')return typeof candidate.href==='string'&&safeLink(candidate.href)!==null;return ['bold','italic','underline','strikethrough','spoiler'].includes(candidate.type)});
  const runs = (content: unknown) => Array.isArray(content) && content.every(run => run && typeof run === 'object' && typeof (run as TextRun).text === 'string' && (!('marks' in run) || !run.marks || marks(run.marks)));
  const listItem=(item:unknown,depth=0):boolean=>{if(runs(item))return true;if(!item||typeof item!=='object'||depth>1)return false;const candidate=item as PostListItem;return runs(candidate.content)&&(candidate.children===undefined||(Array.isArray(candidate.children)&&candidate.children.every(child=>listItem(child,depth+1))))};
  return document.blocks.every(block => {
    if (!block || typeof block !== 'object' || !('type' in block)) return false;
    const b = block as PostBlock;
    return 'items' in b ? (b.type==='bullet_list'||b.type==='ordered_list')&&Array.isArray(b.items) && b.items.every(item=>listItem(item)) : ['paragraph','heading','quote','details'].includes(b.type) && runs(b.content)&&(b.type!=='details'||b.title===undefined||runs(b.title));
  });
}

export function deserializePostDocument(value: unknown, fallback = ''): PostDocument {
  return isPostDocument(value) ? structuredClone(value) : plainTextToDocument(fallback);
}

const itemText=(item:TextRun[]|PostListItem):string=>Array.isArray(item)?item.map(run=>run.text).join(''):item.content.map(run=>run.text).join('')+(item.children?.length?'\n'+item.children.map(itemText).join('\n'):'');
export function documentText(document: PostDocument): string {
  return document.blocks.map(block => 'items' in block
    ? block.items.map(itemText).join('\n')
    : block.content.map(run => run.text).join('')).join('\n');
}

const itemHasSpoiler=(item:TextRun[]|PostListItem):boolean=>Array.isArray(item)?item.some(run=>run.marks?.some(mark=>mark.type==='spoiler')):item.content.some(run=>run.marks?.some(mark=>mark.type==='spoiler'))||!!item.children?.some(itemHasSpoiler);
export function hasTelegramSpecificFormatting(document: PostDocument) {
  return document.blocks.some(block => block.type === 'details' || ('content' in block && block.content.some(run => run.marks?.some(mark => mark.type === 'spoiler'))) || ('items' in block && block.items.some(itemHasSpoiler)));
}
