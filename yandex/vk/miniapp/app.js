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

async function loadArtifact() {
  log("→ GET /api/test-artifact");
  const response = await fetch("/api/test-artifact", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const raw = await response.text();
  log("← GET /api/test-artifact", { status: response.status, body: raw });
  if (!response.ok) throw new Error(`Artifact API returned ${response.status}`);
  artifact = JSON.parse(raw);

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
  buttonEl.textContent = "Yandex-контур готов";
  statusEl.textContent = "Публикация и изображения загружены из Yandex Cloud";
  log("Yandex artifact ready", {
    artifactId: artifact.artifactId,
    textLength: (artifact.text || "").length,
    imageCount: (artifact.images || []).length,
  });
}

buttonEl.addEventListener("click", () => {
  diagnosticsEl.open = !diagnosticsEl.open;
});

async function init() {
  try {
    log("Mini App init", { href: location.href, appId: VK_APP_ID });
    await initVkBridge();
    await loadArtifact();
  } catch (error) {
    statusEl.textContent = "Не удалось подготовить публикацию";
    log("INIT ERROR", { message: error?.message || String(error) });
    diagnosticsEl.open = true;
  }
}

init();
