import { describe, expect, it, vi } from 'vitest';
import { logImageSearchDownloadResult, logImageSearchGeminiResponse } from './image-search-gemini-response-diagnostics';

describe('image search Gemini diagnostics', () => {
  it('logs the complete Gemini response with trace correlation', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    logImageSearchGeminiResponse({ traceId: 'image-1', attempt: 2, model: 'gemini-2.5-flash', response: 'IMAGE_URL: https://brand.example/a.png', durationMs: 123 });
    expect(info).toHaveBeenCalledWith('Mini App image search Gemini response', expect.objectContaining({ traceId: 'image-1', attempt: 2, response: 'IMAGE_URL: https://brand.example/a.png' }));
    info.mockRestore();
  });

  it('logs download rejection reason without credentials', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    logImageSearchDownloadResult({ traceId: 'image-1', attempt: 1, imageUrl: 'https://brand.example/a.png', sourceUrl: 'https://brand.example/p', product: 'P', status: 'rejected', reason: 'invalid_image' });
    expect(info).toHaveBeenCalledWith('Mini App image search download result', expect.objectContaining({ reason: 'invalid_image' }));
    info.mockRestore();
  });
});
