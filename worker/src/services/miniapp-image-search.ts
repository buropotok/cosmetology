import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { AppError, type Env } from '../types';
import { MINIAPP_IMAGE_MAX_BYTES } from './miniapp';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';
import { buildImageSearchPrompt, type FailedImageAttempt } from './image-search-profiles';

const DEFAULT_SEARCH_MODEL = 'gemini-2.5-flash';
const MAX_POST_LENGTH = 12000;
const MAX_SEARCH_ATTEMPTS = 3;
const GEMINI_TIMEOUT_MS = 20_000;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

type SearchResult = { imageUrl: string; sourceUrl: string; product: string };

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

export function parseImageSearchResult(text: string): SearchResult | null {
  const value = text.trim();
  if (/^NOT_FOUND\s*$/i.test(value)) return null;
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length !== 3) return null;
  const imageUrl = lines[0].match(/^IMAGE_URL:\s*(\S+)\s*$/i)?.[1] || '';
  const sourceUrl = lines[1].match(/^SOURCE_URL:\s*(\S+)\s*$/i)?.[1] || '';
  const product = lines[2].match(/^PRODUCT:\s*(.+?)\s*$/i)?.[1] || '';
  if (!imageUrl || !sourceUrl || !product || !isSafeHttpsUrl(imageUrl) || !isSafeHttpsUrl(sourceUrl)) return null;
  return { imageUrl, sourceUrl, product };
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

async function askGemini(google: ReturnType<typeof createGoogleGenerativeAI>, model: string, prompt: string, parentSignal: AbortSignal) {
  const deadline = createOperationDeadline(parentSignal, GEMINI_TIMEOUT_MS);
  try {
    const result = await generateText({
      model: google(model),
      tools: { google_search: google.tools.googleSearch({}) },
      abortSignal: deadline.signal,
      prompt,
    });
    if (parentSignal.aborted) throw new AppError('AI_IMAGE_SEARCH_CANCELLED', 'Поиск изображения отменён', 499);
    if (deadline.timedOut()) throw new AppError('AI_IMAGE_SEARCH_TIMEOUT', 'Поиск официального изображения занял слишком много времени. Попробуйте ещё раз.', 504);
    return result.text;
  } catch (error) {
    if (parentSignal.aborted) throw new AppError('AI_IMAGE_SEARCH_CANCELLED', 'Поиск изображения отменён', 499);
    if (deadline.timedOut()) throw new AppError('AI_IMAGE_SEARCH_TIMEOUT', 'Поиск официального изображения занял слишком много времени. Попробуйте ещё раз.', 504);
    throw error;
  } finally {
    deadline.dispose();
  }
}

function diagnosticContext(req: Request, attempt: number, model: string, searchProfile: string, sourcePolicy: string) {
  return {
    traceId: req.headers.get('x-cosmo-trace-id') || null,
    attempt,
    model,
    searchProfile,
    sourcePolicy,
  };
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

  const model = env.AI_TEXT_MODEL?.trim() || DEFAULT_SEARCH_MODEL;
  const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
  const failedAttempts: FailedImageAttempt[] = [];

  for (let attempt = 0; attempt < MAX_SEARCH_ATTEMPTS; attempt += 1) {
    const attemptNumber = attempt + 1;
    const context = diagnosticContext(req, attemptNumber, model, searchProfile, sourcePolicy);
    const prompt = buildImageSearchPrompt(searchProfile, sourcePolicy, text, failedAttempts);
    console.info('Mini App image search gemini.request', { ...context, prompt });
    let answer: string;
    const startedAt = Date.now();
    try {
      answer = await askGemini(google, model, prompt, req.signal);
    } catch (error) {
      console.error('Mini App image search gemini.error', { ...context, durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) });
      if (error instanceof AppError) throw error;
      throw new AppError('AI_IMAGE_SEARCH_FAILED', 'Не удалось выполнить поиск изображения. Попробуйте ещё раз.', 502);
    }
    console.info('Mini App image search gemini.response', { ...context, durationMs: Date.now() - startedAt, response: answer });
    if (/^\s*NOT_FOUND\s*$/i.test(answer)) {
      console.info('Mini App image search parse.result', { ...context, result: 'not_found' });
      throw new AppError('AI_IMAGE_SEARCH_NOT_FOUND', 'Официальное изображение не найдено', 404);
    }
    const result = parseImageSearchResult(answer);
    if (!result) {
      console.warn('Mini App image search parse.result', { ...context, result: 'malformed' });
      continue;
    }
    console.info('Mini App image search parse.result', { ...context, result: 'parsed', imageUrl: result.imageUrl, sourceUrl: result.sourceUrl, product: result.product });
    if (failedAttempts.some(item => item.imageUrl === result.imageUrl)) {
      console.warn('Mini App image search image.download', { ...context, status: 'skipped_repeated_url', imageUrl: result.imageUrl });
      continue;
    }

    const downloadStartedAt = Date.now();
    console.info('Mini App image search image.download', { ...context, status: 'started', imageUrl: result.imageUrl });
    const downloaded = await downloadImage(result.imageUrl, req.signal);
    if (!downloaded.image) {
      console.warn('Mini App image search image.download', { ...context, status: 'failed', durationMs: Date.now() - downloadStartedAt, imageUrl: result.imageUrl, reason: downloaded.reason });
      failedAttempts.push({ imageUrl: result.imageUrl, reason: downloaded.reason });
      continue;
    }
    console.info('Mini App image search image.download', { ...context, status: 'completed', durationMs: Date.now() - downloadStartedAt, imageUrl: result.imageUrl, contentType: downloaded.image.contentType, byteLength: downloaded.image.bytes.byteLength });
    return new Response(downloaded.image.bytes, {
      status: 200,
      headers: {
        'content-type': downloaded.image.contentType,
        'cache-control': 'no-store',
        'content-disposition': 'inline; filename="official-post-image"',
        'x-cosmo-image-source': result.sourceUrl,
        'x-cosmo-image-product': encodeURIComponent(result.product).slice(0, 512),
        'x-content-type-options': 'nosniff',
      },
    });
  }

  throw new AppError('AI_IMAGE_SEARCH_NOT_FOUND', 'Официальное изображение не найдено', 404);
}
