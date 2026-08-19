const VK_ID_TOKEN_ENDPOINT = 'https://id.vk.ru/oauth2/auth';
const VK_API = 'https://api.vk.com/method/';
const VK_API_VERSION = '5.199';
const METHOD = 'photos.getWallUploadServer';
const CLIENT_ID = '54726533';
const REDIRECT_URI = 'https://buropotok.github.io/cosmetology/auth/';

interface BackendAuthorizationInput {
  code: string;
  deviceId: string;
  codeVerifier: string;
  state: string;
  groupId: number;
}

interface VKErrorPayload {
  error_code?: number;
  error_msg?: string;
}

export type VKAuthDebugResult =
  | {ok: true; exchange: 'backend'; method: typeof METHOD; result: {upload_url_present: boolean; album_id: unknown; user_id: unknown}}
  | {ok: false; stage: 'token_exchange'; error: {code: string; message: string}}
  | {ok: false; stage: 'vk_api'; method: typeof METHOD; vk_error: {error_code: number | null; error_msg: string}}
  | {ok: false; stage: 'vk_api'; method: typeof METHOD; transport_error: {http_status: number | null; message: string}};

function redact(value: string, secrets: string[]) {
  let safe = value;
  for (const secret of secrets) {
    if (secret) safe = safe.split(secret).join('[REDACTED]');
  }
  return safe
    .replace(/([?&](?:access_token|refresh_token|id_token|code|code_verifier)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(authorization\s*[:=]\s*)([^,;\s]+)/gi, '$1[REDACTED]');
}

function exchangeError(code: string, message: string, secrets: string[]): VKAuthDebugResult {
  const safeError = {code: redact(code, secrets), message: redact(message, secrets)};
  console.error('[VK DEBUG] token exchange failed');
  console.error('[VK DEBUG] error:', safeError);
  return {ok: false, stage: 'token_exchange', error: safeError};
}

async function exchangeAuthorizationCode(input: BackendAuthorizationInput) {
  const secrets = [input.code, input.codeVerifier];
  console.log('[VK DEBUG] token exchange started');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code_verifier: input.codeVerifier,
    redirect_uri: REDIRECT_URI,
    code: input.code,
    client_id: CLIENT_ID,
    device_id: input.deviceId,
    state: input.state
  });

  let response: Response;
  try {
    response = await fetch(VK_ID_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      body
    });
  } catch (error) {
    return exchangeError('transport_error', error instanceof Error ? error.message : 'VK ID token request failed', secrets);
  }

  let payload: {access_token?: unknown; refresh_token?: unknown; id_token?: unknown; state?: unknown; error?: unknown; error_description?: unknown};
  try {
    payload = await response.json();
  } catch {
    return exchangeError('invalid_response', `VK ID returned a non-JSON response (HTTP ${response.status})`, secrets);
  }

  if (!response.ok || typeof payload.error === 'string') {
    return exchangeError(
      typeof payload.error === 'string' ? payload.error : 'http_error',
      typeof payload.error_description === 'string' ? payload.error_description : `VK ID token request failed (HTTP ${response.status})`,
      secrets
    );
  }
  if (payload.state !== input.state) return exchangeError('state_mismatch', 'VK ID returned an unexpected state', secrets);
  if (typeof payload.access_token !== 'string' || !payload.access_token) {
    return exchangeError('invalid_response', 'VK ID response does not contain access_token', secrets);
  }

  console.log('[VK DEBUG] token exchange OK');
  return {accessToken: payload.access_token};
}

async function requestWallUploadServer(accessToken: string, groupId: number): Promise<VKAuthDebugResult> {
  console.log('[VK DEBUG] photos.getWallUploadServer started');
  const body = new URLSearchParams({group_id: String(groupId), access_token: accessToken, v: VK_API_VERSION});

  let response: Response;
  try {
    response = await fetch(VK_API + METHOD, {method: 'POST', body});
  } catch (error) {
    const message = redact(error instanceof Error ? error.message : 'VK request failed', [accessToken]);
    console.error('[VK DEBUG] photos.getWallUploadServer failed');
    console.error('[VK DEBUG] transport error:', message);
    return {ok: false, stage: 'vk_api', method: METHOD, transport_error: {http_status: null, message}};
  }

  let payload: {response?: {upload_url?: unknown; album_id?: unknown; user_id?: unknown}; error?: VKErrorPayload};
  try {
    payload = await response.json();
  } catch {
    const message = 'VK returned a non-JSON response';
    console.error('[VK DEBUG] photos.getWallUploadServer failed');
    console.error('[VK DEBUG] HTTP status:', response.status);
    return {ok: false, stage: 'vk_api', method: METHOD, transport_error: {http_status: response.status, message}};
  }

  if (payload.error) {
    const error = {
      error_code: typeof payload.error.error_code === 'number' ? payload.error.error_code : null,
      error_msg: redact(payload.error.error_msg ?? 'Unknown VK API error', [accessToken])
    };
    console.error('[VK DEBUG] photos.getWallUploadServer failed');
    console.error('[VK DEBUG] error_code:', error.error_code ?? 'unknown');
    console.error('[VK DEBUG] error_msg:', error.error_msg);
    return {ok: false, stage: 'vk_api', method: METHOD, vk_error: error};
  }
  if (!response.ok || !payload.response) {
    const message = 'VK returned a response without response or error';
    console.error('[VK DEBUG] photos.getWallUploadServer failed');
    console.error('[VK DEBUG] HTTP status:', response.status);
    return {ok: false, stage: 'vk_api', method: METHOD, transport_error: {http_status: response.status, message}};
  }

  console.log('[VK DEBUG] photos.getWallUploadServer OK');
  return {
    ok: true,
    exchange: 'backend',
    method: METHOD,
    result: {
      upload_url_present: typeof payload.response.upload_url === 'string' && payload.response.upload_url.length > 0,
      album_id: payload.response.album_id ?? null,
      user_id: payload.response.user_id ?? null
    }
  };
}

export async function testVKAuthorizationCode(input: BackendAuthorizationInput): Promise<VKAuthDebugResult> {
  console.log('[VK DEBUG] backend authorization code received');
  const exchange = await exchangeAuthorizationCode(input);
  if ('ok' in exchange) return exchange;
  return requestWallUploadServer(exchange.accessToken, input.groupId);
}
