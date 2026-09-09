import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('./miniapp-ai.ts', import.meta.url), 'utf8');
describe('Mini App AI PostMarkdown generation', () => {
  it('keeps discovery on the existing parsed response path', () => {
    expect(source).toContain("if (mode === 'discovery')");
    expect(source).toContain('return { discovery }');
  });
  it('forces Google Search grounding before PostMarkdown formatting', () => {
    const groundedStart = source.indexOf('const grounded = await generateText({');
    const formattedStart = source.indexOf('const formatted = await generateText({');
    expect(groundedStart).toBeGreaterThanOrEqual(0);
    expect(formattedStart).toBeGreaterThan(groundedStart);
    const groundedCall = source.slice(groundedStart, formattedStart);
    const formattedCall = source.slice(formattedStart, source.indexOf('const markdown = formatted.text.trim()', formattedStart));
    expect(groundedCall).toContain("tools: { google_search: google.tools.googleSearch({}) }");
    expect(groundedCall).toContain("toolChoice: 'required'");
    expect(formattedCall).not.toContain('google_search');
    expect(source).not.toContain('Output.object');
    expect(source).not.toContain('post_document_schema.json');
  });
  it('removes placeholder URL examples from production prompts', () => {
    expect(source).not.toMatch(/https?:\/\/(?:www\.)?example\.(?:com|org|net)/i);
    expect(source).toContain('Никогда не используй placeholder-домены');
    expect(source).toContain('Не придумывай URL');
  });
  it('accepts Discovery source URLs only from Google Search and requires them for news', () => {
    expect(source).toContain("if(!source)throw new Error('Discovery source was not returned by Google Search')");
    expect(source).toContain("if(requireSource)throw new Error('Discovery returned an idea without a source')");
    expect(source).toContain("validateDiscoverySources(parseDiscovery(text),result.sources,kind==='news')");
  });
  it('verifies grounding sources and appends them after the generated post', () => {
    expect(source).toContain('const sources=await verifiedGroundingSources(grounded.sources)');
    expect(source).toContain("if(!sources.length)throw new Error('Gemini returned no reachable grounding sources')");
    expect(source).toContain("{type:'heading',content:[{text:'Источники'}]}");
    expect(source).toContain("{type:'bullet_list',items:sources.map(source=>[{text:source.name,marks:[{type:'link',href:source.url}]}])}");
  });
  it('sanitizes any model-authored links before returning canonical PostDocument JSON', () => {
    expect(source).toContain('const sanitized=await sanitizePostDocumentLinks(parsed)');
    expect(source).toContain('const document=appendVerifiedSources(sanitized,sources)');
    expect(source).toContain('isPostDocument(document)');
    expect(source).toContain('JSON.stringify(document, null, 2)');
  });
});
