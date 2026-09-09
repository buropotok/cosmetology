import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import discoverySchema from '../schemas/discovery_schema.json';
import { isPostDocument, safeLink, type PostDocument } from '../../../shared/post-document';
import { parsePostMarkdown } from '../../../shared/post-markdown';
import { AppError, type Env } from '../types';
import { resolveMiniAppAiUser, setAiGenerationStatus, type AiGenerationKind } from './ai-generation-status';
import { resolveReachablePublicUrl, sanitizePostDocumentLinks } from './link-validator';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_MESSAGE_LENGTH = 12000;
const MAX_VERIFIED_SOURCES = 5;
const MAX_SOURCE_CANDIDATES = 10;

const GROUNDING_REQUIREMENTS = `Обязательно используй Google Search для проверки фактов перед ответом. Опирайся только на реальные страницы из результатов поиска. Не придумывай, не угадывай и не конструируй URL. Никогда не используй placeholder-домены, локальные адреса или тестовые ссылки. Сервер сам добавит проверенные источники в конец публикации, поэтому не создавай отдельный раздел «Источники» и не подменяй реальные URL примерами.`;

const POST_MARKDOWN_SYSTEM_PROMPT = `Ты преобразуешь уже подготовленную публикацию для косметологического кабинета в компактный PostMarkdown.

Сохраняй фактическое содержание исходной публикации. Не проводи новый поиск и не добавляй новые факты.
Готовая публикация должна содержать не более 200 слов без учёта серверного блока источников.
Верни только сам PostMarkdown: без JSON, schemaVersion, служебных пояснений и code fences.

Разрешённый формат:
- # Заголовок — heading. Используй только один уровень заголовка: #.
- Обычный текст, разделённый пустыми строками — paragraph. Пиши короткими читаемыми абзацами.
- > Текст — quote.
- - Пункт — bullet list.
- 1. Пункт — ordered list.
- Вложенный список допустим максимум на один уровень; используй тот же тип списка и отступ в два пробела.
- **текст** — bold. Выделяй только ключевые слова, выводы и важные утверждения.
- *текст* — italic.
- ~~текст~~ — strikethrough.
- ||текст|| — spoiler.
- Inline-ссылка использует обычный Markdown-формат. Разрешено использовать только точный http/https URL, уже буквально присутствующий во входной публикации. Никогда не придумывай, не достраивай и не заменяй URL. Никогда не используй placeholder-домены.

Дополнительный раскрываемый блок:
:::details Короткий заголовок
Текст, списки, цитаты или заголовок внутри блока.
:::
Не вкладывай details внутрь details.

CTA-кнопка использует двойные квадратные скобки вокруг названия и круглые скобки с точным URL из входной публикации. Создавай кнопку только если этот реальный http/https URL уже буквально присутствует во входной публикации. Не придумывай URL.
После первой кнопки разрешены только другие кнопки.

Не создавай раздел «Источники»: сервер добавит проверенные источники после форматирования.
Не используй underline в AI-разметке. Он остаётся доступен пользователю в редакторе.
Служебные пояснения интерфейса вроде «в Telegram будет кнопкой» или «в Telegram текст будет раскрываемым» не включай в публикацию: выражай их смысл самой разметкой.`;

type DiscoverySource={name:string;url:string};
type DiscoveryIdea={id:string;title:string;text:string;date?:string;source?:DiscoverySource};
type DiscoveryResponse={schemaVersion:1;ideas:DiscoveryIdea[]};
type VerifiedSource={name:string;url:string};

function serializeAiError(error: unknown): unknown {
  if (error instanceof Error) {
    const details: Record<string, unknown> = { name: error.name, message: error.message, stack: error.stack };
    for (const key of Object.getOwnPropertyNames(error)) {
      if (key === 'name' || key === 'message' || key === 'stack') continue;
      const value = (error as unknown as Record<string, unknown>)[key];
      details[key] = value instanceof Error ? serializeAiError(value) : value;
    }
    return details;
  }
  return error;
}

function parseDiscovery(text: string):DiscoveryResponse {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const value = JSON.parse(cleaned) as { schemaVersion?: unknown; ideas?: unknown };
  if (value.schemaVersion !== 1 || !Array.isArray(value.ideas) || value.ideas.length !== 5) throw new Error('Invalid discovery response');
  const ids = new Set<string>();
  value.ideas.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid discovery idea');
    const idea = raw as Record<string, unknown>;
    const expectedId = `idea_${index + 1}`;
    if (idea.id !== expectedId || ids.has(expectedId) || typeof idea.title !== 'string' || !idea.title.trim() || typeof idea.text !== 'string' || !idea.text.trim()) throw new Error('Invalid discovery idea');
    ids.add(expectedId);
    if (idea.date !== undefined && (typeof idea.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(idea.date))) throw new Error('Invalid discovery date');
    if (idea.source !== undefined) {
      if (!idea.source || typeof idea.source !== 'object') throw new Error('Invalid discovery source');
      const source = idea.source as Record<string, unknown>;
      if (typeof source.name !== 'string' || !source.name.trim() || typeof source.url !== 'string' || !source.url.trim()) throw new Error('Invalid discovery source');
    }
  });
  return value as DiscoveryResponse;
}

function sourceLabel(url:string,title:unknown):string{
  const candidate=typeof title==='string'?title.trim():'';
  if(candidate)return candidate;
  try{return new URL(url).hostname.replace(/^www\./,'')}catch{return url}
}

function groundingCandidates(rawSources:readonly unknown[]):VerifiedSource[]{
  const unique=new Map<string,VerifiedSource>();
  for(const raw of rawSources){
    if(!raw||typeof raw!=='object')continue;
    const source=raw as Record<string,unknown>;
    if(source.sourceType!=='url'||typeof source.url!=='string')continue;
    const normalized=safeLink(source.url);
    if(!normalized||unique.has(normalized))continue;
    unique.set(normalized,{name:sourceLabel(normalized,source.title),url:normalized});
    if(unique.size>=MAX_SOURCE_CANDIDATES)break;
  }
  return [...unique.values()];
}

async function validateDiscoverySources(discovery:DiscoveryResponse,rawSources:readonly unknown[],requireSource:boolean):Promise<DiscoveryResponse>{
  const grounded=new Map(groundingCandidates(rawSources).map(source=>[source.url,source]));
  const matches=discovery.ideas.map(idea=>{
    if(!idea.source){
      if(requireSource)throw new Error('Discovery returned an idea without a source');
      return {idea,source:null};
    }
    const normalized=safeLink(idea.source.url);
    const source=normalized?grounded.get(normalized):undefined;
    if(!source)throw new Error('Discovery source was not returned by Google Search');
    return {idea,source};
  });
  const used=[...new Set(matches.flatMap(match=>match.source?[match.source.url]:[]))];
  const resolved=new Map<string,string>();
  await Promise.all(used.map(async url=>{const finalUrl=await resolveReachablePublicUrl(url);if(finalUrl)resolved.set(url,finalUrl)}));
  if(used.some(url=>!resolved.has(url)))throw new Error('Discovery returned an unreachable source');
  const ideas=matches.map(match=>match.source?{...match.idea,source:{name:match.source.name,url:resolved.get(match.source.url)!}}:match.idea);
  return {...discovery,ideas};
}

async function verifiedGroundingSources(rawSources:readonly unknown[]):Promise<VerifiedSource[]>{
  const checked=await Promise.all(groundingCandidates(rawSources).map(async source=>({source,url:await resolveReachablePublicUrl(source.url)})));
  const unique=new Map<string,VerifiedSource>();
  for(const item of checked){
    if(!item.url||unique.has(item.url))continue;
    unique.set(item.url,{name:item.source.name,url:item.url});
    if(unique.size>=MAX_VERIFIED_SOURCES)break;
  }
  return [...unique.values()];
}

function appendVerifiedSources(document:PostDocument,sources:VerifiedSource[]):PostDocument{
  return {
    ...document,
    blocks:[
      ...document.blocks,
      {type:'heading',content:[{text:'Источники'}]},
      {type:'bullet_list',items:sources.map(source=>[{text:source.name,marks:[{type:'link',href:source.url}]}])},
    ],
  };
}

function generationKind(message: string): AiGenerationKind {
  return /актуальн(?:ые|ых) новост|\bновост(?:и|ей)\b/i.test(message) ? 'news' : 'general';
}

export async function generateMiniAppAiReply(req: Request, env: Env) {
  const { userId } = await resolveMiniAppAiUser(req, env);
  const body = await req.json().catch(() => null) as { message?: unknown; mode?: unknown } | null;
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const mode = body?.mode === 'discovery' ? 'discovery' : 'text';
  if (!message) throw new AppError('AI_MESSAGE_REQUIRED', 'Введите сообщение для AI', 400);
  if (message.length > MAX_MESSAGE_LENGTH) throw new AppError('AI_MESSAGE_TOO_LONG', `Сообщение не должно превышать ${MAX_MESSAGE_LENGTH} символов`, 400);
  if (!env.GEMINI_API_KEY) throw new AppError('AI_NOT_CONFIGURED', 'AI пока не настроен', 503);

  const kind = generationKind(message);
  await setAiGenerationStatus(env, userId, kind, 'queued');
  const model = env.AI_TEXT_MODEL?.trim() || DEFAULT_MODEL;
  const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
  const prompt = mode === 'discovery'
    ? `${message}\n\n${GROUNDING_REQUIREMENTS}\nДля каждого варианта source.url должен быть точным реальным URL страницы, найденной Google Search. Не используй придуманные или примерные URL.\n\nВерни только JSON, строго соответствующий этой JSON Schema. Не используй Markdown или code fences. id вариантов должны идти строго idea_1 ... idea_5.\n\n${JSON.stringify(discoverySchema)}`
    : `${message}\n\n${GROUNDING_REQUIREMENTS}`;

  try {
    await setAiGenerationStatus(env, userId, kind, 'running');
    if (mode === 'discovery') {
      const result = await generateText({
        model: google(model),
        tools: { google_search: google.tools.googleSearch({}) },
        prompt,
      });
      const text = result.text.trim();
      if (!text) throw new Error('Gemini returned an empty response');
      const discovery=await validateDiscoverySources(parseDiscovery(text),result.sources,kind==='news');
      await setAiGenerationStatus(env, userId, kind, 'succeeded');
      return { discovery };
    }

    const grounded = await generateText({
      model: google(model),
      tools: { google_search: google.tools.googleSearch({}) },
      prompt,
    });
    const groundedText = grounded.text.trim();
    if (!groundedText) throw new Error('Gemini returned an empty grounded response');
    const sources=await verifiedGroundingSources(grounded.sources);
    if(!sources.length)throw new Error('Gemini returned no reachable grounding sources');

    const formatted = await generateText({
      model: google(model),
      system: POST_MARKDOWN_SYSTEM_PROMPT,
      prompt: `Преобразуй следующую готовую публикацию в PostMarkdown, сохранив её содержание и сократив при необходимости до 200 слов максимум. Не добавляй раздел источников — он будет добавлен сервером после проверки ссылок.\n\n${groundedText}`,
    });
    const markdown = formatted.text.trim();
    if (!markdown) throw new Error('Gemini returned an empty PostMarkdown response');
    const parsed = parsePostMarkdown(markdown);
    if (!isPostDocument(parsed)) throw new Error('Gemini returned invalid PostMarkdown');
    const sanitized=await sanitizePostDocumentLinks(parsed);
    const document=appendVerifiedSources(sanitized,sources);
    if (!isPostDocument(document)) throw new Error('Server produced invalid sourced PostDocument');
    await setAiGenerationStatus(env, userId, kind, 'succeeded');
    return { text: JSON.stringify(document, null, 2) };
  } catch (error) {
    await setAiGenerationStatus(env, userId, kind, 'failed', 'AI_GENERATION_FAILED').catch(statusError => console.error('Failed to persist AI generation failure', statusError));
    console.error('Mini App AI generation failed', { provider: 'google', model, mode, error: serializeAiError(error) });
    throw new AppError('AI_GENERATION_FAILED', 'Не удалось получить ответ AI. Попробуйте ещё раз.', 502);
  }
}
