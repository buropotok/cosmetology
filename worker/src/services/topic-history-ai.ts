import type { Env } from '../types';
import { resolveMiniAppAiUser } from './ai-generation-status';
import { generateMiniAppAiReply } from './miniapp-ai';
import { appendSelectedTopic, parseSelectedIdea, topicHistoryUrl } from './topic-history';

export async function generateMiniAppAiReplyWithHistory(req: Request, env: Env) {
  const body = await req.clone().json().catch(() => null) as { message?: unknown; mode?: unknown; selectedIdea?: unknown } | null;
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const mode = body?.mode === 'discovery' ? 'discovery' : 'text';
  if (!message) return generateMiniAppAiReply(req, env);
  const { userId } = await resolveMiniAppAiUser(req, env);
  const selectedIdea = parseSelectedIdea(body?.selectedIdea);
  if (mode === 'text' && selectedIdea) await appendSelectedTopic(env, userId, selectedIdea);
  if (mode !== 'discovery') return generateMiniAppAiReply(req, env);
  const historyUrl = topicHistoryUrl(new URL(req.url).origin, userId);
  const instruction = `Перед подбором тем обязательно открой историю ранее выбранных тем этого пользователя: ${historyUrl}\nНе предлагай темы, которые полностью или по смыслу повторяют уже выбранные темы или их основной ракурс.`;
  const nextRequest = new Request(req, { body: JSON.stringify({ ...body, message: `${message}\n\n${instruction}` }) });
  return generateMiniAppAiReply(nextRequest, env);
}
