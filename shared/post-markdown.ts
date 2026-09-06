import {
  POST_DOCUMENT_VERSION,
  isPostDocument,
  safeLink,
  type InlineMark,
  type PostBlock,
  type PostButton,
  type PostDetailsBlock,
  type PostDocument,
  type PostListItem,
  type TextRun,
} from './post-document';

function sameMarks(left?: InlineMark[], right?: InlineMark[]) {
  if (!left?.length && !right?.length) return true;
  if (!left || !right || left.length !== right.length) return false;
  return left.every((mark, index) => JSON.stringify(mark) === JSON.stringify(right[index]));
}

function appendRun(runs: TextRun[], text: string, marks: InlineMark[]) {
  if (!text) return;
  const normalizedMarks = marks.length ? marks : undefined;
  const previous = runs[runs.length - 1];
  if (previous && sameMarks(previous.marks, normalizedMarks)) {
    previous.text += text;
    return;
  }
  runs.push(normalizedMarks ? { text, marks: normalizedMarks } : { text });
}

export function parsePostMarkdownInline(text: string, inheritedMarks: InlineMark[] = []): TextRun[] {
  const runs: TextRun[] = [];
  let plain = '';
  let index = 0;

  const flushPlain = () => {
    appendRun(runs, plain, inheritedMarks);
    plain = '';
  };

  const parseDelimited = (delimiter: string, mark: InlineMark) => {
    const closing = text.indexOf(delimiter, index + delimiter.length);
    if (closing < 0) return false;
    flushPlain();
    const inner = text.slice(index + delimiter.length, closing);
    for (const run of parsePostMarkdownInline(inner, [...inheritedMarks, mark])) appendRun(runs, run.text, run.marks ?? []);
    index = closing + delimiter.length;
    return true;
  };

  while (index < text.length) {
    if (text[index] === '\\' && index + 1 < text.length && /[\\*~|\[\]()]/.test(text[index + 1])) {
      plain += text[index + 1];
      index += 2;
      continue;
    }

    if (text[index] === '[') {
      const labelEnd = text.indexOf('](', index + 1);
      if (labelEnd >= 0) {
        const hrefEnd = text.indexOf(')', labelEnd + 2);
        if (hrefEnd >= 0) {
          const href = safeLink(text.slice(labelEnd + 2, hrefEnd).trim());
          if (href) {
            flushPlain();
            const label = text.slice(index + 1, labelEnd);
            const linkMark: InlineMark = { type: 'link', href };
            for (const run of parsePostMarkdownInline(label, [...inheritedMarks, linkMark])) appendRun(runs, run.text, run.marks ?? []);
            index = hrefEnd + 1;
            continue;
          }
        }
      }
    }

    if (text.startsWith('**', index)) {
      if (parseDelimited('**', { type: 'bold' })) continue;
      plain += '**';
      index += 2;
      continue;
    }
    if (text.startsWith('~~', index)) {
      if (parseDelimited('~~', { type: 'strikethrough' })) continue;
      plain += '~~';
      index += 2;
      continue;
    }
    if (text.startsWith('||', index)) {
      if (parseDelimited('||', { type: 'spoiler' })) continue;
      plain += '||';
      index += 2;
      continue;
    }
    if (text[index] === '*') {
      if (parseDelimited('*', { type: 'italic' })) continue;
      plain += '*';
      index += 1;
      continue;
    }

    plain += text[index];
    index += 1;
  }

  flushPlain();
  return runs.length ? runs : [{ text: '' }];
}

const listLine = (line: string) => {
  const normalized = line.replace(/^\t+/, value => '  '.repeat(value.length));
  const match = normalized.match(/^(\s*)(?:(-)|(?:\d+[.)]))\s+(.+)$/);
  if (!match) return null;
  return {
    indent: match[1].length,
    ordered: match[2] !== '-',
    text: match[3],
  };
};

function parseList(lines: string[], start: number): { block: PostDetailsBlock; next: number } {
  const first = listLine(lines[start]);
  if (!first) throw new Error('Invalid PostMarkdown list');
  const ordered = first.ordered;
  const items: PostListItem[] = [];
  let index = start;

  while (index < lines.length) {
    const current = listLine(lines[index]);
    if (!current) break;
    if (current.indent === 0 && current.ordered !== ordered) break;

    if (current.indent === 0) {
      items.push({ content: parsePostMarkdownInline(current.text) });
    } else {
      const parent = items[items.length - 1];
      if (!parent) break;
      const child: PostListItem = { content: parsePostMarkdownInline(current.text) };
      (parent.children ??= []).push(child);
    }
    index += 1;
  }

  return {
    block: { type: ordered ? 'ordered_list' : 'bullet_list', items },
    next: index,
  };
}

function isBlockStart(line: string, allowDetails: boolean) {
  if (!line.trim()) return true;
  if (/^#{1,6}\s+/.test(line)) return true;
  if (/^>\s?/.test(line)) return true;
  if (listLine(line)?.indent === 0) return true;
  if (allowDetails && /^:::details(?:\s|$)/.test(line)) return true;
  return false;
}

function parseBlocks(lines: string[], allowDetails: boolean): PostDetailsBlock[] {
  const blocks: PostDetailsBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (allowDetails && /^:::details(?:\s|$)/.test(line)) {
      break;
    }

    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', content: parsePostMarkdownInline(heading[1]) });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', content: parsePostMarkdownInline(quoteLines.join('\n')) });
      continue;
    }

    if (listLine(line)?.indent === 0) {
      const parsed = parseList(lines, index);
      blocks.push(parsed.block);
      index = parsed.next;
      continue;
    }

    const paragraph: string[] = [line.trim()];
    index += 1;
    while (index < lines.length && !isBlockStart(lines[index], allowDetails)) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', content: parsePostMarkdownInline(paragraph.join(' ')) });
  }

  return blocks;
}

function extractButtonTail(lines: string[]) {
  const body = [...lines];
  const buttons: PostButton[] = [];
  while (body.length && !body[body.length - 1].trim()) body.pop();

  while (body.length) {
    const line = body[body.length - 1].trim();
    const match = line.match(/^\[\[([^\]\n]+)\]\]\((.+)\)$/);
    if (!match) break;
    const url = safeLink(match[2].trim());
    if (!url) break;
    buttons.unshift({ text: match[1].trim(), url });
    body.pop();
    while (body.length && !body[body.length - 1].trim()) body.pop();
  }

  return { body, buttons };
}

function stripOuterCodeFence(lines: string[]) {
  const result = [...lines];
  while (result.length && !result[0].trim()) result.shift();
  while (result.length && !result[result.length - 1].trim()) result.pop();
  if (/^```(?:markdown|md)?\s*$/i.test(result[0] ?? '') && /^```\s*$/.test(result[result.length - 1] ?? '')) {
    result.shift();
    result.pop();
  }
  return result;
}

export function parsePostMarkdown(markdown: string): PostDocument {
  const lines = stripOuterCodeFence(markdown.replace(/\r\n?/g, '\n').split('\n'));
  const { body, buttons } = extractButtonTail(lines);
  const blocks: PostBlock[] = [];
  let index = 0;

  while (index < body.length) {
    if (!body[index].trim()) {
      index += 1;
      continue;
    }

    const details = body[index].match(/^:::details(?:\s+(.*))?$/);
    if (details) {
      const inner: string[] = [];
      index += 1;
      while (index < body.length && body[index].trim() !== ':::') {
        inner.push(body[index]);
        index += 1;
      }
      if (index < body.length && body[index].trim() === ':::') index += 1;
      const detailsBlocks = parseBlocks(inner, false);
      blocks.push({
        type: 'details',
        ...(details[1]?.trim() ? { title: parsePostMarkdownInline(details[1].trim()) } : {}),
        blocks: detailsBlocks.length ? detailsBlocks : [{ type: 'paragraph', content: [{ text: '' }] }],
      });
      continue;
    }

    const nextDetails = body.findIndex((line, lineIndex) => lineIndex >= index && /^:::details(?:\s|$)/.test(line));
    const end = nextDetails >= index ? nextDetails : body.length;
    const parsed = parseBlocks(body.slice(index, end), true);
    blocks.push(...parsed);
    index = end;
  }

  const document: PostDocument = {
    schemaVersion: POST_DOCUMENT_VERSION,
    blocks: blocks.length ? blocks : [{ type: 'paragraph', content: [{ text: '' }] }],
    ...(buttons.length ? { buttons } : {}),
  };
  if (!isPostDocument(document)) throw new Error('Invalid PostMarkdown document');
  return document;
}
