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
    let currentStage = 'init';

    function handoffToken() {
      const query = new URLSearchParams(location.search).get('handoff');
      if (query) return query;
      const hash = new URLSearchParams(location.hash.replace(/^#/, '')).get('handoff');
      if (hash) return hash;
      const launch = new URLSearchParams(location.search).get('vk_ref') || '';
      const match = launch.match(/(?:^|[?&#])handoff=([A-Za-z0-9_-]+)/);
      return match ? match[1] : '';
    }

    function errorDetails(error) {
      const data = error && typeof error === 'object' ? error : {};
      const nested = data.error_data && typeof data.error_data === 'object' ? data.error_data : {};
      const api = nested.api_error && typeof nested.api_error === 'object' ? nested.api_error : {};
      const code = api.error_code ?? nested.error_code ?? data.error_code ?? '';
      const message = api.error_msg ?? nested.error_reason ?? nested.error_msg ?? data.message ?? (error instanceof Error ? error.message : '') ?? '';
      let raw = '';
      try { raw = JSON.stringify(error, null, 2); } catch { raw = String(error); }
      return [
        'Этап: ' + currentStage,
        data.error_type ? 'error_type: ' + data.error_type : '',
        code !== '' ? 'error_code: ' + code : '',
        message ? 'error_msg: ' + message : '',
        raw && raw !== '{}' ? 'error_data:\n' + raw : '',
      ].filter(Boolean).join('\n');
    }

    async function callVkApi(method, params) {
      currentStage = method;
      const result = await vkBridge.send('VKWebAppCallAPIMethod', { method, params: { ...params, v: VK_API_VERSION } });
      if (result?.response === undefined) throw new Error('VK API не вернул результат для ' + method);
      return result.response;
    }

    async function prepareNativePhotoAttachment() {
      currentStage = 'VKWebAppGetAuthToken(photos)';
      status.textContent = 'Получаем разрешение VK на загрузку изображения…';
      const auth = await vkBridge.send('VKWebAppGetAuthToken', { app_id: VK_APP_ID, scope: 'photos' });
      if (!auth?.access_token) throw new Error('VK не предоставил доступ к фотографиям.');

      status.textContent = 'Подготавливаем изображение в VK…';
      const server = await callVkApi('photos.getWallUploadServer', {
        access_token: auth.access_token,
        group_id: handoff.groupId,
      });
      if (!server?.upload_url) throw new Error('VK не вернул сервер загрузки фотографии.');

      currentStage = 'upload image to VK upload server';
      const uploadResponse = await fetch('/api/vk-handoff-upload/' + encodeURIComponent(currentToken), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uploadUrl: server.upload_url }),
      });
      const uploaded = await uploadResponse.json().catch(() => null);
      if (!uploadResponse.ok) throw new Error(uploaded?.error?.message || 'Не удалось загрузить фотографию в VK.');
      if (!uploaded?.photo || uploaded?.server === undefined || !uploaded?.hash) throw new Error('VK вернул неполный результат загрузки фотографии.');

      const saved = await callVkApi('photos.saveWallPhoto', {
        access_token: auth.access_token,
        group_id: handoff.groupId,
        photo: uploaded.photo,
        server: uploaded.server,
        hash: uploaded.hash,
      });
      const photo = Array.isArray(saved) ? saved[0] : null;
      if (!photo?.owner_id || !photo?.id) throw new Error('VK не сохранил фотографию для публикации.');
      return 'photo' + photo.owner_id + '_' + photo.id + (photo.access_key ? '_' + photo.access_key : '');
    }

    async function init() {
      try {
        currentStage = 'VKWebAppInit';
        await vkBridge.send('VKWebAppInit');
        currentStage = 'load handoff';
        currentToken = handoffToken();
        if (!currentToken) throw new Error('Не получен handoff token. Вернитесь в Telegram и откройте VK снова.');
        const response = await fetch('/api/vk-handoff/' + encodeURIComponent(currentToken), { cache: 'no-store' });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.error?.message || 'Не удалось загрузить публикацию.');
        handoff = result;
        button.disabled = false;
        status.textContent = 'Публикация готова. Нажмите кнопку, чтобы открыть редактор VK.';
      } catch (error) {
        status.textContent = 'Ошибка VK:\n' + errorDetails(error);
      }
    }

    button.addEventListener('click', async () => {
      if (!handoff) return;
      button.disabled = true;
      try {
        let attachment = '';
        if (handoff.imageUrl) attachment = await prepareNativePhotoAttachment();
        currentStage = 'VKWebAppShowWallPostBox';
        status.textContent = 'Открываем редактор VK…';
        const params = { owner_id: -handoff.groupId, message: handoff.text };
        if (attachment) params.attachments = attachment;
        const result = await vkBridge.send('VKWebAppShowWallPostBox', params);
        status.textContent = result?.post_id ? 'Публикация размещена. ID: ' + result.post_id : 'VK завершил публикацию.';
      } catch (error) {
        status.textContent = 'Ошибка VK:\n' + errorDetails(error);
      } finally {
        button.disabled = false;
      }
    });

    init();
  </script>
</body>
</html>`;
