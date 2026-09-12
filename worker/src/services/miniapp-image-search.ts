import { AppError, type Env } from '../types';
import { MINIAPP_IMAGE_MAX_BYTES } from './miniapp';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';
import { buildImageSearchPrompt } from './image-search-profiles';

const SEARCH_MODEL = 'gpt-5.6-luna';
const MAX_POST_LENGTH = 12000;
const MAX_IMAGE_RESULTS = 8;
const OPENAI_TIMEOUT_MS = 20_000;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const IMPORT_TOKEN_TTL_SECONDS = 10 * 60;
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

type RawImageResult = {
  type?: unknown;
  image_url?: unknown;
  thumbnail_url?: unknown;
  source_website_url?: unknown;
  caption?: unknown;
};
type OpenAIResponse = {
  output?: Array<{ type?: unknown; results?: RawImageResult[] }>;
  error?: { message?: unknown };
};
export type ImageSearchResult = {
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
  caption: string;
  importToken: string;
};

function getMiniAppInitData(req: Request) {
  return req.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? '';
}

export function isSafeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(':')) return false;
    return true;
  } catch { return false; }
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function extractImageSearchResults(payload: OpenAIResponse) {
  const results: Array<Omit<ImageSearchResult, 'importToken'>> = [];
  const seen = new Set<string>();
  for (const item of payload.output || []) {
    if (item?.type !== 'web_search_call' || !Array.isArray(item.results)) continue;
    for (const raw of item.results) {
      if (raw?.type !== 'image_result') continue;
      const imageUrl = cleanText(raw.image_url, 4096);
      const sourceCandidate = cleanText(raw.source_website_url, 4096);
      const sourceUrl = isSafeHttpsUrl(sourceCandidate) ? sourceCandidate : '';
      const thumbnailCandidate = cleanText(raw.thumbnail_url, 4096);
      if (!isSafeHttpsUrl(imageUrl) || seen.has(imageUrl)) continue;
      const thumbnailUrl = isSafeHttpsUrl(thumbnailCandidate) ? thumbnailCandidate : imageUrl;
      results.push({ imageUrl, thumbnailUrl, sourceUrl, caption: cleanText(raw.caption, 500) });
      seen.add(imageUrl);
      if (results.length >= MAX_IMAGE_RESULTS) return results;
    }
  }
  return results;
}

function bytesToToken(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function importSignature(env: Env, imageUrl: string, expires: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.TELEGRAM_BOT_TOKEN), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${imageUrl}\n${expires}`));
  return bytesToToken(new Uint8Array(signature));
}

async function importToken(env: Env, imageUrl: string) {
  const expires = Math.floor(Date.now() / 1000) + IMPORT_TOKEN_TTL_SECONDS;
  return `${expires}.${await importSignature(env, imageUrl, expires)}`;
}

async function validateImportToken(env: Env, imageUrl: string, token: string) {
  const separator = token.indexOf('.');
  if (separator <= 0) return false;
  const expires = Number(token.slice(0, separator));
  const signature = token.slice(separator + 1);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expires) || expires < now || expires > now + IMPORT_TOKEN_TTL_SECONDS + 60) return false;
  const expected = await importSignature(env, imageUrl, expires);
  if (signature.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < signature.length; i += 1) diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
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
  } catch {
    if (signal.aborted) throw new AppError('AI_IMAGE_SEARCH_CANCELLED', 'Поиск изображения отменён', 499);
    await cancelReader(reader);
    return null;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function hasBytes(bytes: Uint8Array, offset: number, expected: readonly number[]) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function readUint32BE(bytes: Uint8Array, offset: number) {
  return (((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function readUint32LE(bytes: Uint8Array, offset: number) {
  return (bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16) + ((bytes[offset + 3] << 24) >>> 0)) >>> 0;
}

function isCompletePng(bytes: Uint8Array) {
  if (bytes.length < 45 || !hasBytes(bytes, 0, [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) return false;
  let offset = 8;
  let sawIhdr = false;
  let sawIdat = false;
  while (offset + 12 <= bytes.length) {
    const length = readUint32BE(bytes, offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) return false;
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    if (!sawIhdr) {
      if (type !== 'IHDR' || length !== 13) return false;
      sawIhdr = true;
    } else if (type === 'IHDR') return false;
    if (type === 'IDAT') sawIdat = true;
    if (type === 'IEND') return length === 0 && sawIhdr && sawIdat && chunkEnd === bytes.length;
    offset = chunkEnd;
  }
  return false;
}

function isCompleteJpeg(bytes: Uint8Array) {
  if (bytes.length < 16 || !hasBytes(bytes, 0, [0xff,0xd8]) || !hasBytes(bytes, bytes.length - 2, [0xff,0xd9])) return false;
  let offset = 2;
  let sawFrame = false;
  let sawScan = false;
  while (offset < bytes.length - 2) {
    if (bytes[offset] !== 0xff) {
      if (!sawScan) return false;
      offset += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return false;
    const marker = bytes[offset++];
    if (marker === 0x00) {
      if (!sawScan) return false;
      continue;
    }
    if (marker === 0xd9) return sawFrame && sawScan && offset === bytes.length;
    if (marker >= 0xd0 && marker <= 0xd7) {
      if (!sawScan) return false;
      continue;
    }
    if (marker === 0x01) continue;
    if (offset + 2 > bytes.length) return false;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return false;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) sawFrame = true;
    if (marker === 0xda) sawScan = true;
    offset += length;
  }
  return sawFrame && sawScan;
}

function isCompleteGif(bytes: Uint8Array) {
  if (bytes.length < 20 || !(hasBytes(bytes, 0, [0x47,0x49,0x46,0x38,0x37,0x61]) || hasBytes(bytes, 0, [0x47,0x49,0x46,0x38,0x39,0x61])) || bytes[bytes.length - 1] !== 0x3b) return false;
  let offset = 13;
  const packed = bytes[10];
  if (packed & 0x80) offset += 3 * (1 << ((packed & 0x07) + 1));
  let sawImage = false;
  while (offset < bytes.length) {
    const introducer = bytes[offset++];
    if (introducer === 0x3b) return sawImage && offset === bytes.length;
    if (introducer === 0x2c) {
      if (offset + 9 > bytes.length) return false;
      const imagePacked = bytes[offset + 8];
      offset += 9;
      if (imagePacked & 0x80) offset += 3 * (1 << ((imagePacked & 0x07) + 1));
      if (offset >= bytes.length) return false;
      offset += 1;
      sawImage = true;
    } else if (introducer === 0x21) {
      if (offset >= bytes.length) return false;
      offset += 1;
    } else return false;
    while (offset < bytes.length) {
      const blockSize = bytes[offset++];
      if (blockSize === 0) break;
      if (offset + blockSize > bytes.length) return false;
      offset += blockSize;
    }
  }
  return false;
}

function isCompleteWebp(bytes: Uint8Array) {
  if (bytes.length < 20 || !hasBytes(bytes, 0, [0x52,0x49,0x46,0x46]) || !hasBytes(bytes, 8, [0x57,0x45,0x42,0x50])) return false;
  if (readUint32LE(bytes, 4) + 8 !== bytes.length) return false;
  let offset = 12;
  let sawImageChunk = false;
  while (offset + 8 <= bytes.length) {
    const type = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const length = readUint32LE(bytes, offset + 4);
    const paddedLength = length + (length & 1);
    if (offset + 8 + paddedLength > bytes.length) return false;
    if (type === 'VP8 ' || type === 'VP8L' || type === 'VP8X') sawImageChunk = true;
    offset += 8 + paddedLength;
  }
  return sawImageChunk && offset === bytes.length;
}

export function detectSupportedImageContentType(bytes: Uint8Array) {
  if (isCompletePng(bytes)) return 'image/png';
  if (isCompleteJpeg(bytes)) return 'image/jpeg';
  if (isCompleteGif(bytes)) return 'image/gif';
  if (isCompleteWebp(bytes)) return 'image/webp';
  return '';
}

function createOperationDeadline(parentSignal: AbortSignal, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const onParentAbort = () => controller.abort();
  if (parentSignal.aborted) controller.abort();
  else parentSignal.addEventListener('abort', onParentAbort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => { clearTimeout(timer); parentSignal.removeEventListener('abort', onParentAbort); },
  };
}

async function fetchWithSafeRedirects(urlValue: string, signal: AbortSignal) {
  let url = urlValue;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (!isSafeHttpsUrl(url)) return null;
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: 'manual', signal,
        headers: { accept: 'image/*', 'user-agent': 'Mozilla/5.0 (compatible; CosmoSofa/1.0; +https://cosmetology-social-publisher.buropotok.workers.dev)' },
      });
    } catch {
      if (signal.aborted) throw new Error('download_aborted');
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

export async function downloadImage(imageUrl: string, parentSignal: AbortSignal) {
  const deadline = createOperationDeadline(parentSignal, IMAGE_DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetchWithSafeRedirects(imageUrl, deadline.signal);
    if (parentSignal.aborted) throw new AppError('AI_IMAGE_SEARCH_CANCELLED', 'Поиск изображения отменён', 499);
    if (deadline.timedOut()) return { image: null, reason: 'timeout' as const };
    if (!response?.ok || !isSafeHttpsUrl(response.url || imageUrl)) return { image: null, reason: 'broken_link' as const };
    const bytes = await readLimitedResponseBody(response, MINIAPP_IMAGE_MAX_BYTES, deadline.signal);
    if (deadline.timedOut()) return { image: null, reason: 'timeout' as const };
    if (!bytes?.byteLength) return { image: null, reason: 'invalid_image' as const };
    const contentType = detectSupportedImageContentType(bytes);
    if (!contentType) return { image: null, reason: 'invalid_image' as const };
    const body = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(body).set(bytes);
    return { image: { bytes: body, contentType }, reason: null };
  } catch (error) {
    if (parentSignal.aborted) throw new AppError('AI_IMAGE_SEARCH_CANCELLED', 'Поиск изображения отменён', 499);
    if (deadline.timedOut()) return { image: null, reason: 'timeout' as const };
    throw error;
  } finally {
    deadline.dispose();
  }
}

export function buildOpenAIImageSearchRequest(prompt: string) {
  return {
    model: SEARCH_MODEL,
    reasoning: { effort: 'low' },
    tools: [{ type: 'web_search', search_content_types: ['image', 'text'], image_settings: { max_results: MAX_IMAGE_RESULTS, caption: true } }],
    tool_choice: 'required',
    include: ['web_search_call.results'],
    input: prompt,
  };
}

async function callOpenAIImageSearch(apiKey: string, prompt: string, parentSignal: AbortSignal) {
  const deadline = createOperationDeadline(parentSignal, OPENAI_TIMEOUT_MS);
  try {
    const request = buildOpenAIImageSearchRequest(prompt);
    console.info('OPENAI request', JSON.stringify(request));
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      signal: deadline.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    if (parentSignal.aborted) throw new AppError('AI_IMAGE_SEARCH_CANCELLED', 'Поиск изображения отменён', 499);
    if (deadline.timedOut()) throw new AppError('AI_IMAGE_SEARCH_TIMEOUT', 'Поиск изображения занял слишком много времени. Попробуйте ещё раз.', 504);
    const payload = await response.json().catch(() => null) as OpenAIResponse | null;
    console.info('OPENAI response', JSON.stringify({ status: response.status, payload }));
    if (!response.ok) {
      const message = typeof payload?.error?.message === 'string' ? payload.error.message : `OpenAI HTTP ${response.status}`;
      throw new Error(message);
    }
    if (!payload) throw new Error('OpenAI returned invalid JSON');
    return extractImageSearchResults(payload);
  } catch (error) {
    if (parentSignal.aborted) throw new AppError('AI_IMAGE_SEARCH_CANCELLED', 'Поиск изображения отменён', 499);
    if (deadline.timedOut()) throw new AppError('AI_IMAGE_SEARCH_TIMEOUT', 'Поиск изображения занял слишком много времени. Попробуйте ещё раз.', 504);
    throw error;
  } finally {
    deadline.dispose();
  }
}

export async function searchMiniAppImage(req: Request, env: Env) {
  await validateTelegramMiniAppInitData(getMiniAppInitData(req), env.TELEGRAM_BOT_TOKEN);
  const body = await req.json().catch(() => null) as {
    text?: unknown;
    searchProfile?: unknown;
    sourcePolicy?: unknown;
    imageUrl?: unknown;
    importToken?: unknown;
  } | null;

  const selectedImageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : '';
  const selectedImportToken = typeof body?.importToken === 'string' ? body.importToken.trim() : '';
  if (selectedImageUrl || selectedImportToken) {
    if (!isSafeHttpsUrl(selectedImageUrl) || !selectedImportToken || !await validateImportToken(env, selectedImageUrl, selectedImportToken)) {
      throw new AppError('AI_IMAGE_SEARCH_RESULT_INVALID', 'Результат поиска изображения недействителен или устарел', 400);
    }
    const downloaded = await downloadImage(selectedImageUrl, req.signal);
    if (!downloaded.image) throw new AppError('AI_IMAGE_SEARCH_IMAGE_UNAVAILABLE', 'Выбранное изображение недоступно. Выберите другой вариант.', 422);
    return new Response(downloaded.image.bytes, {
      status: 200,
      headers: {
        'content-type': downloaded.image.contentType,
        'cache-control': 'no-store',
        'content-disposition': 'inline; filename="web-search-image"',
        'x-content-type-options': 'nosniff',
      },
    });
  }

  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const searchProfile = typeof body?.searchProfile === 'string' ? body.searchProfile.trim() : '';
  const sourcePolicy = typeof body?.sourcePolicy === 'string' ? body.sourcePolicy.trim() : '';
  if (!text) throw new AppError('AI_IMAGE_TEXT_REQUIRED', 'Введите текст публикации', 400);
  if (text.length > MAX_POST_LENGTH) throw new AppError('AI_IMAGE_TEXT_TOO_LONG', `Текст не должен превышать ${MAX_POST_LENGTH} символов`, 400);
  if (!searchProfile) throw new AppError('AI_IMAGE_SEARCH_PROFILE_REQUIRED', 'Не указан профиль поиска изображения', 400);
  if (!sourcePolicy) throw new AppError('AI_IMAGE_SOURCE_POLICY_REQUIRED', 'Не указана политика источников изображения', 400);
  if (!env.OPENAI_API_KEY) throw new AppError('AI_NOT_CONFIGURED', 'AI пока не настроен', 503);

  const prompt = buildImageSearchPrompt(searchProfile, sourcePolicy, text);
  let rawResults: Array<Omit<ImageSearchResult, 'importToken'>>;
  try {
    rawResults = await callOpenAIImageSearch(env.OPENAI_API_KEY, prompt, req.signal);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('OPENAI error', error instanceof Error ? error.message : String(error));
    throw new AppError('AI_IMAGE_SEARCH_FAILED', 'Не удалось выполнить поиск изображений. Попробуйте ещё раз.', 502);
  }
  if (!rawResults.length) throw new AppError('AI_IMAGE_SEARCH_NOT_FOUND', 'Подходящие изображения не найдены', 404);
  const images: ImageSearchResult[] = [];
  for (const result of rawResults) images.push({ ...result, importToken: await importToken(env, result.imageUrl) });
  return new Response(JSON.stringify({ images }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}