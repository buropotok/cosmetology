import { type Env } from '../types';
import { validateTelegramMiniAppInitData } from './telegram-miniapp-auth';

export type D1DiagnosticResult =
  | { ok: true; stages: string[]; createdAt: string | null }
  | { ok: false; stage: string; error: string };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function runD1Diagnostic(req: Request, env: Env): Promise<D1DiagnosticResult> {
  const initData = req.headers.get('authorization')?.match(/^tma\s+(.+)$/i)?.[1] ?? '';
  await validateTelegramMiniAppInitData(initData, env.TELEGRAM_BOT_TOKEN);

  const stages: string[] = [];
  let stage = 'select';
  try {
    await env.DB.prepare('SELECT 1 AS test').first();
    stages.push(stage);

    stage = 'create';
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS __d1_healthcheck (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL)').run();
    stages.push(stage);

    stage = 'insert';
    await env.DB.prepare("INSERT INTO __d1_healthcheck (id, created_at) VALUES (1, datetime('now')) ON CONFLICT(id) DO UPDATE SET created_at=excluded.created_at").run();
    stages.push(stage);

    stage = 'readback';
    const row = await env.DB.prepare('SELECT created_at FROM __d1_healthcheck WHERE id=1').first<{ created_at: string }>();
    stages.push(stage);

    stage = 'cleanup';
    await env.DB.prepare('DELETE FROM __d1_healthcheck WHERE id=1').run();
    stages.push(stage);

    return { ok: true, stages, createdAt: row?.created_at ?? null };
  } catch (error) {
    return { ok: false, stage, error: errorMessage(error) };
  }
}
