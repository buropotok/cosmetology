export const POST_DOCUMENT_VERSION = 1 as const;

export type InlineMark =
  | {type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'spoiler'}
  | {type: 'link'; href: string};
export interface TextRun { text: string; marks?: InlineMark[] }
export type PostBlock =
  | {type: 'paragraph' | 'heading' | 'quote'; content: TextRun[]}
  | {type: 'details'; title?: TextRun[]; content: TextRun[]; emoji?: string}
  | {type: 'bullet_list' | 'ordered_list'; items: TextRun[][]};
export interface PostDocument {schemaVersion: typeof POST_DOCUMENT_VERSION; blocks: PostBlock[]}

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
  if (document.schemaVersion !== POST_DOCUMENT_VERSION || !Array.isArray(document.blocks)) return false;
  const runs = (content: unknown) => Array.isArray(content) && content.every(run => run && typeof run === 'object' && typeof (run as TextRun).text === 'string' && (!('marks' in run) || !run.marks || Array.isArray(run.marks)));
  return document.blocks.every(block => {
    if (!block || typeof block !== 'object' || !('type' in block)) return false;
    const b = block as PostBlock;
    return 'items' in b ? Array.isArray(b.items) && b.items.every(runs) : ['paragraph','heading','quote','details'].includes(b.type) && runs(b.content);
  });
}

export function deserializePostDocument(value: unknown, fallback = ''): PostDocument {
  return isPostDocument(value) ? structuredClone(value) : plainTextToDocument(fallback);
}

export function documentText(document: PostDocument): string {
  return document.blocks.map(block => 'items' in block
    ? block.items.map(item => item.map(run => run.text).join('')).join('\n')
    : block.content.map(run => run.text).join('')).join('\n');
}

export function hasTelegramSpecificFormatting(document: PostDocument) {
  return document.blocks.some(block => block.type === 'details' || ('content' in block && block.content.some(run => run.marks?.some(mark => mark.type === 'spoiler'))) || ('items' in block && block.items.some(item => item.some(run => run.marks?.some(mark => mark.type === 'spoiler')))));
}
