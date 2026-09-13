import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/services/miniapp-image-generation.ts'), 'utf8');

describe('Mini App image generation provider contract', () => {
  it('uses the OpenAI image generation endpoint and server-side API key', () => {
    expect(source).toContain("const DEFAULT_IMAGE_MODEL = 'gpt-image-2'");
    expect(source).toContain("fetch('https://api.openai.com/v1/images/generations'");
    expect(source).toContain('Bearer ${env.OPENAI_API_KEY}');
    expect(source).not.toContain('GEMINI_API_KEY');
    expect(source).not.toContain('generativelanguage.googleapis.com');
  });

  it('requests one vertical PNG and keeps the existing binary image response contract', () => {
    expect(source).toContain("size: '1024x1536'");
    expect(source).toContain("output_format: 'png'");
    expect(source).toContain('n: 1');
    expect(source).toContain("result?.data?.[0]?.b64_json");
    expect(source).toContain("'content-type': 'image/png'");
  });
});
