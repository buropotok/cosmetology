import type { Platform, PublicationResult } from '../../shared/contracts';
import { AppError, type Env } from './types';
import { validatePublish } from './validation';
import {
  detail,
  findOrCreate,
  finish,
  history,
  list,
  pending,
  publication,
} from './services/posts';
import { getOwnedImage, storeImage } from './services/images';
import { publishPlatform } from './services/publisher';
import { testVKAuthorizationCode } from './services/vk-auth-debug';
import { requireUser } from './services/auth';
import {
  activeChatId,
  createPairing,
  disconnect,
  getConnection,
  telegramWebhook,
} from './services/telegram-account';

const json = (
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });

const VK_AUTH_DEBUG_PATH = '/api/debug/vk-auth-test';
const VK_AUTH_DEBUG_ORIGIN = 'https://buropotok.github.io';

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('origin');

  const isExtension = origin === env.ALLOWED_EXTENSION_ORIGIN;

  const isDebugPage =
    new URL(req.url).pathname === VK_AUTH_DEBUG_PATH &&
    origin === VK_AUTH_DEBUG_ORIGIN;

  return origin && (isExtension || isDebugPage)
    ? {
        'access-control-allow-origin': origin,
        'access-control-allow-headers': 'authorization, content-type',
        'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
        vary: 'Origin',
      }
    : {};
}

async function route(req: Request, env: Env) {
  const u = new URL(req.url);
  const headers = cors(req, env);

  if (req.method === 'OPTIONS') {
    return Object.keys(headers).length
      ? new Response(null, { status: 204, headers })
      : new Response(null, { status: 403 });
  }

  if (
    req.method === 'POST' &&
    u.pathname === '/api/telegram/webhook'
  ) {
    return json(await telegramWebhook(req, env));
  }

  if (req.method === 'GET' && u.pathname === '/history.txt') {
    return new Response(await history(env), {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'public, max-age=60',
      },
    });
  }

  if (
    req.method === 'POST' &&
    u.pathname === VK_AUTH_DEBUG_PATH
  ) {
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      throw new AppError(
        'INVALID_JSON',
        'Некорректный JSON payload',
        400,
      );
    }

    if (!body || typeof body !== 'object') {
      throw new AppError(
        'INVALID_REQUEST',
        'JSON object обязателен',
        400,
      );
    }

    const input = body as Record<string, unknown>;

    const code =
      typeof input.code === 'string' ? input.code.trim() : '';

    const deviceId =
      typeof input.device_id === 'string'
        ? input.device_id.trim()
        : '';

    const codeVerifier =
      typeof input.code_verifier === 'string'
        ? input.code_verifier
        : '';

    const state =
      typeof input.state === 'string' ? input.state : '';

    const groupId =
      typeof input.group_id === 'number'
        ? input.group_id
        : Number(input.group_id);

    if (
      !code ||
      !deviceId ||
      !/^[A-Za-z0-9_-]{43,128}$/.test(codeVerifier) ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(state) ||
      !Number.isSafeInteger(groupId) ||
      groupId <= 0
    ) {
      throw new AppError(
        'INVALID_REQUEST',
        'Параметры запроса некорректны',
        400,
      );
    }

    const serviceToken = env.VK_ID_SERVICE_TOKEN?.trim();

    if (!serviceToken) {
      return json(
        {
          ok: false,
          stage: 'configuration',
          error: {
            code: 'missing_service_token',
            message: 'VK ID service token is not configured',
          },
        },
        500,
        headers,
      );
    }

    const result = await testVKAuthorizationCode(
      {
        code,
        deviceId,
        codeVerifier,
        state,
        groupId,
      },
      serviceToken,
    );

    return json(
      result,
      'transport_error' in result ? 502 : 200,
      headers,
    );
  }

  const user = await requireUser(req, env);

  if (
    req.method === 'POST' &&
    u.pathname === '/api/telegram/pairing'
  ) {
    return json(await createPairing(env, user), 201, headers);
  }

  if (
    req.method === 'GET' &&
    u.pathname === '/api/telegram/connection'
  ) {
    return json(await getConnection(env, user), 200, headers);
  }

  if (
    req.method === 'DELETE' &&
    u.pathname === '/api/telegram/connection'
  ) {
    return json(await disconnect(env, user), 200, headers);
  }

  if (req.method === 'GET' && u.pathname === '/api/posts') {
    return json(
      await list(env, user.id, u, u.origin),
      200,
      headers,
    );
  }

  const postMatch = u.pathname.match(/^\/api\/posts\/(\d+)$/);

  if (req.method === 'GET' && postMatch) {
    const p = await detail(
      env,
      user.id,
      Number(postMatch[1]),
      u.origin,
    );

    return p
      ? json(p, 200, headers)
      : json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'Публикация не найдена',
            },
          },
          404,
          headers,
        );
  }

  const imageMatch = u.pathname.match(/^\/api\/images\/(.+)$/);

  if (req.method === 'GET' && imageMatch) {
    const object = await getOwnedImage(
      env,
      user.id,
      decodeURIComponent(imageMatch[1]),
    );

    if (!object) {
      return new Response('Not found', {
        status: 404,
        headers,
      });
    }

    const h = new Headers(headers);

    object.writeHttpMetadata(h);
    h.set('etag', object.httpEtag);
    h.set('cache-control', 'private, max-age=86400');

    return new Response(object.body, { headers: h });
  }

  if (req.method === 'POST' && u.pathname === '/api/publish') {
    const form = await req.formData();
    const raw = form.get('payload');

    if (typeof raw !== 'string') {
      throw new AppError(
        'INVALID_REQUEST',
        'Поле payload обязательно',
        400,
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new AppError(
        'INVALID_JSON',
        'Некорректный JSON payload',
        400,
      );
    }

    const input = validatePublish(parsed);
    const file = form.get('image');

    if (file !== null && !(file instanceof File)) {
      throw new AppError(
        'INVALID_IMAGE',
        'Некорректное изображение',
        400,
      );
    }

    const telegramChatId = input.targets.includes('telegram')
      ? await activeChatId(env, user.id)
      : undefined;

    if (
      input.targets.includes('telegram') &&
      !telegramChatId
    ) {
      throw new AppError(
        'TELEGRAM_NOT_CONNECTED',
        'Telegram не подключён',
        409,
      );
    }

    const postId = await findOrCreate(
      env,
      user.id,
      input.idempotency_key,
      input.text,
      input.metadata,
    );

    if (file) {
      await storeImage(env, postId, file);
    }

    const results: Partial<
      Record<Platform, PublicationResult>
    > = {};

    for (const platform of input.targets) {
      const old = await publication(env, postId, platform);

      if (old?.status === 'published') {
        results[platform] = {
          status: 'published',
          external_id: old.external_post_id,
          url: old.external_url,
          ...(platform === 'vk' && file
            ? { image_status: 'manual_required' as const }
            : {}),
        };

        continue;
      }

      await pending(env, postId, platform);

      try {
        const result = await publishPlatform(
          env,
          platform,
          input.text,
          file ?? undefined,
          input.post_document,
          telegramChatId,
        );

        results[platform] = {
          status: 'published',
          ...result,
        };
      } catch (e) {
        console.error(
          `${platform} publication failed`,
          e instanceof AppError
            ? e.code
            : 'INTERNAL_ERROR',
        );

        results[platform] = {
          status: 'failed',
          error:
            e instanceof Error
              ? e.message
              : 'Неизвестная ошибка',
        };
      }

      await finish(
        env,
        postId,
        platform,
        results[platform]!,
      );
    }

    return json(
      {
        post_id: postId,
        publications: results,
      },
      200,
      headers,
    );
  }

  throw new AppError(
    'NOT_FOUND',
    'Маршрут не найден',
    404,
  );
}

export default {
  async fetch(req: Request, env: Env) {
    try {
      return await route(req, env);
    } catch (e) {
      const err =
        e instanceof AppError
          ? e
          : new AppError(
              'INTERNAL_ERROR',
              'Внутренняя ошибка сервера',
            );

      if (!(e instanceof AppError)) {
        console.error(e);
      }

      return json(
        {
          error: {
            code: err.code,
            message: err.message,
          },
        },
        err.status,
        cors(req, env),
      );
    }
  },
};