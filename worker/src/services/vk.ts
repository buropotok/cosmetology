import {AppError, type Env} from '../types';

const API = 'https://api.vk.com/method/';
const VERSION = '5.199';

interface VKErrorPayload {
  error_code?: number;
  error_msg?: string;
}

interface UploadPayload {
  server: number | string;
  photo: string;
  hash: string;
}

class VKAPIError extends AppError {
  constructor(
    public method: string,
    public errorCode: number | undefined,
    public vkErrorMessage: string
  ) {
    super('VK_ERROR', `VK отклонил запрос${errorCode ? ` (код ${errorCode})` : ''}`, 502);
  }
}

function redact(value: string, env: Env) {
  let safe = value;
  for (const secret of [env.VK_ACCESS_TOKEN, env.TELEGRAM_BOT_TOKEN]) {
    if (secret) safe = safe.split(secret).join('[REDACTED]');
  }
  return safe
    .replace(/([?&]access_token=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(authorization\s*[:=]\s*)([^,;\s]+)/gi, '$1[REDACTED]');
}

function logVKFailure(env: Env, method: string, error: VKErrorPayload | undefined, httpStatus?: number) {
  console.error(`[VK] ${method} failed`);
  if (httpStatus !== undefined) console.error('[VK] HTTP status:', httpStatus);
  console.error('[VK] error_code:', error?.error_code ?? 'unknown');
  console.error('[VK] error_msg:', redact(error?.error_msg ?? 'Unknown VK API error', env));
}

async function vk<T>(env: Env, method: string, params: Record<string, string>) {
  console.log(`[VK] ${method} started`);
  const body = new URLSearchParams({...params, access_token: env.VK_ACCESS_TOKEN, v: VERSION});
  const response = await fetch(API + method, {method: 'POST', body});
  let payload: {response?: T; error?: VKErrorPayload};
  try {
    payload = await response.json();
  } catch {
    logVKFailure(env, method, {error_msg: 'VK returned a non-JSON response'}, response.status);
    throw new VKAPIError(method, undefined, 'VK returned a non-JSON response');
  }
  if (!response.ok || payload.error) {
    logVKFailure(env, method, payload.error, response.ok ? undefined : response.status);
    throw new VKAPIError(method, payload.error?.error_code, payload.error?.error_msg ?? 'Unknown VK API error');
  }
  console.log(`[VK] ${method} OK`);
  return payload.response as T;
}

function safeUploadError(env: Env, payload: unknown) {
  if (!payload || typeof payload !== 'object') return undefined;
  const value = payload as Record<string, unknown>;
  return {
    error: typeof value.error === 'string' ? redact(value.error.slice(0, 500), env) : undefined,
    error_code: typeof value.error_code === 'number' ? value.error_code : undefined,
    error_msg: typeof value.error_msg === 'string' ? redact(value.error_msg.slice(0, 500), env) : undefined
  };
}

async function uploadImage(env: Env, uploadUrl: string, image: File) {
  console.log('[VK] image binary upload started');
  const form = new FormData();
  form.set('photo', image, image.name || 'image.jpg');
  const response = await fetch(uploadUrl, {method: 'POST', body: form});
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    console.error('[VK] image binary upload failed');
    console.error('[VK] HTTP status:', response.status);
    console.error('[VK] response:', 'non-JSON response');
    throw new AppError('VK_ERROR', 'VK не принял изображение', 502);
  }
  const upload = payload as Partial<UploadPayload>;
  if (!response.ok || !upload.photo || upload.server === undefined || !upload.hash) {
    console.error('[VK] image binary upload failed');
    console.error('[VK] HTTP status:', response.status);
    console.error('[VK] response:', safeUploadError(env, payload) ?? {keys: payload && typeof payload === 'object' ? Object.keys(payload) : []});
    throw new AppError('VK_ERROR', 'VK не принял изображение', 502);
  }
  console.log('[VK] image binary upload OK');
  console.log('[VK] image upload response:', {
    server_present: true,
    photo_length: upload.photo.length,
    hash_present: true
  });
  return upload as UploadPayload;
}

export async function publishVK(env: Env, text: string, image?: File) {
  let attachments: string | undefined;
  if (image) {
    console.log('[VK] image pipeline started');
    const server = await vk<{upload_url: string}>(env, 'photos.getWallUploadServer', {group_id: env.VK_GROUP_ID});
    const uploaded = await uploadImage(env, server.upload_url, image);
    const saved = await vk<Array<{id: number; owner_id: number}>>(env, 'photos.saveWallPhoto', {
      group_id: env.VK_GROUP_ID,
      photo: uploaded.photo,
      server: String(uploaded.server),
      hash: uploaded.hash
    });
    if (!saved[0] || typeof saved[0].owner_id !== 'number' || typeof saved[0].id !== 'number') {
      console.error('[VK] photos.saveWallPhoto failed');
      console.error('[VK] error_code:', 'invalid_response');
      console.error('[VK] error_msg:', 'Saved photo identifier is missing');
      throw new AppError('VK_ERROR', 'VK не вернул сохраненное изображение', 502);
    }
    attachments = `photo${saved[0].owner_id}_${saved[0].id}`;
    console.log(`[VK] attachment created: ${attachments}`);
  }

  const owner = `-${env.VK_GROUP_ID}`;
  const id = await vk<number>(env, 'wall.post', {
    owner_id: owner,
    from_group: '1',
    message: text,
    ...(attachments ? {attachments} : {})
  });
  return {external_id: String(id), url: `https://vk.com/wall${owner}_${id}`};
}
