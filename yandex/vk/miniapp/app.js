const VK_APP_ID = 54742217;
const statusEl = document.getElementById("status");
const artifactEl = document.getElementById("artifact");
const textEl = document.getElementById("post-text");
const imagesEl = document.getElementById("images");
const buttonEl = document.getElementById("post");
const diagnosticsEl = document.getElementById("diagnostics");
const diagnosticLogEl = document.getElementById("diagnostic-log");

let artifact = null;
let logs = [];
const started = performance.now();

function elapsed() {
  return ((performance.now() - started) / 1000).toFixed(2) + "s";
}

function log(label, data) {
  const line = `[${elapsed()}] ${label}${data === undefined ? "" : " | " + JSON.stringify(data)}`;
  logs.push(line);
  if (logs.length > 100) logs.shift();
  diagnosticLogEl.textContent = logs.join("\n") || "Лог пока пуст.";
  diagnosticLogEl.scrollTop = diagnosticLogEl.scrollHeight;
  console.log(label, data ?? "");
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

async function initVkBridge() {
  if (!window.vkBridge) {
    log("VK Bridge недоступен; продолжаем browser PoC");
    return false;
  }
  try {
    log("→ VKWebAppInit");
    const result = await vkBridge.send("VKWebAppInit");
    log("← VKWebAppInit", result);
    return true;
  } catch (error) {
    log("VKWebAppInit ERROR", { message: error?.message || String(error) });
    return false;
  }
}

async function fetchArtifact(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const raw = await response.text();
  log(`← GET ${url}`, { status: response.status, body: raw.slice(0, 1200) });
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch {}
  return { response, body, raw };
}

async function loadArtifact() {
  const token = handoffToken();
  const endpoint = token ? `/api/artifacts/${encodeURIComponent(token)}` : "/api/test-artifact";
  log(`→ GET ${endpoint}`, { mode: token ? "replicated-artifact" : "test-artifact" });

  let result = await fetchArtifact(endpoint);
  if (token && result.response.status === 409 && result.body?.error?.code === "ARTIFACT_NOT_READY") {
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
  buttonEl.disabled = false;
  buttonEl.textContent = token ? "Публикация готова" : "Yandex-контур готов";
  statusEl.textContent = token
    ? "Публикация загружена из российского контура"
    : "Публикация и изображения загружены из Yandex Cloud";
  log("Yandex artifact ready", {
    artifactId: artifact.artifactId,
    version: artifact.version || 1,
    status: artifact.status || "ready",
    vkGroupId: artifact.vkGroupId || null,
    textLength: (artifact.text || "").length,
    imageCount: (artifact.images || []).length,
  });
}

buttonEl.addEventListener("click", () => {
  diagnosticsEl.open = !diagnosticsEl.open;
});

async function init() {
  try {
    log("Mini App init", { href: location.href, appId: VK_APP_ID, hasHandoff: Boolean(handoffToken()) });
    await initVkBridge();
    await loadArtifact();
  } catch (error) {
    statusEl.textContent = "Не удалось подготовить публикацию";
    log("INIT ERROR", { message: error?.message || String(error) });
    diagnosticsEl.open = true;
  }
}

init();
