buttonEl.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();

  if (!artifact || !currentToken || published) return;

  buttonEl.disabled = true;
  statusEl.textContent = "Тестируем wall.post через Yandex Function…";

  try {
    log("Server wall.post: requesting wall permission", {
      groupId: artifact.vkGroupId,
      attachments: false
    });

    let wallAuth;
    try {
      wallAuth = await bridge("VKWebAppGetAuthToken", {
        app_id: VK_APP_ID,
        scope: "wall"
      });
    } catch (error) {
      throw new Error(vkError("VKWebAppGetAuthToken (wall)", error));
    }

    if (!wallAuth?.access_token) {
      throw new Error("VK не предоставил access_token с правом wall");
    }

    log("→ Yandex Function wall.post", {
      groupId: artifact.vkGroupId,
      attachments: false
    });

    const serverResponse = await fetch(`/api/artifacts/${encodeURIComponent(currentToken)}/vk-wall-post`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessToken: wallAuth.access_token }),
      cache: "no-store"
    });
    const raw = await serverResponse.text();
    let result = null;
    try { result = raw ? JSON.parse(raw) : null; } catch {}
    log("← Yandex Function wall.post", { status: serverResponse.status, body: result || raw });

    if (!serverResponse.ok) {
      throw new Error(result?.error?.message || `Yandex Function HTTP ${serverResponse.status}`);
    }
    if (!result?.ok) {
      const code = result?.vkError?.error_code ?? "?";
      const message = result?.vkError?.error_msg || "VK API rejected wall.post";
      throw new Error(`VK API server-side: ${code} ${message}`);
    }

    const postId = result?.response?.post_id;
    if (!postId) throw new Error("Server-side wall.post не вернул post_id");

    published = true;
    buttonEl.disabled = true;
    buttonEl.textContent = "Опубликовано";
    statusEl.textContent = "Текстовая публикация размещена через Yandex Function";
    log("SERVER WALL POST SUCCESS", {
      groupId: artifact.vkGroupId,
      postId,
      attachments: false
    });
  } catch (error) {
    statusEl.textContent = "Серверный wall.post не прошёл. Смотрите диагностику.";
    log("SERVER WALL POST ERROR", {
      message: error instanceof Error ? error.message : String(error)
    });
    diagnosticsEl.open = true;
  } finally {
    if (!published) buttonEl.disabled = false;
  }
}, true);
