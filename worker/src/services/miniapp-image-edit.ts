import { AppError, type Env } from "../types";
import { requireTelegramMiniAppSession } from "./telegram-miniapp-auth";

const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_INSTRUCTION_LENGTH = 2000;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MIN_PROVIDER_PIXELS = 655_360;
const MAX_PROVIDER_PIXELS = 8_294_400;
const MAX_PROVIDER_EDGE = 3840;

const EDIT_PROMPT = `Отредактируй существующее изображение в соответствии с инструкцией пользователя.
Сохраняй композицию, стиль и все элементы, которые пользователь не просил менять. В первую очередь вноси только явно запрошенные изменения.
Не меняй размер и соотношение сторон изображения.
Сохраняй профессиональную косметологическую эстетику. Не добавляй текст, надписи, логотипы или водяные знаки без явного запроса.
Не добавляй неподтверждённые медицинские результаты. Верни само отредактированное изображение, а не его описание.`;

function decodeBase64(value: string) {
  const binary = atob(value),
    bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function isProviderSize(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0)
    return false;
  const pixels = width * height,
    ratio = width / height;
  return (
    width % 16 === 0 &&
    height % 16 === 0 &&
    width <= MAX_PROVIDER_EDGE &&
    height <= MAX_PROVIDER_EDGE &&
    pixels >= MIN_PROVIDER_PIXELS &&
    pixels <= MAX_PROVIDER_PIXELS &&
    ratio >= 1 / 3 &&
    ratio <= 3
  );
}

function providerSize(width: number, height: number) {
  if (isProviderSize(width, height)) return `${width}x${height}`;
  const sourceRatio = width / height,
    ratio = Math.min(3, Math.max(1 / 3, sourceRatio));
  let pixels = Math.min(MAX_PROVIDER_PIXELS, Math.max(MIN_PROVIDER_PIXELS, width * height));
  let targetHeight = Math.sqrt(pixels / ratio),
    targetWidth = targetHeight * ratio;
  const edgeScale = Math.min(1, MAX_PROVIDER_EDGE / targetWidth, MAX_PROVIDER_EDGE / targetHeight);
  targetWidth *= edgeScale;
  targetHeight *= edgeScale;
  let roundedWidth = Math.max(16, Math.round(targetWidth / 16) * 16),
    roundedHeight = Math.max(16, Math.round(targetHeight / 16) * 16);

  while (roundedWidth * roundedHeight < MIN_PROVIDER_PIXELS) {
    const scale = Math.sqrt(MIN_PROVIDER_PIXELS / (roundedWidth * roundedHeight)) * 1.001;
    roundedWidth = Math.ceil((roundedWidth * scale) / 16) * 16;
    roundedHeight = Math.ceil((roundedHeight * scale) / 16) * 16;
  }
  while (
    roundedWidth > MAX_PROVIDER_EDGE ||
    roundedHeight > MAX_PROVIDER_EDGE ||
    roundedWidth * roundedHeight > MAX_PROVIDER_PIXELS
  ) {
    const scale = Math.min(
      MAX_PROVIDER_EDGE / roundedWidth,
      MAX_PROVIDER_EDGE / roundedHeight,
      Math.sqrt(MAX_PROVIDER_PIXELS / (roundedWidth * roundedHeight)),
    ) * 0.999;
    roundedWidth = Math.max(16, Math.floor((roundedWidth * scale) / 16) * 16);
    roundedHeight = Math.max(16, Math.floor((roundedHeight * scale) / 16) * 16);
  }
  return `${roundedWidth}x${roundedHeight}`;
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

  const imageTransform = env.IMAGE_TRANSFORM,
    sourceInfo = imageTransform?.info
      ? await imageTransform.info(image.stream()).catch(() => null)
      : null;

  const providerForm = new FormData();
  providerForm.set("model", env.AI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL);
  providerForm.set("image", image, image.name || "image.png");
  providerForm.set(
    "prompt",
    `${EDIT_PROMPT}\n\nИНСТРУКЦИЯ ПОЛЬЗОВАТЕЛЯ:\n${instruction}`,
  );
  if (sourceInfo?.width && sourceInfo?.height)
    providerForm.set("size", providerSize(sourceInfo.width, sourceInfo.height));
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

  const decoded = decodeBase64(data);
  if (sourceInfo?.width && sourceInfo?.height && imageTransform?.input) {
    const transformed = await imageTransform
      .input(new Blob([decoded], { type: "image/png" }).stream())
      .transform({ width: sourceInfo.width, height: sourceInfo.height, fit: "cover" })
      .output({ format: "image/png" });
    return transformed.response({
      headers: {
        "cache-control": "no-store",
        "content-disposition": 'inline; filename="edited-image.png"',
      },
    });
  }

  return new Response(decoded, {
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store",
      "content-disposition": 'inline; filename="edited-image.png"',
    },
  });
}
