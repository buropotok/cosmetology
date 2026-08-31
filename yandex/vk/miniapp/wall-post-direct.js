buttonEl.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();

  if (!artifact || !currentToken || published) return;

  buttonEl.disabled = true;
  statusEl.textContent = "Тестируем публикацию токеном сообщества…";

  try {
    const groupId = Number(artifact.vkGroupId);
    log("Community server wall.post test", { groupId, attachments: false });

    let communityAuth;
    let method = "VKWebAppGetCommunityToken";
    try {
      log("→ Bridge VKWebAppGetCommunityToken", { app_id: VK_APP_ID, group_id: groupId, scope: "wall" });
      communityAuth = await vkBridge.send("VKWebAppGetCommunityToken", {
        app_id: VK_APP_ID,
        group_id: groupId,
        scope: "wall"
      });
      log("← Bridge VKWebAppGetCommunityToken", communityAuth);
    } catch (firstError) {
      log("← Bridge VKWebAppGetCommunityToken ERROR", firstError);
      method = "VKWebAppGetCommunityAuthToken";
      log("→ Bridge VKWebAppGetCommunityAuthToken", { app_id: VK_APP_ID, group_id: groupId, scope: "wall" });
      try {
        communityAuth = await vkBridge.send("VKWebAppGetCommunityAuthToken", {
          app_id: VK_APP_ID,
          group_id: groupId,
          scope: "wall"
        });
        log("← Bridge VKWebAppGetCommunityAuthToken", communityAuth);
      } catch (secondError) {
        log("← Bridge VKWebAppGetCommunityAuthToken ERROR", secondError);
        throw new Error(`${vkError("VKWebAppGetCommunityToken", firstError)}\n\n${vkError("VKWebAppGetCommunityAuthToken", secondError)}`);
      }
    }

    const accessToken = communityAuth?.access_token || communityAuth?.accessToken || "";
    if (!accessToken) throw new Error(`${method} не вернул access_token`);

    log("COMMUNITY TOKEN SUCCESS", {
      method,
      groupId,
      scope: communityAuth?.scope || null,
      expires: communityAuth?.expires || null,
      tokenReceived: true
    });

    log("→ Yandex Function wall.post COMMUNITY TOKEN", { groupId, attachments: false });
    const serverResponse = await fetch(`/api/artifacts/${encodeURIComponent(currentToken)}/vk-wall-post`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessToken }),
      cache: "no-store"
    });
    const raw = await serverResponse.text();
    let result = null;
    try { result = raw ? JSON.parse(raw) : null; } catch {}
    log("← Yandex Function wall.post COMMUNITY TOKEN", { status: serverResponse.status, body: result || raw });

    if (!serverResponse.ok) throw new Error(result?.error?.message || `Yandex Function HTTP ${serverResponse.status}`);
    if (!result?.ok) {
      const code = result?.vkError?.error_code ?? "?";
      const message = result?.vkError?.error_msg || "VK API rejected wall.post";
      throw new Error(`VK API community token: ${code} ${message}`);
    }

    const postId = result?.response?.post_id;
    if (!postId) throw new Error("Community-token wall.post не вернул post_id");

    published = true;
    buttonEl.disabled = true;
    buttonEl.textContent = "Опубликовано";
    statusEl.textContent = "Публикация размещена токеном сообщества";
    log("COMMUNITY SERVER WALL POST SUCCESS", { groupId, postId, attachments: false });
  } catch (error) {
    statusEl.textContent = "Публикация токеном сообщества не прошла. Смотрите диагностику.";
    log("COMMUNITY SERVER WALL POST ERROR", {
      message: error instanceof Error ? error.message : String(error)
    });
    diagnosticsEl.open = true;
  } finally {
    if (!published) buttonEl.disabled = false;
  }
}, true);
