import { describe, expect, it } from 'vitest';
import { isPostDocument } from '../../../shared/post-document';
import { parsePostMarkdown, parsePostMarkdownInline } from '../../../shared/post-markdown';

describe('PostMarkdown compiler', () => {
  it('maps supported inline Markdown to PostDocument marks', () => {
    const runs = parsePostMarkdownInline('Это **важно**, *мягко*, ~~устарело~~, ||скрыто|| и [источник](https://example.com/a).');
    expect(runs).toEqual([
      { text: 'Это ' },
      { text: 'важно', marks: [{ type: 'bold' }] },
      { text: ', ' },
      { text: 'мягко', marks: [{ type: 'italic' }] },
      { text: ', ' },
      { text: 'устарело', marks: [{ type: 'strikethrough' }] },
      { text: ', ' },
      { text: 'скрыто', marks: [{ type: 'spoiler' }] },
      { text: ' и ' },
      { text: 'источник', marks: [{ type: 'link', href: 'https://example.com/a' }] },
      { text: '.' },
    ]);
  });

  it('preserves nested inline marks without TextRun syntax in the AI contract', () => {
    expect(parsePostMarkdownInline('**важно и *очень* важно**')).toEqual([
      { text: 'важно и ', marks: [{ type: 'bold' }] },
      { text: 'очень', marks: [{ type: 'bold' }, { type: 'italic' }] },
      { text: ' важно', marks: [{ type: 'bold' }] },
    ]);
  });

  it('compiles headings, paragraphs, quotes, lists, details and trailing buttons', () => {
    const document = parsePostMarkdown(`# SPF каждый день

Кожа имеет **защитный барьер**.

> UVA действует круглый год.

- **Утро:** SPF
  - Обновить при необходимости
- **Вечер:** очищение

1. Очистить кожу
  1. Мягким средством
2. Нанести уход

:::details Подробнее
Дополнительный абзац.

- Первый пункт
- Второй пункт с ||пояснением||

> Важное замечание
:::

[[Записаться]](https://example.com/book)
[[Задать вопрос]](https://example.com/contact)`);

    expect(isPostDocument(document)).toBe(true);
    expect(document.schemaVersion).toBe(2);
    expect(document.blocks.map(block => block.type)).toEqual([
      'heading',
      'paragraph',
      'quote',
      'bullet_list',
      'ordered_list',
      'details',
    ]);

    const bullet = document.blocks[3];
    expect(bullet.type).toBe('bullet_list');
    if (bullet.type === 'bullet_list') {
      expect(Array.isArray(bullet.items[0])).toBe(false);
      const first = bullet.items[0];
      if (!Array.isArray(first)) expect(first.children).toHaveLength(1);
    }

    const details = document.blocks[5];
    expect(details.type).toBe('details');
    if (details.type === 'details') {
      expect(details.title).toEqual([{ text: 'Подробнее' }]);
      expect(details.blocks.map(block => block.type)).toEqual(['paragraph', 'bullet_list', 'quote']);
    }

    expect(document.buttons).toEqual([
      { text: 'Записаться', url: 'https://example.com/book' },
      { text: 'Задать вопрос', url: 'https://example.com/contact' },
    ]);
  });

  it('recognizes buttons only as a trailing tail', () => {
    const document = parsePostMarkdown(`Текст до.

[[Не кнопка]](https://example.com/early)

Текст после.`);
    expect(document.buttons).toBeUndefined();
    expect(document.blocks).toHaveLength(3);
    expect(document.blocks[1]).toMatchObject({ type: 'paragraph' });
  });

  it('tolerates outer Markdown fences and unmatched inline delimiters', () => {
    const document = parsePostMarkdown(`\`\`\`markdown
# Заголовок

Незакрытый **маркер не ломает весь документ.
\`\`\``);
    expect(isPostDocument(document)).toBe(true);
    expect(document.blocks[1]).toEqual({
      type: 'paragraph',
      content: [{ text: 'Незакрытый **маркер не ломает весь документ.' }],
    });
  });
});
