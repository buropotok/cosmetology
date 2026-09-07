import { type Env } from '../types';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';
import { resolveOrCreateTelegramIdentity } from './telegram-identity';

export type AiGenerationKind = 'general' | 'news';
export type AiGenerationState = 'queued' | 'running' | 'succeeded' | 'failed';

function initDataFrom(request: Request) {
  return request.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? '';
}

export async function resolveMiniAppAiUser(request: Request, env: Env) {
  const validated = await validateTelegramMiniAppInitData(initDataFrom(request), env.TELEGRAM_BOT_TOKEN);
  const account = await resolveOrCreateTelegramIdentity(env, String(validated.user.id));
  return { validated, userId: account.userId };
}

export async function setAiGenerationStatus(env: Env, userId: string, kind: AiGenerationKind, status: AiGenerationState, errorCode: string | null = null) {
  const starting = status === 'queued';
  const finished = status === 'succeeded' || status === 'failed';
  await env.DB.prepare(`
    INSERT INTO miniapp_ai_generation_status(user_id,kind,status,started_at,finished_at,error_code,updated_at)
    VALUES(?,?,?,CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END,CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END,?,CURRENT_TIMESTAMP)
    ON CONFLICT(user_id,kind) DO UPDATE SET
      status=excluded.status,
      started_at=CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE miniapp_ai_generation_status.started_at END,
      finished_at=CASE WHEN ? THEN CURRENT_TIMESTAMP WHEN ? THEN NULL ELSE miniapp_ai_generation_status.finished_at END,
      error_code=excluded.error_code,
      updated_at=CURRENT_TIMESTAMP
  `).bind(userId,kind,status,starting?1:0,finished?1:0,errorCode,starting?1:0,finished?1:0,starting?1:0).run();
}

export async function getMiniAppNewsGenerationStatus(request: Request, env: Env) {
  const { userId } = await resolveMiniAppAiUser(request, env);
  const row = await env.DB.prepare(`SELECT kind,status,started_at AS startedAt,finished_at AS finishedAt,error_code AS errorCode,updated_at AS updatedAt FROM miniapp_ai_generation_status WHERE user_id=? AND kind='news'`).bind(userId).first<{kind:AiGenerationKind;status:AiGenerationState;startedAt:string|null;finishedAt:string|null;errorCode:string|null;updatedAt:string}>();
  return row ?? { kind: 'news', status: 'idle', startedAt: null, finishedAt: null, errorCode: null, updatedAt: null };
}
