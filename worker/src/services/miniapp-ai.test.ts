import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./miniapp-ai.ts', import.meta.url), 'utf8');

describe('Mini App AI PostMarkdown generation', () => {
  it('keeps the original discovery flow', () => {
    expect(source).toContain("const prompt = mode === 'discovery' ? `${message}");
    expect(source).toContain('return { discovery: parseDiscovery(text) }');
    expect(source).not.toContain('GROUNDING_REQUIREMENTS');
    expect(source).not.toContain("toolChoice: 'required'");
  });

  it('keeps Google Search grounding separate from PostMarkdown formatting', () => {
    const groundedStart = source.indexOf('const grounded = await generateText({');
    const formattedStart = source.indexOf('const formatted = await generateText({');
    expect(groundedStart).toBeGreaterThanOrEqual(0);
    expect(formattedStart).toBeGreaterThan(groundedStart);
    const groundedCall = source.slice(groundedStart, formattedStart);
    const formattedCall = source.slice(formattedStart, source.indexOf('const markdown = formatted.text.trim()', formattedStart));
    expect(groundedCall).toContain("tools: { google_search: google.tools.googleSearch({}) }");
    expect(formattedCall).not.toContain('google_search');
  });

  it('does not teach Gemini placeholder URLs', () => {
    expect(source).not.toMatch(/https?:\/\/(?:www\.)?example\.(?:com|org|net)/i);
    expect(source).toContain('[текст](URL)');
    expect(source).toContain('[[Название кнопки]](URL)');
  });

  it('validates model-authored links without changing the generation prompt flow', () => {
    expect(source).toContain("import { sanitizePostDocumentLinks } from './link-validator'");
    expect(source).toContain('const document = await sanitizePostDocumentLinks(parsePostMarkdown(markdown))');
    expect(source).toContain('isPostDocument(document)');
    expect(source).toContain('JSON.stringify(document, null, 2)');
  });
});
