export function logImageSearchGeminiResponse(details: {
  traceId: string;
  attempt: number;
  model: string;
  response: string;
  durationMs: number;
}) {
  console.info('Mini App image search Gemini response', details);
}

export function logImageSearchDownloadResult(details: {
  traceId: string;
  attempt: number;
  imageUrl: string;
  sourceUrl: string;
  product: string;
  status: 'accepted' | 'rejected';
  reason?: 'broken_link' | 'invalid_image' | 'timeout' | 'repeated_url';
}) {
  console.info('Mini App image search download result', details);
}
