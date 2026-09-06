import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('./miniapp-ai.ts', import.meta.url), 'utf8');
describe('Mini App AI PostMarkdown generation', () => {
  it('keeps discovery on the existing parsed response path', () => {
    expect(source).toContain("if (mode === 'discovery')");
    expect(source).toContain('return { discovery: parseDiscovery(text) }');
  });
  it('separates Google Search grounding from PostMarkdown formatting', () => {
    const groundedStart = source.indexOf('const grounded = await generateText({');
    const formattedStart = source.indexOf('const formatted = await generateText({');
    expect(groundedStart).toBeGreaterThanOrEqual(0);
    expect(formattedStart).toBeGreaterThan(groundedStart);
    const groundedCall = source.slice(groundedStart, formattedStart);
    const formattedCall = source.slice(formattedStart, source.indexOf("const markdown = formatted.text.trim()", formattedStart));
    expect(groundedCall).toContain("tools: { google_search: google.tools.googleSearch({}) }");
    expect(formattedCall).not.toContain('google_search');
    expect(source).not.toContain('Output.object');
    expect(source).not.toContain('post_document_schema.json');
  });
  it('compiles PostMarkdown to canonical PostDocument JSON', () => {
    expect(source).toContain('const document = parsePostMarkdown(markdown)');
    expect(source).toContain('isPostDocument(document)');
    expect(source).toContain('JSON.stringify(document, null, 2)');
  });
  it('defines the compact details and trailing button contract', () => {
    expect(source).toContain(':::details Короткий заголовок');
    expect(source).toContain('[[Название кнопки]](https://example.com)');
    expect(source).toContain('После первой кнопки разрешены только другие кнопки');
  });
});
