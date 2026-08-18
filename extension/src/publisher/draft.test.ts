import {describe, expect, it} from 'vitest';
import {buildImageFilename, normalizePublicationText} from './draft';

describe('publisher text normalization', () => {
  it('removes only a leading ChatGPT timestamp', () => {
    expect(normalizePublicationText('[2026-08-18 02:44 MSK]\nПочему SPF нужен зимой')).toBe('Почему SPF нужен зимой');
    expect(normalizePublicationText('Заголовок\n[2026-08-18 02:44 MSK]\nТекст')).toBe('Заголовок\n[2026-08-18 02:44 MSK]\nТекст');
  });
});

describe('download filename', () => {
  it.each([
    ['[2026-08-18 02:44 MSK]\nПочему SPF нужен даже зимой', 'Почему-SPF-зимой.png'],
    ['5 мифов о ботоксе, которым пора перестать верить', 'Мифы-ботоксе.png'],
    ['Как правильно ухаживать за кожей после пилинга', 'Уход-после-пилинга.png'],
    ['Биоревитализация: кому подходит процедура', 'Биоревитализация-кому-подходит.png']
  ])('creates a readable deterministic name for %s', (text, expected) => {
    expect(buildImageFilename(text)).toBe(expected);
  });

  it('removes forbidden filename characters and keeps the real extension', () => {
    const filename = buildImageFilename('## Кожа: уход / SPF? <важно>', 'https://example.test/image.jpeg?x=1');
    expect(filename).toBe('Кожа-уход-SPF.jpg');
    expect(filename).not.toMatch(/[<>:"/\\|?*]/);
  });

  it('uses a readable dated fallback', () => {
    expect(buildImageFilename(' 🎉 ', '', new Date(2026, 7, 18))).toBe('Косметология-2026-08-18.png');
  });
});
