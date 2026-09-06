import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('./miniapp-ai.ts', import.meta.url), 'utf8');
describe('Mini App AI PostDocument generation', () => {
  it('keeps discovery on the existing parsed response path', () => {
    expect(source).toContain("if (mode === 'discovery')");
    expect(source).toContain('return { discovery: parseDiscovery(text) }');
  });
  it('separates Google Search grounding from structured output', () => {
    const groundedStart = source.indexOf('const grounded = await generateText({');
    const structuredStart = source.indexOf('const structured = await generateText({');
    expect(groundedStart).toBeGreaterThanOrEqual(0);
    expect(structuredStart).toBeGreaterThan(groundedStart);
    const groundedCall = source.slice(groundedStart, structuredStart);
    const structuredCall = source.slice(structuredStart, source.indexOf('if (!structured.output', structuredStart));
    expect(groundedCall).toContain("tools: { google_search: google.tools.googleSearch({}) }");
    expect(groundedCall).not.toContain('Output.object');
    expect(structuredCall).toContain('Output.object');
    expect(structuredCall).not.toContain('google_search');
  });
  it('validates and returns pretty PostDocument JSON', () => {
    expect(source).toContain('isPostDocument(structured.output)');
    expect(source).toContain('JSON.stringify(structured.output, null, 2)');
  });
});
