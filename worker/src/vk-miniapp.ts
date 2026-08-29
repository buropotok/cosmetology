export const vkMiniAppHtml = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Публикация VK</title>
  <script src="https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js"></script>
  <style>
    body { font-family: sans-serif; padding: 24px; }
    button { width: 100%; padding: 16px; font-size: 18px; }
    pre { margin-top: 20px; white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
  <h2>Публикация в VK</h2>
  <button id="post" disabled>Открыть публикацию</button>
  <pre id="status">Загружаем публикацию…</pre>

  <script>
    const VK_APP_ID = 54742217;
    const VK_API_VERSION = '5.199';
    const status = document.getElementById('status');
    const button = document.getElementById('post');
    let handoff = null;
    let currentToken = '';

    function handoffToken() {
      const query = new URLSearchParams(location.search).get('handoff');
      if (query) return query;
      const hash = new URLSearchParams(location.hash.replace(/^#/, '')).get('handoff');
      if (hash) return hash;
      const launch = new URLSearchParams(location.search).get('vk_ref') || '';
      const match = launch.match(/(?:^|[?&#])handoff=([A-Za-z0-9_-]+)/);
      return match ? match[1] : '';
    }

    function vkError(stage, error) {
      const data = error && typeof error === 'object' ? error : {};
      const nested = data.error_data && typeof data.error_data === 'object' ? data.error_data : {};
      const api = nested.api_error && typeof nested.api_error === 'object' ? nested.api_error : {};
      const code = api.error_code || nested.error_code || data.error_code || '';
      const message = api.error_msg || nested.error_reason || nested.error_msg || data.message || (error instanceof Error ? error.message : '') || data.error_type || 'Неизвестная ошибка';
      const parts = ['Этап: ' + stage];
      if (data.error_type) parts.push('Тип: ' + data.error_type);
      if (code !== '') parts.push('Код: ' + code);
      parts.push('Сообщение: ' + message);
      return parts.join('\\n');
    }

    async function callVkApi(method, params) {
      try {
        const result = await vkBridge.send('VKWebAppCallAPIMethod', { method, params: { ...params, v: VK_API_VERSION } });
        if (result?.response === undefined) throw new Error('VK API не вернул результат');
        return result.response;
      } catch (error) {
        throw new Error(vkError(method, error));
      }
    }

    async function prepareNativePhotoAttachment() {
      status.textContent = 'Получаем разрешение VK на загрузку изображения…';
      let auth;
      try {
        auth = await vkBridge.send('VKWebAppGetAuthToken', { app_id: VK_APP_ID, scope: 'photos' });
      } catch (error) {
        throw new Error(vkError('VKWebAppGetAuthToken (photos)', error));
      }
      if (!auth?.access_token) throw new Error('Этап: VKWebAppGetAuthToken (photos)\\nСообщение: VK не предоставил access_token');

      status.textContent = 'Подготавливаем изображение в VK…';
      const server = await callVkApi('photos.getWallUploadServer', {
        access_token: auth.access_token,
        group_id: handoff.groupId,
      });
      if (!server?.upload_url) throw new Error('Этап: photos.getWallUploadServer\\nСообщение: VK не вернул upload_url');

      let uploadResponse;
      try {
        uploadResponse = await fetch('/api/vk-handoff-upload/' + encodeURIComponent(currentToken), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ uploadUrl: server.upload_url }),
        });
      } catch (error) {
        throw new Error('Этап: upload image to VK\\nСообщение: ' + (error instanceof Error ? error.message : String(error)));
      }
      const uploaded = await uploadResponse.json().catch(() => null);
      if (!uploadResponse.ok) throw new Error('Этап: upload image to VK\\nСообщение: ' + (uploaded?.error?.message || 'HTTP ' + uploadResponse.status));
      if (!uploaded?.photo || uploaded?.server === undefined || !uploaded?.hash) throw new Error('Этап: upload image to VK\\nСообщение: VK вернул неполный результат загрузки');

      const saved = await callVkApi('photos.saveWallPhoto', {
        access_token: auth.access_token,
        group_id: handoff.groupId,
        photo: uploaded.photo,
        server: uploaded.server,
        hash: uploaded.hash,
      });
      const photo = Array.isArray(saved) ? saved[0] : null;
      if (!photo?.owner_id || !photo?.id) throw new Error('Этап: photos.saveWallPhoto\\nСообщение: VK не вернул сохранённую фотографию');
      return 'photo' + photo.owner_id + '_' + photo.id + (photo.access_key ? '_' + photo.access_key : '');
    }

    async function init() {
      try {
        await vkBridge.send('VKWebAppInit');
        currentToken = handoffToken();
        if (!currentToken) throw new Error('Не получен handoff token. Вернитесь в Telegram и откройте VK снова.');
        const response = await fetch('/api/vk-handoff/' + encodeURIComponent(currentToken), { cache: 'no-store' });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.error?.message || 'Не удалось загрузить публикацию.');
        handoff = result;
        button.disabled = false;
        status.textContent = 'Публикация готова. Нажмите кнопку, чтобы открыть редактор VK.';
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : String(error);
      }
    }

    button.addEventListener('click', async () => {
      if (!handoff) return;
      button.disabled = true;
      try {
        let attachment = '';
        if (handoff.imageUrl) attachment = await prepareNativePhotoAttachment();
        status.textContent = 'Открываем редактор VK…';
        const params = { owner_id: -handoff.groupId, message: handoff.text };
        if (attachment) params.attachments = attachment;
        let result;
        try {
          result = await vkBridge.send('VKWebAppShowWallPostBox', params);
        } catch (error) {
          throw new Error(vkError('VKWebAppShowWallPostBox', error));
        }
        status.textContent = result?.post_id ? 'Публикация размещена. ID: ' + result.post_id : 'VK завершил публикацию.';
      } catch (error) {
        status.textContent = 'Ошибка VK:\\n' + (error instanceof Error ? error.message : String(error));
      } finally {
        button.disabled = false;
      }
    });

    init();
  </script>
</body>
</html>`;
