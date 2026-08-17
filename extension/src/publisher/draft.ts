export type ImageMode = 'text_only' | 'illustration' | 'infographic' | 'existing';

export interface PublisherImage {
  url: string;
  filename: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface PublisherDraft {
  originalText: string;
  publicationText: string;
  imageMode: ImageMode;
  image: PublisherImage | null;
}

export function extractTitle(text: string) {
  const first = text.split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? '';
  const title = first.replace(/^#{1,6}\s*/, '').trim();
  return title || first || text.trim();
}
