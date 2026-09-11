import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { AppError, type Env } from '../types';
import { MINIAPP_IMAGE_MAX_BYTES } from './miniapp';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';
import { buildImageSearchPrompt } from './image-search-profiles';

const DEFAULT_SEARCH_MODEL = 'gemini-2.5-flash';
const MAX_POST_LENGTH = 12000;
const MAX_SOURCE_PAGES = 5;
const MAX_IMAGES_PER_PAGE = 6;
const MAX_HTML_BYTES = 750_000;
const BLOCKED_NON_OFFICIAL_HOSTS = [
  'amazon.',
  'aliexpress.',
  'ebay.',
  'etsy.',
  'facebook.',
  'instagram.',
  'market.yandex.',
  'ozon.',
  'pinterest.',
  'reddit.',
  'tiktok.',
  'vk.',
  'wildberries.',
  'wikipedia.',
  'youtube.',
];

type UrlSource = { sourceType?: unknown; url?: unknown; title?: unknown };

function getMiniAppInitData(req: Request) {
  return req.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? '';
}

function isSafeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(':')) return false;
    return true;
  } catch {
    return false;
  }
}

function isBlockedOfficialHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  return BLOCKED_NON_OFFICIAL_HOSTS.some(part => host === part.slice(0, -1) || host.includes(part));
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function tagAttributes(tag: string) {
  const attrs: Record<string, string> = {};
  const expression = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(tag))) attrs[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '');
  return attrs;
}

export function extractPageImageCandidates(html: string, pageUrl: string) {
  const candidates: string[] = [];
  const add = (value?: string) => {
    if (!value) return;
    try {
      const url = new URL(value, pageUrl).toString();
      if (isSafeHttpsUrl(url) && !candidates.includes(url)) candidates.push(url);
    } catch {}
  };

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = tagAttributes(match[0]);
    const key = (attrs.property || attrs.name || '').toLowerCase();
    if (['og:image','og:image:url','og:image:secure_url','twitter:image','twitter:image:src'].includes(key)) add(attrs.content);
  }
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = tagAttributes(match[0]);
    if ((attrs.rel || '').toLowerCase().split(/\s+/).includes('image_src')) add(attrs.href);
  }
  return candidates;
}

function normalizedHost(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].replace(/\.$/, '');
}

export function officialHostMatches(actual: string, expected: string) {
  const left = normalizedHost(actual);
  const right = normalizedHost(expected);
  return Boolean(left && right && (left === right || left.endsWith(`.${right}`)));
}

export function extractExpectedOfficialHost(text: string) {
  const match = text.trim().match(/^FOUND\s*[—-]\s*.+?\s*[—-]\s*([^\s]+)\s*$/i);
  if (!match) return '';
  const rawHost = match[1].trim();
  if (/[\/:?#@]/.test(rawHost)) return '';
  const host = normalizedHost(rawHost);
  if (!host || host.includes(':') || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return '';
  return host;
}

async function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>) {
  try { await reader.cancel(); } catch {}
}

export async function readLimitedResponseBody(response: Response, maxBytes: number, signal: AbortSignal) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new RangeError('maxBytes must be a positive safe integer');
  const declaredRaw = response.headers.get('content-length');
  const declaredSize = declaredRaw ? Number(declaredRaw) : 0;
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
    try { await response.body?.cancel(); } catch {}
    return null;
  }
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      if (signal.aborted) {
        await cancelReader(reader);
        throw new AppError('AI_IMAGE_SEARCH_CANCELLED', 'Поиск изображения отменён', 499);
      }
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      if (total + value.byteLength > maxBytes) {
        await cancelReader(reader);
        return null;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } catch (error) {
    if (signal.aborted) throw new AppError('AI_IMAGE_SEARCH_CANCELLED', 'Поиск изображения отменён', 499);
    await cancelReader(reader);
    return null;
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function detectSupportedImageContentType(bytes: Uint8Array) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return 'image/gif';
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return '';
}

async function fetchWithSafeRedirects(urlValue: string, init: RequestInit, signal: AbortSignal) {
  let url = urlValue;
  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    if (!isSafeHttpsUrl(url)) return null;
    let response: Response;
    try {
      response = await fetch(url, { ...init, redirect: 'manual', signal });
    } catch (error) {
      if (signal.aborted) throw new AppError('AI_IMAGE_SEARCH_CANCELLED', 'Поиск изображения отменён', 499);
      return null;
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return null;
      try { url = new URL(location, url).toString(); } catch { return null; }
      continue;
    }
    return response;
  }
  return null;
}

async function fetchOfficialPage(sourceUrl: string, expectedHost: string, signal: AbortSignal) {
  const response = await fetchWithSafeRedirects(sourceUrl, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'Mozilla/5.0 (compatible; CosmoSofa/1.0; +https://cosmetology-social-publisher.buropotok.workers.dev)',
    },
  }, signal);
  if (!response?.ok || !isSafeHttpsUrl(response.url)) return null;
  const finalUrl = new URL(response.url);
  if (isBlockedOfficialHost(finalUrl.hostname) || !officialHostMatches(finalUrl.hostname, expectedHost)) return null;
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) return null;
  const bytes = await readLimitedResponseBody(response, MAX_HTML_BYTES, signal);
  if (!bytes) return null;
  const html = new TextDecoder().decode(bytes);
  return { url: finalUrl.toString(), html };
}

async function fetchImageCandidate(imageUrl: string, signal: AbortSignal) {
  const response = await fetchWithSafeRedirects(imageUrl, {
    headers: {
      accept: 'image/*',
      'user-agent': 'Mozilla/5.0 (compatible; CosmoSofa/1.0; +https://cosmetology-social-publisher.buropotok.workers.dev)',
    },
  }, signal);
  if (!response?.ok || !isSafeHttpsUrl(response.url)) return null;
  const declaredType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!declaredType.startsWith('image/')) return null;
  const bytes = await readLimitedResponseBody(response, MINIAPP_IMAGE_MAX_BYTES, signal);
  if (!bytes?.byteLength) return null;
  const contentType = detectSupportedImageContentType(bytes);
  if (!contentType) return null;
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return { bytes: body, contentType };
}

function groundedSourceUrls(sources: readonly UrlSource[]) {
  const result: string[] = [];
  for (const source of sources) {
    if (source?.sourceType !== 'url' || typeof source.url !== 'string' || !source.url) continue;
    if (!isSafeHttpsUrl(source.url) || result.includes(source.url)) continue;
    result.push(source.url);
  }
  return result;
}

export async function searchMiniAppImage(req: Request, env: Env) {
  await validateTelegramMiniAppInitData(getMiniAppInitData(req), env.TELEGRAM_BOT_TOKEN);
  const body = await req.json().catch(() => null) as { text?: unknown; searchProfile?: unknown; sourcePolicy?: unknown } | null;
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const searchProfile = typeof body?.searchProfile === 'string' ? body.searchProfile.trim() : '';
  const sourcePolicy = typeof body?.sourcePolicy === 'string' ? body.sourcePolicy.trim() : '';
  if (!text) throw new AppError('AI_IMAGE_TEXT_REQUIRED', 'Введите текст публикации', 400);
  if (text.length > MAX_POST_LENGTH) throw new AppError('AI_IMAGE_TEXT_TOO_LONG', `Текст не должен превышать ${MAX_POST_LENGTH} символов`, 400);
  if (!searchProfile) throw new AppError('AI_IMAGE_SEARCH_PROFILE_REQUIRED', 'Не указан профиль поиска изображения', 400);
  if (!sourcePolicy) throw new AppError('AI_IMAGE_SOURCE_POLICY_REQUIRED', 'Не указана политика источников изображения', 400);
  if (!env.GEMINI_API_KEY) throw new AppError('AI_NOT_CONFIGURED', 'AI пока не настроен', 503);

  const prompt = buildImageSearchPrompt(searchProfile, sourcePolicy, text);
  const model = env.AI_TEXT_MODEL?.trim() || DEFAULT_SEARCH_MODEL;
  const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
  let grounded;
  try {
    grounded = await generateText({
      model: google(model),
      tools: { google_search: google.tools.googleSearch({}) },
      abortSignal: req.signal,
      prompt,
    });
  } catch (error) {
    if (req.signal.aborted) throw new AppError('AI_IMAGE_SEARCH_CANCELLED', 'Поиск изображения отменён', 499);
    console.error('Mini App image search failed', { model, searchProfile, sourcePolicy, error: error instanceof Error ? error.message : String(error) });
    throw new AppError('AI_IMAGE_SEARCH_FAILED', 'Не удалось выполнить поиск изображения. Попробуйте ещё раз.', 502);
  }
  if (req.signal.aborted) throw new AppError('AI_IMAGE_SEARCH_CANCELLED', 'Поиск изображения отменён', 499);
  if (/^\s*NOT_FOUND\b/i.test(grounded.text)) throw new AppError('AI_IMAGE_SEARCH_NOT_FOUND', 'Официальное изображение не найдено', 404);
  const officialHost = extractExpectedOfficialHost(grounded.text);
  if (!officialHost || isBlockedOfficialHost(officialHost)) throw new AppError('AI_IMAGE_SEARCH_NOT_FOUND', 'Официальное изображение не найдено', 404);

  const sourceUrls = groundedSourceUrls((grounded as unknown as { sources?: readonly UrlSource[] }).sources || []).slice(0, MAX_SOURCE_PAGES);
  for (const sourceUrl of sourceUrls) {
    const page = await fetchOfficialPage(sourceUrl, officialHost, req.signal);
    if (!page) continue;
    const imageUrls = extractPageImageCandidates(page.html, page.url).slice(0, MAX_IMAGES_PER_PAGE);
    for (const imageUrl of imageUrls) {
      const image = await fetchImageCandidate(imageUrl, req.signal);
      if (!image) continue;
      return new Response(image.bytes, {
        status: 200,
        headers: {
          'content-type': image.contentType,
          'cache-control': 'no-store',
          'content-disposition': 'inline; filename="official-post-image"',
          'x-cosmo-image-source': page.url,
          'x-content-type-options': 'nosniff',
        },
      });
    }
  }

  throw new AppError('AI_IMAGE_SEARCH_NOT_FOUND', 'Официальное изображение не найдено', 404);
}
