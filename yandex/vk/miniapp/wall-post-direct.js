buttonEl.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();

  if (!artifact || !currentToken || published) return;

  buttonEl.disabled = true;
  statusEl.textContent = "Проверяем получение токена сообщества…";

  try {
    const groupId = Number(artifact.vkGroupId);
    log("Community token test", { groupId });

    if (typeof vkBridge.supports === "function") {
      log("Community token Bridge support", {
        getCommunityToken: vkBridge.supports("VKWebAppGetCommunityToken"),
        getCommunityAuthToken: vkBridge.supports("VKWebAppGetCommunityAuthToken")
      });
    }

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
    if (!accessToken) {
      log("COMMUNITY TOKEN RESPONSE WITHOUT TOKEN", { method, response: communityAuth });
      throw new Error(`${method} ответил, но не вернул access_token`);
    }

    log("COMMUNITY TOKEN SUCCESS", {
      method,
      groupId,
      scope: communityAuth?.scope || null,
      expires: communityAuth?.expires || null,
      tokenReceived: true
    });

    statusEl.textContent = "Токен сообщества получен внутри Mini App. Смотрите диагностику.";
    buttonEl.textContent = "Токен сообщества получен";
    diagnosticsEl.open = true;
  } catch (error) {
    statusEl.textContent = "Токен сообщества получить не удалось. Смотрите диагностику.";
    log("COMMUNITY TOKEN ERROR", {
      message: error instanceof Error ? error.message : String(error)
    });
    diagnosticsEl.open = true;
  } finally {
    buttonEl.disabled = false;
  }
}, true);
