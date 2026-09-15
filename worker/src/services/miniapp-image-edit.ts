import { AppError, type Env } from "../types";
import { requireTelegramMiniAppSession } from "./telegram-miniapp-auth";

const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_INSTRUCTION_LENGTH = 2000;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const EDIT_PROMPT = `Отредактируй существующее изображение в соответствии с инструкцией пользователя.
Сохраняй композицию, стиль и все элементы, которые пользователь не просил менять. В первую очередь вноси только явно запрошенные изменения.
Сохраняй профессиональную косметологическую эстетику. Не добавляй текст, надписи, логотипы или водяные знаки без явного запроса.
Не добавляй неподтверждённые медицинские результаты. Верни само отредактированное изображение, а не его описание.`;

function decodeBase64(value: string) {
  const binary = atob(value),
    bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function editMiniAppImage(request: Request, env: Env) {
  await requireTelegramMiniAppSession(request, env);
  if (
    !(request.headers.get("content-type") || "")
      .toLowerCase()
      .startsWith("multipart/form-data")
  )
    throw new AppError(
      "INVALID_CONTENT_TYPE",
      "Ожидается multipart/form-data",
      415,
    );
  const form = await request.formData().catch(() => {
    throw new AppError(
      "INVALID_FORM_DATA",
      "Не удалось прочитать изображение",
      400,
    );
  });
  const image = form.get("image"),
    rawInstruction = form.get("instruction");
  const instruction =
    typeof rawInstruction === "string" ? rawInstruction.trim() : "";
  if (!(image instanceof File) || !image.size)
    throw new AppError(
      "AI_IMAGE_REQUIRED",
      "Выберите изображение для редактирования",
      400,
    );
  if (!ALLOWED_IMAGE_TYPES.has(image.type))
    throw new AppError(
      "INVALID_IMAGE_TYPE",
      "Поддерживаются JPEG, PNG и WebP",
      400,
    );
  if (image.size > MAX_IMAGE_BYTES)
    throw new AppError(
      "IMAGE_TOO_LARGE",
      "Изображение должно быть не больше 10 МБ",
      400,
    );
  if (!instruction)
    throw new AppError(
      "AI_IMAGE_INSTRUCTION_REQUIRED",
      "Введите пожелания для редактирования изображения",
      400,
    );
  if (instruction.length > MAX_INSTRUCTION_LENGTH)
    throw new AppError(
      "AI_IMAGE_INSTRUCTION_TOO_LONG",
      `Пожелания не должны превышать ${MAX_INSTRUCTION_LENGTH} символов`,
      400,
    );
  if (!env.OPENAI_API_KEY)
    throw new AppError("AI_NOT_CONFIGURED", "AI пока не настроен", 503);

  const providerForm = new FormData();
  providerForm.set("model", env.AI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL);
  providerForm.set("image", image, image.name || "image.png");
  providerForm.set(
    "prompt",
    `${EDIT_PROMPT}\n\nИНСТРУКЦИЯ ПОЛЬЗОВАТЕЛЯ:\n${instruction}`,
  );
  providerForm.set("quality", "medium");
  providerForm.set("output_format", "png");
  providerForm.set("n", "1");
  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: providerForm,
    signal: request.signal,
  });
  const result = (await response.json().catch(() => null)) as any;
  if (!response.ok) {
    console.error("Mini App image edit failed", {
      model: providerForm.get("model"),
      status: response.status,
      error: result?.error,
    });
    throw new AppError(
      "AI_IMAGE_EDIT_FAILED",
      "Не удалось применить изменения. Попробуйте ещё раз.",
      502,
    );
  }
  const data = result?.data?.[0]?.b64_json;
  if (typeof data !== "string" || !data)
    throw new AppError(
      "AI_IMAGE_EDIT_EMPTY",
      "OpenAI не вернул изображение. Попробуйте ещё раз.",
      502,
    );
  return new Response(decodeBase64(data), {
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store",
      "content-disposition": 'inline; filename="edited-image.png"',
    },
  });
}
