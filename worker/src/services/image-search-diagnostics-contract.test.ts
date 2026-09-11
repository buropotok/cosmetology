import { describe, expect, it } from 'vitest';
import { buildImageSearchPrompt } from './image-search-profiles';

describe('image search diagnostic contract', () => {
  it('keeps the complete post text in the exact Gemini prompt', () => {
    const prompt = buildImageSearchPrompt('cosmetic_product', 'official', 'Диагностический текст публикации');
    expect(prompt).toContain('Диагностический текст публикации');
  });
});
