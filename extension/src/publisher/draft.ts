export type ImageMode = 'text_only' | 'illustration' | 'infographic' | 'existing';

export interface PublisherImage {
  url: string;
  filename: string;
  alt?: string;
  width?: number;
  height?: number;
}

import type {PostDocument} from '../../../shared/post-document';
export interface PublisherDraft {
  originalText: string;
  publicationText: string;
  imageMode: ImageMode;
  image: PublisherImage | null;
  postDocument?: PostDocument;
}

const LEADING_TIMESTAMP = /^\s*\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+MSK\]\s*/;
const STOP_WORDS = new Set([
  'и', 'в', 'во', 'на', 'с', 'со', 'к', 'ко', 'о', 'об', 'от', 'до', 'для', 'из', 'по', 'за', 'а', 'но', 'как', 'что', 'это',
  'нужен', 'нужна', 'нужно', 'даже', 'правильно', 'которым', 'которой', 'которые', 'пора', 'перестать', 'верить', 'кожей'
]);
const CANONICAL_WORDS: Record<string, string> = {мифов: 'Мифы', ухаживать: 'Уход'};

export function normalizePublicationText(text: string) {
  return text.replace(LEADING_TIMESTAMP, '').trimStart();
}

export function extractTitle(text: string) {
  const normalized = normalizePublicationText(text);
  const first = normalized.split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? '';
  const title = first.replace(/^#{1,6}\s*/, '').trim();
  return title || first || normalized.trim();
}

export function buildImageFilename(postText: string, sourceUrl = '', now = new Date()) {
  const title = extractTitle(postText).replace(/[<>:"/\\|?*]/g, ' ');
  const words = title.match(/[\p{L}\p{N}]+/gu) ?? [];
  const meaningful = words
    .filter(word => !/^\d+$/.test(word) && !STOP_WORDS.has(word.toLocaleLowerCase('ru-RU')))
    .map(word => CANONICAL_WORDS[word.toLocaleLowerCase('ru-RU')] ?? word)
    .slice(0, 3);
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const base = (meaningful.join('-') || `Косметология-${date}`).slice(0, 80).replace(/[. ]+$/g, '');
  const extension = sourceUrl.match(/\.(png|jpe?g|webp)(?:[?#]|$)/i)?.[1].toLocaleLowerCase().replace('jpeg', 'jpg') ?? 'png';
  return `${base}.${extension}`;
}
