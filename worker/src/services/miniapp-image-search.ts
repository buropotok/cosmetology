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
const MAX_HTML_CHARS = 750_000;
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
  const html = (await response.text()).slice(0, MAX_HTML_CHARS);
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
  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!contentType.startsWith('image/')) return null;
  const declaredSize = Number(response.headers.get('content-length') || 0);
  if (declaredSize > MINIAPP_IMAGE_MAX_BYTES) return null;
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (signal.aborted) throw new AppError('AI_IMAGE_SEARCH_CANCELLED', 'Поиск изображения отменён', 499);
    return null;
  }
  if (!bytes.length || bytes.byteLength > MINIAPP_IMAGE_MAX_BYTES) return null;
  return { bytes, contentType };
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
