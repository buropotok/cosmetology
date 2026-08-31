const VK_APP_ID = 54742217;
const VK_API_VERSION = "5.199";
const statusEl = document.getElementById("status");
const artifactEl = document.getElementById("artifact");
const textEl = document.getElementById("post-text");
const imagesEl = document.getElementById("images");
const buttonEl = document.getElementById("post");
const diagnosticsEl = document.getElementById("diagnostics");
const diagnosticLogEl = document.getElementById("diagnostic-log");

let artifact = null;
let currentToken = "";
let logs = [];
let published = false;
let returningFromGroup = false;
const started = performance.now();

function elapsed() {
  return ((performance.now() - started) / 1000).toFixed(2) + "s";
}

function clean(value) {
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.length > 1200) return value.slice(0, 1200) + "…";
    return value.replace(/access_token=[^&\s]+/gi, "access_token=***");
  }
  if (Array.isArray(value)) return value.map(clean);
  if (typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (/token/i.test(key)) out[key] = "***";
      else if (key === "upload_url" || key === "uploadUrl") {
        try {
          const url = new URL(String(item));
          out[key] = url.origin + url.pathname;
        } catch {
          out[key] = String(item);
        }
      } else out[key] = clean(item);
    }
    return out;
  }
  return value;
}

function log(label, data) {
  const line = `[${elapsed()}] ${label}${data === undefined ? "" : " | " + JSON.stringify(clean(data))}`;
  logs.push(line);
  if (logs.length > 100) logs.shift();
  diagnosticLogEl.textContent = logs.join("\n") || "Лог пока пуст.";
  diagnosticLogEl.scrollTop = diagnosticLogEl.scrollHeight;
  console.log(label, clean(data ?? ""));
}

function handoffToken() {
  const query = new URLSearchParams(location.search).get("handoff");
  if (query) return query;
  const hash = new URLSearchParams(location.hash.replace(/^#/, "")).get("handoff");
  if (hash) return hash;
  const launch = new URLSearchParams(location.search).get("vk_ref") || "";
  const match = launch.match(/(?:^|[?&#])handoff=([A-Za-z0-9_-]+)/);
  return match ? match[1] : "";
}

function vkError(stage, error) {
  const data = error && typeof error === "object" ? error : {};
  const nested = data.error_data && typeof data.error_data === "object" ? data.error_data : {};
  const api = nested.api_error && typeof nested.api_error === "object" ? nested.api_error : {};
  const code = api.error_code || nested.error_code || data.error_code || "";
  const message = api.error_msg || nested.error_reason || nested.error_msg || data.message || (error instanceof Error ? error.message : "") || data.error_type || "Неизвестная ошибка";
  const parts = [`Этап: ${stage}`];
  if (data.error_type) parts.push(`Тип: ${data.error_type}`);
  if (code !== "") parts.push(`Код: ${code}`);
  parts.push(`Сообщение: ${message}`);
  return parts.join("\n");
}

async function bridge(name, payload) {
  log(`→ Bridge ${name}`, payload);
  try {
    const result = await vkBridge.send(name, payload);
    log(`← Bridge ${name}`, result);
    return result;
  } catch (error) {
    log(`← Bridge ${name} ERROR`, error);
    throw error;
  }
}

async function callVkApi(method, params) {
  log(`→ VK API ${method}`, params);
  try {
    const result = await bridge("VKWebAppCallAPIMethod", {
      method,
      params: { ...params, v: VK_API_VERSION }
    });
    if (result?.response === undefined) throw new Error("VK API не вернул результат");
    return result.response;
  } catch (error) {
    throw new Error(vkError(method, error));
  }
}

async function fetchArtifact(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  const raw = await response.text();
  log(`← GET ${url}`, { status: response.status, body: raw.slice(0, 1200) });
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {}
  return { response, body, raw };
}

async function loadArtifact() {
  currentToken = handoffToken();
  const endpoint = currentToken
    ? `/api/artifacts/${encodeURIComponent(currentToken)}`
    : "/api/test-artifact";

  log(`→ GET ${endpoint}`, {
    mode: currentToken ? "replicated-artifact" : "test-artifact"
  });

  let result = await fetchArtifact(endpoint);
  if (
    currentToken &&
    result.response.status === 409 &&
    result.body?.error?.code === "ARTIFACT_NOT_READY"
  ) {
    statusEl.textContent = "Синхронизируем публикацию с Yandex Cloud…";
    for (let attempt = 1; attempt <= 15; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      log("Artifact replication wait", { attempt });
      result = await fetchArtifact(endpoint);
      if (result.response.status !== 409) break;
    }
  }

  if (!result.response.ok) {
    throw new Error(result.body?.error?.message || `Artifact API returned ${result.response.status}`);
  }

  artifact = result.body;
  textEl.textContent = artifact.text || "";
  imagesEl.replaceChildren();

  for (const imageUrl of artifact.images || []) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = "Изображение публикации";
    image.loading = "eager";
    imagesEl.appendChild(image);
  }

  artifactEl.hidden = false;
  buttonEl.disabled = !currentToken;
  buttonEl.textContent = currentToken ? "Открыть публикацию" : "Yandex-контур готов";
  statusEl.textContent = currentToken
    ? "Публикация готова к размещению"
    : "Публикация и изображения загружены из Yandex Cloud";

  log("Yandex artifact ready", {
    artifactId: artifact.artifactId,
    version: artifact.version || 1,
    status: artifact.status || "ready",
    vkGroupId: artifact.vkGroupId || null,
    textLength: (artifact.text || "").length,
    imageCount: (artifact.images || []).length
  });
}

async function uploadPhotoAttempt(auth, index, attempt, imageCount) {
  log(`Фото ${index + 1}/${imageCount}: попытка ${attempt}`);

  const server = await callVkApi("photos.getWallUploadServer", {
    access_token: auth.access_token,
    group_id: artifact.vkGroupId
  });

  if (!server?.upload_url) {
    throw new Error("photos.getWallUploadServer: нет upload_url");
  }

  let host = "";
  try {
    host = new URL(server.upload_url).hostname;
  } catch {}

  log(`Фото ${index + 1}: upload server`, {
    attempt,
    host,
    uploadUrl: server.upload_url
  });

  let response;
  let raw = "";
  log(`→ Yandex upload фото ${index + 1}`, { attempt, index, host });

  try {
    response = await fetch(`/api/artifacts/${encodeURIComponent(currentToken)}/vk-upload`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uploadUrl: server.upload_url, index })
    });
    raw = await response.text();
    log(`← Yandex upload фото ${index + 1}`, {
      attempt,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      body: raw
    });
  } catch (error) {
    log(`← Yandex upload фото ${index + 1} NETWORK ERROR`, {
      attempt,
      name: error?.name,
      message: error?.message
    });
    throw error;
  }

  let uploaded = null;
  try {
    uploaded = raw ? JSON.parse(raw) : null;
  } catch {}

  if (!response.ok) {
    const error = new Error(uploaded?.error?.message || `HTTP ${response.status}`);
    error.retryable =
      response.status >= 500 ||
      uploaded?.error?.code === "VK_IMAGE_UPLOAD_INVALID" ||
      uploaded?.error?.code === "VK_IMAGE_UPLOAD_FAILED";
    error.raw = raw;
    throw error;
  }

  if (!uploaded?.photo || uploaded?.server === undefined || !uploaded?.hash) {
    const error = new Error("неполный ответ VK upload");
    error.retryable = true;
    error.raw = raw;
    throw error;
  }

  log(`Фото ${index + 1}: upload принят`, {
    attempt,
    server: uploaded.server,
    hash: uploaded.hash
  });

  return uploaded;
}

async function preparePhotoAttachment(auth, index, imageCount) {
  let uploaded;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      uploaded = await uploadPhotoAttempt(auth, index, attempt, imageCount);
      break;
    } catch (error) {
      log(`Фото ${index + 1}: попытка ${attempt} FAILED`, {
        message: error instanceof Error ? error.message : String(error),
        retryable: error?.retryable !== false
      });

      if (attempt === 2 || error?.retryable === false) {
        throw new Error(
          `Фото ${index + 1}: upload image to VK: ${error instanceof Error ? error.message : String(error)}` +
          (error?.raw ? `; raw=${String(error.raw).slice(0, 500)}` : "")
        );
      }

      log(`Фото ${index + 1}: повторяем с новым upload server`);
    }
  }

  const saved = await callVkApi("photos.saveWallPhoto", {
    access_token: auth.access_token,
    group_id: artifact.vkGroupId,
    photo: uploaded.photo,
    server: uploaded.server,
    hash: uploaded.hash
  });

  log(`Фото ${index + 1}: photos.saveWallPhoto result`, saved);

  const photo = Array.isArray(saved) ? saved[0] : null;
  if (!photo?.owner_id || !photo?.id) {
    throw new Error(`Фото ${index + 1}: photos.saveWallPhoto не вернул фотографию`);
  }

  const attachment = `photo${photo.owner_id}_${photo.id}${photo.access_key ? `_${photo.access_key}` : ""}`;
  log(`Фото ${index + 1}: attachment готов`, { attachment });
  return attachment;
}

async function prepareNativePhotoAttachments() {
  const imageCount = (artifact.images || []).length;
  if (!imageCount) return [];

  log("Начало подготовки фото", {
    groupId: artifact.vkGroupId,
    imageCount
  });

  let auth;
  try {
    auth = await bridge("VKWebAppGetAuthToken", {
      app_id: VK_APP_ID,
      scope: "photos"
    });
  } catch (error) {
    throw new Error(vkError("VKWebAppGetAuthToken (photos)", error));
  }

  if (!auth?.access_token) {
    throw new Error("VK не предоставил access_token");
  }

  log("Auth token получен", {
    hasAccessToken: true,
    scope: auth.scope || null,
    expiresIn: auth.expires_in || auth.expires || null
  });

  if (imageCount === 1) {
    log("Single-photo fast path");
    return [await preparePhotoAttachment(auth, 0, 1)];
  }

  const attachments = new Array(imageCount);
  const concurrency = Math.min(3, imageCount);
  let nextIndex = 0;

  log("Multi-photo parallel path", { imageCount, concurrency });

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= imageCount) return;
      attachments[index] = await preparePhotoAttachment(auth, index, imageCount);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  log("Все фото подготовлены", {
    count: attachments.length,
    attachments
  });

  return attachments;
}

async function closeAfterGroupReturn() {
  if (!published || returningFromGroup) return;
  returningFromGroup = true;
  try {
    await new Promise(resolve => setTimeout(resolve, 150));
    await vkBridge.send("VKWebAppClose", { status: "success" });
  } catch (error) {
    log("VKWebAppClose ERROR", error);
  }
}

window.addEventListener("pageshow", () => {
  if (published) setTimeout(closeAfterGroupReturn, 0);
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && published) setTimeout(closeAfterGroupReturn, 0);
});

buttonEl.addEventListener("click", async () => {
  if (!artifact || !currentToken || published) return;

  buttonEl.disabled = true;
  statusEl.textContent = "Подготавливаем публикацию…";

  try {
    log("Нажата публикация", {
      groupId: artifact.vkGroupId,
      imageCount: (artifact.images || []).length
    });

    const attachments = await prepareNativePhotoAttachments();
    const params = {
      owner_id: -Number(artifact.vkGroupId),
      message: artifact.text || ""
    };

    if (attachments.length) {
      params.attachments = attachments.join(",");
    }

    log("→ VKWebAppShowWallPostBox", params);

    let result;
    try {
      result = await bridge("VKWebAppShowWallPostBox", params);
    } catch (error) {
      throw new Error(vkError("VKWebAppShowWallPostBox", error));
    }

    log("← Публикация завершена", result);

    if (!result?.post_id) {
      throw new Error("VKWebAppShowWallPostBox не вернул post_id");
    }

    published = true;
    buttonEl.disabled = true;
    buttonEl.textContent = "Опубликовано";
    statusEl.textContent = `Публикация ${result.post_id} размещена. Открываем группу…`;

    log("Публикация размещена. Открываем группу", {
      groupId: artifact.vkGroupId,
      postId: result.post_id
    });

    location.replace(`https://vk.com/club${artifact.vkGroupId}`);
  } catch (error) {
    statusEl.textContent = "Не удалось разместить публикацию. Смотрите диагностику.";
    log("PUBLISH ERROR", {
      message: error instanceof Error ? error.message : String(error)
    });
    diagnosticsEl.open = true;
  } finally {
    if (!published) buttonEl.disabled = false;
  }
});

async function init() {
  try {
    log("Mini App init", {
      href: location.href,
      appId: VK_APP_ID,
      hasHandoff: Boolean(handoffToken()),
      platform: new URLSearchParams(location.search).get("vk_platform") || null
    });

    if (!window.vkBridge) throw new Error("VK Bridge недоступен");

    await bridge("VKWebAppInit");

    log("Bridge support", {
      showWallPostBox:
        typeof vkBridge.supports === "function"
          ? vkBridge.supports("VKWebAppShowWallPostBox")
          : "supports() unavailable",
      getClientVersion:
        typeof vkBridge.supports === "function"
          ? vkBridge.supports("VKWebAppGetClientVersion")
          : "supports() unavailable"
    });

    try {
      const client = await bridge("VKWebAppGetClientVersion");
      log("VK client diagnostic", client);
    } catch (error) {
      log("VK client diagnostic unavailable", {
        message: vkError("VKWebAppGetClientVersion", error)
      });
    }

    await loadArtifact();
  } catch (error) {
    statusEl.textContent = "Не удалось подготовить публикацию";
    log("INIT ERROR", { message: error?.message || String(error) });
    diagnosticsEl.open = true;
  }
}

init();
