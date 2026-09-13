import { AppError, type Env } from '../types';
import { requireTelegramMiniAppSession } from './telegram-miniapp-auth';

const DEFAULT_IMAGE_MODEL = 'gpt-image-2';
const MAX_POST_LENGTH = 12000;

const ILLUSTRATION_PROMPT = `Создай выразительное художественное изображение для публикации профессионального косметологического кабинета к готовому посту ниже.

Сначала осмысли тему и главную идею публикации. Затем самостоятельно придумай визуальную концепцию, которая художественно раскрывает эту тему и при этом однозначно принадлежит миру современной косметологии, профессионального ухода за кожей и эстетической медицины.

Изображение должно сочетать две составляющие:

1. КОСМЕТОЛОГИЧЕСКИЙ КОНТЕКСТ
Визуальный язык должен быть связан с профессиональной косметологией: кожа, её структура и текстура, уход, восстановление, активные ингредиенты, косметологические процедуры, профессиональные препараты, научный подход к коже, эстетическая медицина.

Выбирай только те элементы этого мира, которые действительно соответствуют теме конкретной публикации.

2. ХУДОЖЕСТВЕННАЯ ИДЕЯ
Не ограничивайся буквальной иллюстрацией текста. Найди в теме поста интересный визуальный образ и преврати его в выразительную сцену, композицию или художественную метафору.

Используй композицию, свет, глубину, фактуры, цвет и пространство как часть рассказа.

Допускаются:
- sophisticated beauty photography;
- editorial skincare photography;
- macro photography кожи и косметических текстур;
- conceptual beauty photography;
- художественный still life;
- эстетичная интерпретация биологических процессов кожи;
- сочетание научной эстетики и beauty photography;
- cinematic и editorial композиции.

Выбирай визуальный подход самостоятельно в зависимости от смысла конкретного поста.

Изображение должно выглядеть так, будто над ним работали арт-директор и профессиональный beauty-фотограф для современного косметологического бренда или клиники.

ВАЖНО:

Не используй одну и ту же стандартную формулу "красивая женщина + баночка крема".

Не добавляй лицо человека только потому, что публикация посвящена косметологии.

Не используй автоматически цветы, полотенца, свечи, капли воды, лабораторную посуду или бежевый spa-фон.

Такие элементы допустимы только тогда, когда они являются осмысленной частью выбранной визуальной концепции.

Не пытайся буквально показать каждый термин из публикации.

Лучше одна сильная художественная идея, связанная с косметологией и смыслом поста, чем коллаж из множества очевидных символов.

Для разных публикаций ищи разные композиционные решения. Визуальный язык должен рождаться из темы конкретного поста.

ОГРАНИЧЕНИЯ:

- без текста и надписей;
- без заголовков;
- без инфографики;
- без логотипов и водяных знаков;
- без неподтверждённых медицинских результатов;
- не добавляй утверждения, которых нет в исходной публикации;
- изображение должно быть эстетичным и профессиональным;
- изображение должно хорошо работать в ленте VK и Telegram;
- создай само изображение, а не описание изображения.`;

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function generateMiniAppImage(req: Request, env: Env) {
  await requireTelegramMiniAppSession(req, env);
  const body = await req.json().catch(() => null) as { text?: unknown } | null;
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) throw new AppError('AI_IMAGE_TEXT_REQUIRED', 'Введите текст публикации', 400);
  if (text.length > MAX_POST_LENGTH) throw new AppError('AI_IMAGE_TEXT_TOO_LONG', `Текст не должен превышать ${MAX_POST_LENGTH} символов`, 400);
  if (!env.OPENAI_API_KEY) throw new AppError('AI_NOT_CONFIGURED', 'AI пока не настроен', 503);

  const model = env.AI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
  const prompt = `${ILLUSTRATION_PROMPT}\n\nГОТОВЫЙ ТЕКСТ ПУБЛИКАЦИИ:\n${text}`;
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size: '1024x1536',
      quality: 'medium',
      output_format: 'png',
      n: 1,
    }),
  });

  const result = await response.json().catch(() => null) as any;
  if (!response.ok) {
    console.error('Mini App image generation failed', { model, status: response.status, error: result?.error });
    throw new AppError('AI_IMAGE_GENERATION_FAILED', 'Не удалось сгенерировать изображение. Попробуйте ещё раз.', 502);
  }

  const data = result?.data?.[0]?.b64_json;
  if (typeof data !== 'string' || !data) throw new AppError('AI_IMAGE_EMPTY', 'OpenAI не вернул изображение. Попробуйте ещё раз.', 502);

  return new Response(decodeBase64(data), {
    status: 200,
    headers: {
      'content-type': 'image/png',
      'cache-control': 'no-store',
      'content-disposition': 'inline; filename="generated-post-image.png"',
    },
  });
}
