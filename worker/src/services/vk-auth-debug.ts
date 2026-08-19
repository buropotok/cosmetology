const VK_API = 'https://api.vk.com/method/';
const VK_API_VERSION = '5.199';
const METHOD = 'photos.getWallUploadServer';

interface VKErrorPayload {
  error_code?: number;
  error_msg?: string;
}

export type VKAuthDebugResult =
  | {ok: true; method: typeof METHOD; result: {upload_url_present: boolean; album_id: unknown; user_id: unknown}}
  | {ok: false; method: typeof METHOD; vk_error: {error_code: number | null; error_msg: string}}
  | {ok: false; method: typeof METHOD; transport_error: {http_status: number | null; message: string}};

function redact(value: string, accessToken: string) {
  return value
    .split(accessToken).join('[REDACTED]')
    .replace(/([?&]access_token=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(authorization\s*[:=]\s*)([^,;\s]+)/gi, '$1[REDACTED]');
}

function transportError(accessToken: string, httpStatus: number | null, message: string): VKAuthDebugResult {
  const safeMessage = redact(message, accessToken);
  console.error('[VK DEBUG] photos.getWallUploadServer failed');
  if (httpStatus !== null) console.error('[VK DEBUG] HTTP status:', httpStatus);
  console.error('[VK DEBUG] transport error:', safeMessage);
  return {ok: false, method: METHOD, transport_error: {http_status: httpStatus, message: safeMessage}};
}

export async function testVKAuthToken(accessToken: string, groupId: number): Promise<VKAuthDebugResult> {
  console.log('[VK DEBUG] photos.getWallUploadServer started');
  const body = new URLSearchParams({
    group_id: String(groupId),
    access_token: accessToken,
    v: VK_API_VERSION
  });

  let response: Response;
  try {
    response = await fetch(VK_API + METHOD, {method: 'POST', body});
  } catch (error) {
    return transportError(accessToken, null, error instanceof Error ? error.message : 'VK request failed');
  }

  let payload: {response?: {upload_url?: unknown; album_id?: unknown; user_id?: unknown}; error?: VKErrorPayload};
  try {
    payload = await response.json();
  } catch {
    return transportError(accessToken, response.status, 'VK returned a non-JSON response');
  }

  if (payload.error) {
    const error = {
      error_code: typeof payload.error.error_code === 'number' ? payload.error.error_code : null,
      error_msg: redact(payload.error.error_msg ?? 'Unknown VK API error', accessToken)
    };
    console.error('[VK DEBUG] photos.getWallUploadServer failed');
    console.error('[VK DEBUG] error_code:', error.error_code ?? 'unknown');
    console.error('[VK DEBUG] error_msg:', error.error_msg);
    return {ok: false, method: METHOD, vk_error: error};
  }

  if (!response.ok || !payload.response) {
    return transportError(accessToken, response.status, 'VK returned a response without response or error');
  }

  const result = {
    upload_url_present: typeof payload.response.upload_url === 'string' && payload.response.upload_url.length > 0,
    album_id: payload.response.album_id ?? null,
    user_id: payload.response.user_id ?? null
  };
  console.log('[VK DEBUG] photos.getWallUploadServer OK');
  return {ok: true, method: METHOD, result};
}
