buttonEl.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();

  if (!artifact || !currentToken || published) return;

  buttonEl.disabled = true;
  statusEl.textContent = "Тестируем wall.post без фотографии…";

  try {
    log("Direct wall.post: requesting wall permission", {
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

    const params = {
      access_token: wallAuth.access_token,
      owner_id: -artifact.vkGroupId,
      from_group: 1,
      message: artifact.text || ""
    };

    log("→ VK API wall.post DIRECT NO ATTACHMENTS", {
      owner_id: params.owner_id,
      from_group: params.from_group,
      message: params.message
    });

    const result = await callVkApi("wall.post", params);
    log("← VK API wall.post DIRECT NO ATTACHMENTS", result);

    if (!result?.post_id) {
      throw new Error("wall.post не вернул post_id");
    }

    published = true;
    buttonEl.disabled = true;
    buttonEl.textContent = "Опубликовано";
    statusEl.textContent = "Текстовая публикация размещена через VK API";
    log("DIRECT WALL POST SUCCESS", {
      groupId: artifact.vkGroupId,
      postId: result.post_id,
      attachments: false
    });
  } catch (error) {
    statusEl.textContent = "Не удалось разместить публикацию через VK API.";
    log("DIRECT WALL POST ERROR", {
      message: error instanceof Error ? error.message : String(error)
    });
    diagnosticsEl.open = true;
  } finally {
    if (!published) buttonEl.disabled = false;
  }
}, true);
